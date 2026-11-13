import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve } from 'node:path'
const serial = process.env.ANDROID_SERIAL
assert(serial, 'Use a dedicated Android emulator')
const exec = promisify(execFile),
  out = resolve(process.env.OUT ?? 'scripts/native/out/history-menu-android')
const adb = async (...args) =>
  (await exec('adb', ['-s', serial, ...args], { maxBuffer: 16 * 1024 * 1024 })).stdout
const pause = (ms) => new Promise((done) => setTimeout(done, ms))
const pkg = 'org.nativescript.vuerouterns'
await mkdir(out, { recursive: true })
await adb(
  'install',
  '-r',
  'demo/platforms/android/app/build/outputs/apk/debug/app-debug.apk',
)
await adb('shell', 'am', 'force-stop', pkg)
await adb('shell', 'am', 'start', '-n', `${pkg}/com.tns.NativeScriptActivity`)
const dumpPath = '/sdcard/history-menu-window.xml'
async function dump() {
  for (let attempt = 0; attempt < 10; attempt++) {
    await adb('shell', 'rm', '-f', dumpPath)
    const report = await adb(
      'shell',
      'uiautomator',
      'dump',
      '--compressed',
      dumpPath,
    ).catch(() => '')
    if (report.includes('dumped to:')) return adb('shell', 'cat', dumpPath)
    await pause(500)
  }
  throw new Error('UIAutomator never produced a window hierarchy')
}
async function nodes(name = 'window') {
  const xml = await dump()
  await writeFile(`${out}/${name}.xml`, xml)
  const result = [],
    ancestors = []
  for (const [tag] of xml.matchAll(/<\/?node\b[^>]*>/g)) {
    if (tag.startsWith('</')) {
      ancestors.pop()
      continue
    }
    const node = Object.fromEntries(
      [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
    )
    // PopupMenu disables its row; its child TextView can still report enabled.
    if (ancestors.some((parent) => parent.enabled === 'false')) node.enabled = 'false'
    result.push(node)
    if (!tag.endsWith('/>')) ancestors.push(node)
  }
  return result
}
function find(list, text) {
  return list.findLast(
    (node) =>
      node.text.toLowerCase() === text.toLowerCase() ||
      node['content-desc'].toLowerCase() === text.toLowerCase() ||
      node['content-desc'].toLowerCase().startsWith(text.toLowerCase() + '. '),
  )
}
function point(node) {
  assert(node, 'Missing native input target')
  const [left, top, right, bottom] = node.bounds.match(/\d+/g).map(Number)
  return [String((left + right) >> 1), String((top + bottom) >> 1)]
}
async function tap(text, long = false) {
  const xy = point(find(await wait(text), text))
  if (long) await adb('shell', 'input', 'swipe', ...xy, ...xy, '900')
  else await adb('shell', 'input', 'tap', ...xy)
  await pause(300)
}
async function wait(text) {
  for (let i = 0; i < 8; i++) {
    const list = await nodes()
    if (find(list, text)) return list
    await pause(300)
  }
  throw new Error(`Missing native label: ${text}`)
}
async function command(name) {
  await tap(`history:${name}`)
  await wait(`PASS ${name}`)
  const raw = await adb('shell', 'run-as', pkg, 'cat', `files/history-${name}.json`)
  const report = JSON.parse(raw)
  assert(report.ok, report.error)
  await writeFile(`${out}/${name}.json`, raw)
}
await command('seed')
await tap('menu-back:inbox', true)
assert(find(await nodes('long-press-menu'), 'item · visit 2'))
assert(find(await nodes(), 'item · visit 4'))
await adb('shell', 'input', 'keyevent', '4')
await command('unchanged')
await tap('inbox · /last')
await adb('shell', 'input', 'keycombination', 'KEYCODE_CTRL_LEFT', 'KEYCODE_H')
await wait('item · visit 2')
await adb('shell', 'input', 'keyevent', '111')
await command('unchanged')
await command('guard')
await tap('menu-open:inbox')
await tap('item · visit 2')
await command('refused')
await tap('menu-back:inbox', true)
// Popup's own keyboard navigation chooses the older duplicate (third row).
await adb('shell', 'input', 'keyevent', '20', '20', '20', '66')
await command('selected')
await command('invalidate')
await command('dispose')
console.log(
  'Android Back history menu: long press, hardware Back, Ctrl H, Escape, arrows/Enter, guard, exact duplicate, concurrency and disposal passed',
)
