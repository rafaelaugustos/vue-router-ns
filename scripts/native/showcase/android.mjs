import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const exec = promisify(execFile),
  serial = process.env.ANDROID_SERIAL
assert(serial, 'Set ANDROID_SERIAL to a dedicated emulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/showcase-android'),
  pkg = 'org.nativescript.vuerouterns'
await mkdir(out, { recursive: true })
const adb = async (...args) =>
  (
    await exec('adb', ['-s', serial, ...args], {
      timeout: 60000,
      maxBuffer: 16 * 1024 * 1024,
    })
  ).stdout
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
let sequence = 0
async function nodes() {
  await adb('shell', 'uiautomator', 'dump', '--compressed', '/sdcard/showcase.xml')
  const xml = await adb('shell', 'cat', '/sdcard/showcase.xml')
  await writeFile(`${out}/${++sequence}.xml`, xml)
  return [...xml.matchAll(/<node\b[^>]*>/g)].map(([tag]) =>
    Object.fromEntries(
      [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]),
    ),
  )
}
const find = (list, text) =>
  list.findLast((n) =>
    [n.text, n['content-desc'], n['resource-id']].some(
      (v) => v?.toLowerCase() === text.toLowerCase(),
    ),
  )
const point = (n) => {
  assert(n, 'Missing native target')
  const [l, t, r, b] = n.bounds.match(/\d+/g).map(Number)
  return [String((l + r) >> 1), String((t + b) >> 1)]
}
async function tap(text, long = false) {
  const xy = point(find(await nodes(), text))
  await adb(
    'shell',
    'input',
    ...(long ? ['swipe', ...xy, ...xy, '1000'] : ['tap', ...xy]),
  )
  await pause(250)
}
async function wait(text) {
  for (let i = 0; i < 5; i++) {
    const list = await nodes()
    if (find(list, text)) return list
    await pause(300)
  }
  throw Error(`Missing native label: ${text}`)
}
async function shot(name) {
  const r = await exec('adb', ['-s', serial, 'exec-out', 'screencap', '-p'], {
    encoding: 'buffer',
    maxBuffer: 16 * 1024 * 1024,
  })
  await writeFile(`${out}/${name}.png`, r.stdout)
}
const reduced = process.env.REDUCED_MOTION === '1'
const previousScale = (
  await adb('shell', 'settings', 'get', 'global', 'animator_duration_scale')
).trim()
if (reduced)
  await adb('shell', 'settings', 'put', 'global', 'animator_duration_scale', '0')
try {
  await adb(
    'install',
    '-r',
    process.env.ANDROID_APP ??
      'demo/platforms/android/app/build/outputs/apk/debug/app-debug.apk',
  )
  await adb('shell', 'am', 'force-stop', pkg)
  await adb('shell', 'am', 'start', '-n', `${pkg}/com.tns.NativeScriptActivity`)
  await wait('Your next small discovery')
  await tap('Menu')
  await tap('About destination')
  await wait('Built on native navigation')
  await tap('Return to library')
  await tap('Search')
  const field = (await nodes()).find((n) =>
    n['resource-id']?.endsWith(':id/search_src_text'),
  )
  assert(field, 'Native SearchView input')
  await adb('shell', 'input', 'tap', ...point(field))
  await adb('shell', 'input', 'text', 'coast')
  await wait('Search: coast')
  await adb('shell', 'input', 'keyevent', '4') // keyboard only
  await tap('FIELD JOURNAL', true)
  await tap('Star note')
  await wait('Starred')
  await shot('context-action')
  await tap('Open coast')
  await wait('Review in a modal')
  await tap('Unstar')
  await wait('Not starred')
  await tap('Review in a modal')
  await wait('A moment to reflect')
  await tap('Mark as reviewed')
  await wait('Reviewed today')
  await shot('modal-result')
  await tap('Edit')
  await wait('Make it yours')
  await tap('Note draft')
  await adb('shell', 'input', 'text', '%sA%snew%sdiscovery.')
  await adb('shell', 'input', 'keyevent', '4') // hide editor keyboard
  await adb('shell', 'input', 'keyevent', '4') // guarded native Back
  await tap('Keep editing')
  await wait('Unsaved changes — leaving asks first.')
  await tap('Menu')
  await tap('Library destination')
  await tap('Keep editing')
  await wait('Library destination')
  await adb('shell', 'input', 'keyevent', '4') // drawer consumes Back
  await tap('Save')
  await wait('Reviewed today')
  await shot('saved-detail')
  await adb('shell', 'input', 'keyevent', '4')
  const last = await wait('Search: coast')
  assert(!find(last, 'Open forest'), 'Search retained after native Back')
  await shot('retained-search')
  const report = JSON.parse(
    await adb('shell', 'run-as', pkg, 'cat', 'files/showcase.json'),
  )
  report.animatorDurationScale = (
    await adb('shell', 'settings', 'get', 'global', 'animator_duration_scale')
  ).trim()
  if (reduced) assert.equal(report.animatorDurationScale, '0')
  const final = report.snapshots.at(-1)
  assert.equal(final.route, '/')
  assert.equal(
    final.snapshot.stacks[0].logical[0].id,
    report.initialRoot,
    'Original root entry retained',
  )
  assert.deepEqual(final.snapshot.issues, [])
  assert(report.notes.find((n) => n.id === 'coast').body.includes('A new discovery.'))
  assert.equal(
    report.notes.find((n) => n.id === 'forest').starred,
    false,
    'Context action belongs to selected item',
  )
  await writeFile(`${out}/results.json`, JSON.stringify(report, null, 2))
  console.log(
    'Android showcase: drawer, native search, item menu, shared header action, modal result, guard refusal, save, root identity and query retention passed',
  )
} finally {
  if (reduced)
    await adb(
      'shell',
      'settings',
      previousScale === 'null' ? 'delete' : 'put',
      'global',
      'animator_duration_scale',
      ...(previousScale === 'null' ? [] : [previousScale]),
    )
}
