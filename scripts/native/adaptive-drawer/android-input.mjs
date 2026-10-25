import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { adb, command, initialize, out, pause, serial } from './bridge.mjs'

assert(serial, 'Android only')
await initialize()
const dumpPath = '/sdcard/adaptive-window.xml'
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
async function nodes() {
  const xml = await dump()
  await writeFile(`${out}/window.xml`, xml)
  return [...xml.matchAll(/<node\s+([^>]+)/g)].map((match) =>
    Object.fromEntries(
      [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
    ),
  )
}
async function find(text) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const item = (await nodes()).find(
      (node) =>
        node.text.toLowerCase() === text.toLowerCase() ||
        node['content-desc'].toLowerCase() === text.toLowerCase(),
    )
    if (item) return item
    await pause(300)
  }
  throw new Error(`Missing native input target: ${text}`)
}
async function tap(text) {
  const item = await find(text)
  const [left, top, right, bottom] = item.bounds.match(/\d+/g).map(Number)
  await adb(
    'shell',
    'input',
    'tap',
    String((left + right) >> 1),
    String((top + bottom) >> 1),
  )
  await pause(500)
}
await tap('permanent')
await tap('Push detail')
assert(
  (await nodes()).some((node) => node.text === 'route /detail'),
  'Permanent pane intercepted a content tap',
)
await tap('Retained draft')
await adb('shell', 'input', 'text', 'native%sdraft')
await adb('shell', 'input', 'keyevent', '4') // dismiss keyboard
await command('remember')
await tap('Settings stack')
assert((await nodes()).some((node) => node.text === 'route /settings'))
await tap('Home stack')
assert((await nodes()).some((node) => node.text === 'native draft'))
await tap('overlay')
assert(!(await nodes()).some((node) => node.text === 'Destinations'))
await tap('Menu')
assert(
  !(await nodes()).some((node) => node.text === 'Push detail'),
  'Covered content remains accessible',
)
await tap('permanent')
assert((await nodes()).some((node) => node.text === 'Push detail'))
await tap('RTL')
await tap('Settings stack')
await tap('Home stack')
assert((await nodes()).some((node) => node.text === 'native draft'))
await tap('LTR')
await adb('shell', 'input', 'keyevent', '4')
assert(
  (await nodes()).some((node) => node.text === 'route /'),
  'Permanent pane stole system Back',
)
const shot = await promisify(execFile)(
  'adb',
  ['-s', serial, 'exec-out', 'screencap', '-p'],
  { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 },
)
await writeFile(
  `${out}/native-input.png`,
  shot.stdout.subarray(
    shot.stdout.indexOf(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  ),
)
console.log(
  'Native Android input, retained draft, accessibility reachability and Back passed',
)
