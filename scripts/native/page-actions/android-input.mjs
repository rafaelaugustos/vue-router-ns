import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { adb, command, initialize, out, pause, serial } from './bridge.mjs'

assert(serial, 'Android only')
await initialize()
const dumpPath = '/sdcard/actions-window.xml'
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
      node['content-desc'].toLowerCase() === text.toLowerCase(),
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
await tap('Save')
await wait('Saved 1 · errors 0')
await tap('Disable save')
assert.equal(find(await nodes(), 'Save').enabled, 'false')
await tap('Hold for actions', true)
assert.equal(find(await nodes('disabled-menu'), 'Save').enabled, 'false')
await adb('shell', 'input', 'keyevent', '4')
await tap('Enable save')
await tap('Rename save')
await tap('Hold for actions', true)
assert.equal(find(await nodes('localized-menu'), 'Salvar').enabled, 'true')
await tap('Salvar')
await wait('Saved 2 · errors 0')
await tap('Hide save')
assert(!find(await nodes(), 'Salvar'))
await tap('Show save')
await tap('Salvar')
await wait('Saved 3 · errors 0')
await tap('Legacy')
await wait('Marked none · legacy 1')
await tap('Hold for actions', true)
await tap('Delete')
await wait('Saved 3 · errors 1')
await wait('Error: Demo delete failure')
await tap('Hold for actions', true)
await tap('Inspect')
await wait('route /modal')
await tap('Block leaving')
await tap('Done')
assert.equal((await command('snapshot')).current, '/modal')
await tap('Unblock leaving')
await tap('Done')
await wait('Result accepted')
const list = await nodes()
const reuse = point(find(list, 'Reuse row soon')),
  row = point(find(list, 'Row A'))
await adb('shell', 'input', 'tap', ...reuse)
await adb('shell', 'input', 'swipe', ...row, ...row, '900')
await pause(5000)
assert(!find(await nodes(), 'Mark A'), 'A rebound row kept its stale native menu')
await tap('Row B', true)
await tap('Mark B')
await wait('Marked B · legacy 1')
const report = await command('snapshot')
assert.equal(
  report.captures[0].started,
  3,
  'A native header dispatched duplicate callbacks',
)
assert.equal(report.captures[0].saved, 3)
assert.equal(report.captures[0].errors, 1)
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
  'Native Android header/menu input, shared state, errors, guards, modal result and row rebinding passed',
)
