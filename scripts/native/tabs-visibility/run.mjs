import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
const serial = process.env.ANDROID_SERIAL
assert(
  !!sim !== !!serial,
  'Set exactly one of IOS_SIMULATOR / ANDROID_SERIAL to a dedicated test device',
)
const pkg = 'org.nativescript.vuerouterns'
const rooted = process.env.ANDROID_ROOT === '1'
const out = resolve(
  process.env.OUT ?? `scripts/native/out/tabs-visibility-${sim ? 'ios' : serial}`,
)
await mkdir(out, { recursive: true })
const run = async (cmd, args) =>
  (await exec(cmd, args, { timeout: 60000, maxBuffer: 16 * 1024 * 1024 })).stdout.trim()
const adb = (...args) => run('adb', ['-s', serial, ...args])
const ios = (...args) => run('xcrun', ['simctl', ...args])
const appShell = (...args) => adb('shell', ...(rooted ? [] : ['run-as', pkg]), ...args)
const appFiles = `/data/data/${pkg}/files/tabs-visibility`
const pause = (ms) => new Promise((done) => setTimeout(done, ms))
let container
if (sim) {
  await ios('terminate', sim, pkg).catch(() => {})
  await ios('uninstall', sim, pkg).catch(() => {})
  await ios(
    'install',
    sim,
    process.env.IOS_APP ?? 'demo/platforms/ios/build/Debug-iphonesimulator/demo.app',
  )
  await ios('launch', sim, pkg)
  container = await ios('get_app_container', sim, pkg, 'data')
} else {
  if (rooted) {
    await adb('root')
    await adb('wait-for-device')
  }
  await adb('shell', 'am', 'force-stop', pkg)
  await adb('shell', 'pm', 'clear', pkg)
  await adb('shell', 'am', 'start', '-W', '-n', `${pkg}/com.tns.NativeScriptActivity`)
}
await pause(2500)
let recording
if (process.env.RECORD === '1') {
  recording = sim
    ? spawn(
        'xcrun',
        ['simctl', 'io', sim, 'recordVideo', '--codec=h264', `${out}/demo.mp4`],
        { stdio: 'ignore' },
      )
    : spawn(
        'adb',
        [
          '-s',
          serial,
          'shell',
          'screenrecord',
          '--bit-rate',
          '4000000',
          '/sdcard/tabs-visibility.mp4',
        ],
        { stdio: 'ignore' },
      )
}
const results = []
async function command(action, value) {
  const id = results.length + 1
  const body = JSON.stringify({ id, action, value })
  if (sim) await writeFile(`${container}/Documents/tabs-visibility/command.json`, body)
  else {
    await writeFile(`${out}/command.json`, body)
    await adb(
      'push',
      `${out}/command.json`,
      '/data/local/tmp/tabs-visibility-command.json',
    )
    await appShell(
      'cp',
      '/data/local/tmp/tabs-visibility-command.json',
      `${appFiles}/command.json`,
    )
  }
  let report
  for (let i = 0; i < 80; i++) {
    try {
      const text = sim
        ? await readFile(`${container}/Documents/tabs-visibility/result.json`, 'utf8')
        : await appShell('cat', `${appFiles}/result.json`)
      report = JSON.parse(text)
      if (report.id === id) break
    } catch {}
    await pause(200)
  }
  assert.equal(report?.id, id, `Command timed out: ${action}`)
  results.push({ action, value, ...report })
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2))
  assert(!report.error, JSON.stringify(report))
  console.log(`PASS ${action} ${value ?? ''} (${report.kind})`)
  if (recording) await pause(1300)
  return report
}
const expectHidden = (report, hidden) => {
  assert.equal(
    report.hidden,
    report.kind === 'core' ? false : hidden,
    JSON.stringify(report),
  )
  if (report.kind !== 'core')
    assert.equal(report.accessible, !hidden, 'Hidden navigation remains accessible')
}
try {
  const first = await command('snapshot')
  expectHidden(first, false)
  if (process.env.EXPECTED_HOST) assert.equal(first.kind, process.env.EXPECTED_HOST)
  const detail = await command('push')
  expectHidden(detail, true)
  assert.equal(detail.stacks.inbox, 2)
  if (detail.kind === 'bottom')
    assert(
      detail.height > first.height,
      'Content did not reclaim bottom navigation height',
    )
  if (detail.kind === 'uikit')
    assert(
      detail.inset < first.inset || detail.height > first.height,
      'UIKit did not reclaim the tab bar safe area',
    )
  await command('remember')
  if (serial && process.env.TOUCH_APK) {
    const touchPkg = 'org.nativescript.contracttouch'
    await adb('install', '-r', process.env.TOUCH_APK)
    await adb(
      'shell',
      'cmd',
      'overlay',
      'enable',
      'com.android.internal.systemui.navbar.gestural',
    )
    const pid = await adb('shell', 'pidof', pkg)
    const size = [...(await adb('shell', 'wm', 'size')).matchAll(/(\d+)x(\d+)/g)].at(-1)
    for (const mode of ['cancel', 'commit']) {
      const gesture = await adb(
        'shell',
        'am',
        'instrument',
        '-w',
        '-e',
        'mode',
        mode,
        '-e',
        'width',
        size[1],
        '-e',
        'height',
        size[2],
        `${touchPkg}/.ContractTouch`,
      )
      assert.match(gesture, /result=CONTRACT_TOUCH_OK/)
      assert.equal(await adb('shell', 'pidof', pkg), pid)
      const report = await command('snapshot')
      expectHidden(report, mode === 'cancel')
      assert.equal(report.stacks.inbox, mode === 'cancel' ? 2 : 1)
      if (mode === 'cancel')
        assert(report.preserved, 'Cancelled gesture replaced the page')
    }
    await adb('uninstall', touchPkg)
    expectHidden(await command('push'), true)
    await command('remember')
  }
  expectHidden(await command('modal'), true)
  assert((await command('back')).preserved, 'Modal replaced the presenter')
  expectHidden(await command('select', 'saved'), false)
  const back = await command('select', 'inbox')
  expectHidden(back, true)
  assert(back.preserved, 'Tab switch replaced the detail')
  expectHidden(await command('guard', true), true)
  const rejected = await command('back')
  expectHidden(rejected, true)
  assert(rejected.preserved)
  await command('guard', false)
  expectHidden(await command('push', 'visible'), false)
  expectHidden(await command('back'), true)
  expectHidden(await command('replace', 'visible'), false)
  expectHidden(await command('push'), true)
  expectHidden(await command('root'), false)
  expectHidden(await command('push', 'blocked'), false)
  expectHidden(await command('broken'), false)
  if (serial && first.kind !== 'core') {
    const rail = await command('rail', true)
    assert.equal(rail.kind, 'rail')
    const expanded = await command('push')
    expectHidden(expanded, true)
    assert(expanded.width > rail.width, 'Content did not reclaim rail width')
    expectHidden(await command('back'), false)
    await command('rail', false)
  }
  expectHidden(await command('link', 'vuerouterns://saved/detail'), true)
  assert.equal(results.at(-1).selected, 'saved')
  if (sim) {
    await ios('terminate', sim, pkg)
    await ios('launch', sim, pkg)
  } else {
    await adb('shell', 'am', 'force-stop', pkg)
    await adb('shell', 'am', 'start', '-W', '-n', `${pkg}/com.tns.NativeScriptActivity`)
  }
  await pause(1800)
  expectHidden(await command('select', 'saved'), true)
  assert.equal(results.at(-1).stacks.saved, 2, 'Restoration lost native history')
  await command('root')
  // iOS cold URL delivery is covered by XCTest's app.open (handles system consent).
  if (serial) {
    await adb('shell', 'am', 'force-stop', pkg)
    await adb(
      'shell',
      'am',
      'start',
      '-W',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      'vuerouterns://saved/detail',
      pkg,
    )
    await pause(2000)
    expectHidden(await command('snapshot'), true)
    assert.equal(results.at(-1).selected, 'saved')
  }
  if (sim) await ios('io', sim, 'screenshot', `${out}/final.png`)
  else {
    await adb('shell', 'screencap', '-p', '/sdcard/tabs-visibility.png')
    await adb('pull', '/sdcard/tabs-visibility.png', `${out}/final.png`)
  }
} finally {
  if (recording) {
    if (sim) recording.kill('SIGINT')
    else await adb('shell', 'pkill', '-INT', 'screenrecord').catch(() => {})
    await pause(1500)
    if (serial)
      await adb('pull', '/sdcard/tabs-visibility.mp4', `${out}/demo.mp4`).catch(() => {})
  }
  if (rooted) {
    await adb('unroot')
    await adb('wait-for-device')
  }
}
console.log(
  `PASS ${results.length} native visibility checks; layout, guards, modals, histories and restoration verified`,
)
