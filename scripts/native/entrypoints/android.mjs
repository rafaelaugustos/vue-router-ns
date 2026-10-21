import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { recordEnvironment } from '../contracts/environment.mjs'
const exec = promisify(execFile)
const serial = process.env.ANDROID_SERIAL
assert(serial, 'Set ANDROID_SERIAL to a dedicated test emulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/entrypoints-android')
const pkg = 'org.nativescript.vuerouterns'
const adb = async (...args) =>
  (
    await exec('adb', ['-s', serial, ...args], {
      timeout: 45000,
      maxBuffer: 16 * 1024 * 1024,
    })
  ).stdout
const pause = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms))
await mkdir(out, { recursive: true })
await recordEnvironment(out, {
  serial,
  sdk: (await adb('shell', 'getprop', 'ro.build.version.sdk')).trim(),
})
let index = 0
async function read() {
  try {
    return JSON.parse(await adb('shell', 'run-as', pkg, 'cat', 'files/entrypoints.json'))
  } catch {
    return null
  }
}
async function wait(test, name) {
  const end = Date.now() + 35000
  while (Date.now() < end) {
    const value = await read()
    if (value && !value.ok) throw new Error(value.error)
    if (value && test(value)) {
      await writeFile(`${out}/${++index}-${name}.json`, JSON.stringify(value, null, 2))
      console.log(`PASS ${name}`)
      return value
    }
    await pause()
  }
  throw new Error(`Timed out: ${name}; ${JSON.stringify(await read())}`)
}
const first = (report) => report.sessions.find((session) => session.key === 'a')
async function command(name, key = 'a') {
  const before = (await read())?.sequence ?? 0
  await adb(
    'shell',
    'am',
    'broadcast',
    '-a',
    `${pkg}.ENTRYPOINT_TEST`,
    '-p',
    pkg,
    '--es',
    'command',
    name,
    '--es',
    'window',
    key,
  )
  return wait((report) => report.sequence > before && report.command === name, name)
}
async function link(href, target, name) {
  const before = (await read())?.events.length ?? 0
  await adb(
    'shell',
    'am',
    'start',
    '-W',
    '-f',
    '0x20000000',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    href,
    '-n',
    `${pkg}/com.tns.NativeScriptActivity`,
  )
  return wait(
    (report) => report.events.length > before && first(report)?.current === target,
    name,
  )
}
async function hierarchy() {
  await adb('shell', 'uiautomator', 'dump', '/sdcard/entrypoints.xml')
  return adb('shell', 'cat', '/sdcard/entrypoints.xml')
}
function control(xml, name) {
  return (xml.match(/<node\b[^>]*>/g) ?? []).find(
    (node) => node.includes(`text="${name}"`) || node.includes(`content-desc="${name}"`),
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
  const label = process.env.ENTRYPOINT_APP_LABEL ?? 'demo'
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
async function screenshot(name) {
  await adb('shell', 'screencap', '-p', `/sdcard/${name}.png`)
  await adb('pull', `/sdcard/${name}.png`, `${out}/${name}.png`)
}

try {
  if (process.env.ANDROID_APP)
    await adb('install', '-r', resolve(process.env.ANDROID_APP))
  await adb('shell', 'am', 'force-stop', pkg)
  await adb('shell', 'pm', 'clear', pkg)
  await adb('logcat', '-c')
  await adb(
    'shell',
    'am',
    'start',
    '-W',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    'routerentries://settings/items/cold',
    '-n',
    `${pkg}/com.tns.NativeScriptActivity`,
  )
  const cold = await wait(
    (report) =>
      first(report)?.current === '/settings/items/cold' && first(report)?.window,
    'cold-unvisited-tab',
  )
  assert.equal(first(cold).selected, 1)
  assert.deepEqual(first(cold).frames.settings.history, [
    '/settings',
    '/settings/items/cold',
  ])
  assert.deepEqual(first(cold).frames.home.history, ['/'])
  await link(
    'routerentries://settings/account',
    '/login?next=%2Fsettings%2Faccount',
    'warm-login-guard',
  )
  const login = await command('login')
  assert.deepEqual(first(login).history, [
    '/settings',
    '/settings/items/cold',
    '/settings/account',
  ])
  await link('routerentries://compose', '/compose', 'warm-modal')
  await command('back')
  await adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
  await link(
    'routerentries://settings/items/background',
    '/settings/items/background',
    'background-tab',
  )
  const before = (await read()).events.length
  await command('back')
  await link(
    'routerentries://settings/items/background',
    '/settings/items/background',
    'intentional-repeat',
  )
  assert.equal((await read()).events.length, before + 1)
  await command('publish')
  const native = await adb('shell', 'dumpsys', 'shortcut')
  await writeFile(`${out}/published-shortcuts.txt`, native)
  assert(native.includes('entry-stable') && native.includes('static-account'))
  await command('rename')
  // OS launcher UI checks are added below; keep the reports independent of API-level launcher layout.
  if (process.env.ENTRYPOINT_LAUNCHER === '1') {
    await shortcut('Stable route')
    await wait(
      (report) => first(report)?.current === '/renamed',
      'launcher-warm-renamed-route',
    )
    await screenshot('warm-renamed-shortcut')
    await command('remove-route')
    const oldCount = (await read()).events.length
    await shortcut('Stable route')
    await wait(
      (report) =>
        report.events.length > oldCount && report.events.at(-1)?.ignored === 'unmatched',
      'launcher-deleted-route',
    )
    const oldPid = (await read()).pid
    await adb('shell', 'am', 'force-stop', pkg)
    await shortcut('Stable route')
    await wait(
      (report) => report.pid !== oldPid && first(report)?.current === '/renamed',
      'launcher-cold-renamed-route',
    )
    await command('signout')
    const warmPid = (await read()).pid
    await shortcut('Static account')
    const staticWarm = await wait(
      (report) => first(report)?.current.startsWith('/login'),
      'launcher-warm-static-login',
    )
    assert.equal(
      staticWarm.pid,
      warmPid,
      'Static trampoline preserves running native app',
    )
    await command('login')
    await command('signout')
    await adb('shell', 'am', 'force-stop', pkg)
    await shortcut('Static account')
    await wait(
      (report) => report.pid !== warmPid && first(report)?.current.startsWith('/login'),
      'launcher-cold-static-login',
    )
    await command('login')
    await command('pin')
    const confirmation = await hierarchy()
    await writeFile(`${out}/pin-confirmation.xml`, confirmation)
    const confirm = [
      'Add automatically',
      'Add to Home screen',
      'Add to home screen',
      'Add',
    ].find((text) => confirmation.includes(`text="${text}"`))
    assert(confirm, `Native pin confirmation: ${confirmation}`)
    await tap(confirm)
    await pause(500)
    await adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    await tap('Pinned route')
    await wait((report) => first(report)?.current === '/renamed', 'launcher-pinned-route')
    await screenshot('pinned-route')
    const pinned = await adb('shell', 'dumpsys', 'shortcut')
    await writeFile(`${out}/pinned-shortcuts.txt`, pinned)
    assert(pinned.includes('entry-pin'))
    await command('signout')
    const disabled = await adb('shell', 'dumpsys', 'shortcut')
    await writeFile(`${out}/disabled-pinned-shortcut.txt`, disabled)
    const record = disabled
      .split('ShortcutInfo {')
      .find((item) => item.startsWith('id=entry-pin,'))
    assert(
      record && /disabledReason=\[Disabled: by app\]/.test(record),
      `Pinned shortcut disabled: ${record}`,
    )
  }

  const second = await command('second')
  assert.equal(second.sessions.length, 2)
  assert.equal(new Set(second.sessions.map((s) => s.task)).size, 2)
  const warmWindow = await command('second-link', 'b')
  await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
  let afterBack
  const backDeadline = Date.now() + 15000
  do {
    await pause(200)
    afterBack = await command('capture', 'b')
  } while (
    afterBack.sessions.find((s) => s.key === 'b').current === '/settings/items/warm' &&
    Date.now() < backDeadline
  )
  const secondary = afterBack.sessions.find((s) => s.key === 'b')
  assert.deepEqual(secondary.frames.settings.history, [
    '/settings',
    '/settings/items/second',
  ])
  assert.deepEqual(
    first(afterBack).history,
    first(warmWindow).history,
    'Secondary back preserves the primary window',
  )
  for (const [name, frame] of Object.entries(first(warmWindow).frames))
    assert.deepEqual(first(afterBack).frames[name].history, frame.history)
  await command('signout', 'b')
  const removed = await adb('shell', 'dumpsys', 'shortcut')
  await writeFile(`${out}/removed-shortcuts.txt`, removed)
  console.log('Native link and window checks complete')
} finally {
  await writeFile(`${out}/logcat.txt`, await adb('logcat', '-d', '-v', 'threadtime'))
}
