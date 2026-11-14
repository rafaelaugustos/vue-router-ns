import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { promisify } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { recordEnvironment } from '../contracts/environment.mjs'
const exec = promisify(execFile)
const serial = process.env.ANDROID_SERIAL
assert(serial, 'Set ANDROID_SERIAL to a dedicated emulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/android-intents')
const pkg = 'org.nativescript.vuerouterns'
const component = `${pkg}/com.tns.NativeScriptActivity`
const adb = async (...args) =>
  (
    await exec('adb', ['-s', serial, ...args], {
      timeout: 45000,
      maxBuffer: 16 * 1024 * 1024,
    })
  ).stdout
const pause = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))
await mkdir(out, { recursive: true })
await recordEnvironment(out, {
  serial,
  sdk: (await adb('shell', 'getprop', 'ro.build.version.sdk')).trim(),
})
const reports = []
async function read() {
  try {
    return JSON.parse(
      await adb('shell', 'run-as', pkg, 'cat', 'files/android-intents.json'),
    )
  } catch {
    return null
  }
}
async function wait(test, name) {
  const end = Date.now() + 30000
  while (Date.now() < end) {
    const value = await read()
    if (value && !value.ok) throw new Error(value.error)
    if (value && test(value)) {
      reports.push({ ...value, check: name })
      await writeFile(`${out}/reports.json`, JSON.stringify(reports, null, 2))
      console.log(`PASS ${name}`)
      return value
    }
    await pause()
  }
  throw new Error(`Timeout ${name}: ${JSON.stringify(await read())}`)
}
async function command(name) {
  const before = await read()
  await adb(
    'shell',
    'am',
    'broadcast',
    '-a',
    `${pkg}.INTENTS_TEST`,
    '-p',
    pkg,
    '--es',
    'command',
    name,
  )
  return wait((r) => r.sequence > (before?.sequence ?? 0) && r.command === name, name)
}
async function received(source, before, cold = false, reason) {
  const report = await wait(
    (r) =>
      r.command.startsWith(`received-${source}-`) &&
      (cold ? r.process !== before.process : r.nativeCallbacks > before.nativeCallbacks),
    `${cold ? 'cold' : 'warm'}-${source}${reason ? '-' + reason : ''}`,
  )
  if (cold)
    assert.equal(
      report.nativeCallbacks,
      1,
      'Core cold synthetic callback not consumed twice',
    )
  else assert.equal(report.process, before.process)
  if (reason) assert.equal(report.result.reason, reason)
  return report
}
async function login() {
  const before = await read()
  await tap('intent-entry:login')
  const report = await wait(
    (r) => r.sequence > before.sequence && r.command.startsWith('login-'),
    'login-resume',
  )
  assert.equal(report.result.status, 'handled')
  assert.equal(report.stacks.target.native.at(-1), '/articles/7')
  assert(!report.stacks.target.native.includes('/login'))
  assert(report.guarded > 0)
  return report
}
async function notification(kind, cold = false, reason) {
  const before = await command(`notify-${kind}`)
  assert.equal(
    before.nativeCallbacks,
    reports.at(-2)?.nativeCallbacks ?? before.nativeCallbacks,
    'Posting alone does not navigate',
  )
  if (cold) {
    await adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    await hierarchy()
    await adb('shell', 'am', 'kill', pkg)
    const pid = await adb('shell', 'pidof', pkg).catch(() => '')
    assert(
      !pid.trim(),
      'Background process terminated without force-stop cancelling PendingIntent',
    )
  }
  await adb('shell', 'cmd', 'statusbar', 'expand-notifications')
  await tap(`Intent ${kind}`)
  const report = await received('notification', before, cold, reason)
  if (cold) assert.notEqual(report.pid, before.pid)
  return report
}
async function hierarchy() {
  await adb('shell', 'uiautomator', 'dump', '/sdcard/entrypoints.xml')
  return adb('shell', 'cat', '/sdcard/entrypoints.xml')
}
function control(xml, name) {
  return (xml.match(/<node\b[^>]*>/g) ?? []).find(
    (node) =>
      node.includes(`text="${name}"`) ||
      node.includes(`content-desc="${name}"`) ||
      node.includes(`content-desc="${name}. `),
  )
}
async function press(node, hold = false) {
  const bounds = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node)
  assert(bounds)
  const x = String(Math.round((+bounds[1] + +bounds[3]) / 2))
  const y = String(Math.round((+bounds[2] + +bounds[4]) / 2))
  await adb('shell', 'input', ...(hold ? ['swipe', x, y, x, y, '1000'] : ['tap', x, y]))
}
async function tap(name) {
  const xml = await hierarchy()
  const node = control(xml, name)
  if (!node) await writeFile(`${out}/missing-control.xml`, xml)
  assert(node, `Visible launcher control ${name}; see missing-control.xml`)
  await press(node)
}
async function shortcut(title) {
  const size = /Physical size: (\d+)x(\d+)/.exec(await adb('shell', 'wm', 'size'))
  const label = process.env.ENTRYPOINT_APP_LABEL ?? 'Intent Lab'
  let xml = ''
  // A Home animation can still occlude input after am/input returns. Wait for
  // an idle hierarchy and verify the app drawer before pressing an icon. A
  // predicted home-screen icon may instead open launcher onboarding.
  for (let attempt = 0; attempt < 3; attempt++) {
    await adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    await hierarchy()
    await adb(
      'shell',
      'input',
      'swipe',
      String(+size[1] / 2),
      String(+size[2] * 0.85),
      String(+size[1] / 2),
      String(+size[2] * 0.15),
      '400',
    )
    xml = await hierarchy()
    const drawer = /resource-id="[^"]*\/apps_(?:view|list_view|recycler_view)"/.test(xml)
    const icon = (xml.match(/<node\b[^>]*>/g) ?? []).find(
      (node) =>
        node.includes(`content-desc="${label}"`) &&
        node.includes('long-clickable="true"'),
    )
    if (!drawer || !icon) continue
    await press(icon, true)
    for (let poll = 0; poll < 3; poll++) {
      xml = await hierarchy()
      const action = control(xml, title)
      if (action) {
        await writeFile(`${out}/launcher-menu.xml`, xml)
        await press(action)
        return
      }
      await pause(200)
    }
    await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
  }
  await writeFile(`${out}/launcher-menu.xml`, xml)
  assert.fail(`Launcher did not expose ${title}; see launcher-menu.xml`)
}

