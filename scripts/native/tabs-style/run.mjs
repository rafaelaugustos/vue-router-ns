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
  process.env.OUT ?? `scripts/native/out/tabs-style-${sim ? 'ios' : serial}`,
)
await mkdir(out, { recursive: true })
const run = async (cmd, args) =>
  (await exec(cmd, args, { timeout: 60000, maxBuffer: 16 * 1024 * 1024 })).stdout.trim()
const adb = (...args) => run('adb', ['-s', serial, ...args])
const ios = (...args) => run('xcrun', ['simctl', ...args])
const appShell = (...args) => adb('shell', ...(rooted ? [] : ['run-as', pkg]), ...args)
const appFiles = `/data/data/${pkg}/files/tabs-style`
const pause = (ms) => new Promise((done) => setTimeout(done, ms))
let container
if (sim) {
  await ios('terminate', sim, pkg).catch(() => {})
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
          '/sdcard/tabs-style.mp4',
        ],
        { stdio: 'ignore' },
      )
}
const results = []
async function command(action, value) {
  const id = results.length + 1
  const body = JSON.stringify({ id, action, value })
  if (sim) await writeFile(`${container}/Documents/tabs-style/command.json`, body)
  else {
    await writeFile(`${out}/command.json`, body)
    await adb('push', `${out}/command.json`, '/data/local/tmp/tabs-style-command.json')
    await appShell(
      'cp',
      '/data/local/tmp/tabs-style-command.json',
      `${appFiles}/command.json`,
    )
  }
  let report
  for (let i = 0; i < 80; i++) {
    try {
      const text = sim
        ? await readFile(`${container}/Documents/tabs-style/result.json`, 'utf8')
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
  assert(report.preserved, 'Appearance replaced a live Page')
  for (const [key, value] of Object.entries(report.native)) {
    if (typeof value === 'boolean')
      assert(value, `${action}: native ${key} did not match public color`)
  }
  if (serial && report.native.kind !== 'core') {
    assert.deepEqual(report.native.titles, ['Inbox', 'Saved'])
    assert.equal(report.native.badge, 2)
  }
  if (id > 2) {
    assert.equal(report.mounts, results[1].mounts, 'Appearance remounted a Vue page')
    assert.deepEqual(report.stacks, results[1].stacks, 'Appearance changed a stack')
  }
  console.log(`PASS ${action} ${value ?? ''} (${report.native.kind})`)
  if (recording) await pause(1300)
  return report
}
try {
  const first = await command('snapshot')
  if (process.env.EXPECTED_HOST)
    assert.equal(first.native.kind, process.env.EXPECTED_HOST)
  await command('push')
  await command('theme', 'light')
  await command('theme', 'dark')
  await command('select', 'inbox')
  await command('override', '#e11d48')
  await command('theme', 'light')
  await command('override', '')
  const onlySelected = await command('labels', 'selected')
  if (serial && onlySelected.native.kind !== 'core')
    assert.equal(onlySelected.native.labels, 0)
  const automatic = await command('labels', 'auto')
  if (serial && automatic.native.kind !== 'core')
    assert.equal(automatic.native.labels, -1)
  const hidden = await command('labels', 'unlabeled')
  if (serial && hidden.native.kind !== 'core') {
    assert.equal(hidden.native.labels, 2)
    await adb('shell', 'uiautomator', 'dump', '/sdcard/tabs-style.xml')
    const xml = await adb('shell', 'cat', '/sdcard/tabs-style.xml')
    assert.match(xml, /content-desc="Inbox[^"]*"/)
    assert.match(xml, /content-desc="Saved[^"]*"/)
    await writeFile(`${out}/unlabeled-accessibility.xml`, xml)
  }
  const rail = await command('rail', true)
  if (serial && rail.native.kind !== 'core') assert.equal(rail.native.kind, 'rail')
  const shown = await command('labels', 'labeled')
  if (serial && shown.native.kind !== 'core') assert.equal(shown.native.labels, 1)
  await command('theme', 'dark')
  await command('select', 'saved')
  await command('rail', false)
  const defaults = await command('theme', 'native')
  assert.deepEqual(
    defaults.native.raw,
    results[0].native.raw,
    'Did not restore native defaults',
  )
  await command('theme', 'dark')
  if (sim) await ios('io', sim, 'screenshot', `${out}/final.png`)
  else {
    await adb('shell', 'screencap', '-p', '/sdcard/tabs-style.png')
    await adb('pull', '/sdcard/tabs-style.png', `${out}/final.png`)
  }
} finally {
  if (recording) {
    if (sim) recording.kill('SIGINT')
    else await adb('shell', 'pkill', '-INT', 'screenrecord').catch(() => {})
    await pause(1500)
    if (serial)
      await adb('pull', '/sdcard/tabs-style.mp4', `${out}/demo.mp4`).catch(() => {})
  }
  if (rooted) {
    await adb('unroot')
    await adb('wait-for-device')
  }
}
console.log(
  `PASS ${results.length} native appearance transitions; pages, histories, titles and badges preserved`,
)