let recorder, stopped, recordingPid
try {
  if (process.env.ANDROID_APP)
    await adb('install', '-r', resolve(process.env.ANDROID_APP))
  await adb('shell', 'am', 'force-stop', pkg)
  await adb('shell', 'pm', 'clear', pkg)
  await adb('logcat', '-c')
  if (process.env.RECORD_VIDEO === '1') {
    recorder = spawn(
      'adb',
      [
        '-s',
        serial,
        'shell',
        'screenrecord',
        '--size',
        '540x1200',
        '--bit-rate',
        '2000000',
        '--time-limit',
        '180',
        '/sdcard/android-intents.mp4',
      ],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    )
    stopped = once(recorder, 'close')
    await pause(1000)
    recordingPid = (await adb('shell', 'pidof', 'screenrecord')).trim()
    assert(/^\d+$/.test(recordingPid))
  }
  // Real OS URL starts a signed-out process before the router mounts.
  await adb(
    'shell',
    'am',
    'start',
    '-W',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    'routerentries://messages/7',
    '-n',
    component,
  )
  const initial = await wait((r) => r.command.startsWith('received-url-'), 'cold-url')
  assert.equal(initial.nativeCallbacks, 1)
  // First login uses the original path; subsequent native taps follow renamed route.
  await tap('intent-entry:login')
  await wait((r) => r.command.startsWith('login-'), 'cold-url-login')
  await command('permission')
  await tap('Allow')
  await command('publish')
  await command('rename')
  let before = await read()
  await shortcut('Intent message')
  // Different current destination: sign-in remains valid, normal open succeeds.
  const firstShortcut = await received('shortcut', before)
  await command('replay')
  before = await read()
  await shortcut('Intent message')
  const repeated = await received('shortcut', before)
  assert.equal(
    repeated.result.failure,
    16,
    'Distinct tap reaches ordinary duplicate navigation',
  )
  assert.notEqual(repeated.result.delivery.id, firstShortcut.result.delivery.id)
  await command('prepare-cold')
  before = await read()
  await adb('shell', 'am', 'force-stop', pkg)
  await shortcut('Intent message')
  const coldShortcut = await received('shortcut', before, true)
  assert.notEqual(coldShortcut.pid, before.pid)
  await login()
  await notification('valid')
  await notification('valid', true)
  await login()
  await command('replay')
  await notification('invalid', false, 'invalid')
  await notification('expired', false, 'expired')
  await notification('version', false, 'version')
  await notification('unknown', false, 'unmatched')
  before = await read()
  await adb(
    'shell',
    'am',
    'start',
    '-W',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    'routerentries://articles/7',
    '-n',
    component,
  )
  await received('url', before)
  await command('compare')
  // Recents restores the existing Activity; it must not repeat its last notification.
  before = await read()
  await adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
  await hierarchy()
  await adb('shell', 'input', 'keyevent', 'KEYCODE_APP_SWITCH')
  await hierarchy()
  await adb('shell', 'input', 'keyevent', 'KEYCODE_APP_SWITCH')
  await hierarchy()
  assert(
    (await hierarchy()).includes('intent-entry:publish'),
    'Recents returned to the actual app UI',
  )
  const recents = await command('capture')
  assert.equal(recents.nativeCallbacks, before.nativeCallbacks)
  assert.equal(recents.process, before.process)
  assert.deepEqual(recents.stacks, before.stacks)
  await command('remove-route')
  before = await read()
  await shortcut('Intent message')
  await received('shortcut', before, false, 'unmatched')
  await command('clear')
  assert.equal(new Set(reports.map((r) => r.process)).size, 3)
  for (const report of reports) {
    assert.equal(report.sourceDraft, 'Unsent source draft')
    assert.deepEqual(report.stacks.source.native, ['/'])
    for (const stack of Object.values(report.stacks))
      assert.deepEqual(stack.native, stack.logical)
  }
  await pause(1000)
  if (recorder)
    assert.equal(recorder.exitCode, null, 'Complete scenario fits recording limit')
  console.log(`PASS ${reports.length} reports / three processes / native Android entries`)
} finally {
  if (recordingPid) {
    await adb('shell', 'kill', '-2', recordingPid).catch(() => {})
    await stopped
    await adb('pull', '/sdcard/android-intents.mp4', `${out}/android-intents.mp4`)
  }
  await writeFile(`${out}/logcat.txt`, await adb('logcat', '-d', '-v', 'threadtime'))
}
