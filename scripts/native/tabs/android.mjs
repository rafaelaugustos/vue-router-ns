// Build: cd demo && ns build android --env.tabsTest
// Run: ANDROID_SERIAL=<serial> node scripts/native/tabs/android.mjs
// This clears only the installed fixture app's data on the selected test device.
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { resolve } from 'node:path'

const exec = promisify(execFile)
const serial = process.env.ANDROID_SERIAL
if (!serial) throw new Error('Set ANDROID_SERIAL to the device to test.')
const out = resolve(process.env.OUT ?? `scripts/native/out/tabs-${serial}`)
await mkdir(out, { recursive: true })
const pkg = 'org.nativescript.vuerouterns'
const activity = `${pkg}/com.tns.NativeScriptActivity`
const adb = async (...args) =>
  (
    await exec('adb', ['-s', serial, ...args], {
      maxBuffer: 16 * 1024 * 1024,
      timeout: 60000,
    })
  ).stdout.trim()
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const results = []
function nodes(xml) {
  return [...xml.matchAll(/<node\s+([^>]+)/g)].map((match) =>
    Object.fromEntries(
      [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [
        key,
        value.replaceAll('&gt;', '>').replaceAll('&amp;', '&'),
      ]),
    ),
  )
}
async function read() {
  await adb('shell', 'rm', '-f', '/sdcard/tabs-window.xml')
  const result = await adb(
    'shell',
    'uiautomator',
    'dump',
    '--compressed',
    '/sdcard/tabs-window.xml',
  )
  if (!result.includes('dumped to:')) return []
  return nodes(await adb('shell', 'cat', '/sdcard/tabs-window.xml'))
}
async function wait(text, absent = false) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const list = await read()
    if (list.length && list.some((node) => node.text === text) !== absent) return list
    await sleep(500)
  }
  throw new Error(`${absent ? 'Still showing' : 'Missing'}: ${text}`)
}
async function tap(text) {
  const node = (await read()).find(
    (item) =>
      item.text.toLowerCase() === text.toLowerCase() ||
      item['content-desc'].toLowerCase() === text.toLowerCase(),
  )
  if (!node) throw new Error(`Cannot tap ${text}`)
  const [left, top, right, bottom] = node.bounds.match(/\d+/g).map(Number)
  await adb(
    'shell',
    'input',
    'tap',
    String((left + right) >> 1),
    String((top + bottom) >> 1),
  )
  await sleep(700)
}

try {
  await adb('shell', 'am', 'force-stop', pkg)
  await adb('shell', 'pm', 'clear', pkg)
  await adb('shell', 'am', 'start', '-W', '-n', activity)
  await wait('/a')
  const page = async (text) => {
    await wait(text)
    results.push(text)
    console.log(`PASS ${text}`)
  }
  await tap('Push detail')
  await page('/a/detail')
  await tap('B')
  await page('/b')
  await tap('Push detail')
  await page('/b/detail')
  await tap('A')
  await page('/a/detail')
  await tap('B')
  await page('/b/detail')
  await tap('Select A')
  await page('/a/detail')
  await tap('Select B')
  await page('/b/detail')
  await tap('Select A')
  await tap('Deep link B')
  await page('/b/detail')
  await wait('reselects:0')
  await tap('Toggle veto')
  await tap('A')
  await page('/b/detail')
  await tap('Toggle veto')
  await tap('Toggle guard')
  await tap('B')
  await page('/b/detail')
  await tap('Toggle guard')
  await tap('B')
  await page('/b')
  await tap('A')
  await page('/a/detail')
  await tap('A')
  await page('/a')
  await tap('C')
  await page('/c')
  await tap('Push detail')
  await page('/c/detail')
  await tap('C')
  await page('/c/detail')
  await tap('A')
  await tap('C')
  await page('/c/detail')
  await wait('reselects:4')
  await tap('Snapshot')
  await writeFile(
    `${out}/results.json`,
    JSON.stringify({ status: 'passed', pages: results }, null, 2),
  )
  console.log(`PASS native tab switching/reselection (${results.length} page checks)`)
} finally {
  await writeFile(`${out}/hierarchy.json`, JSON.stringify(await read(), null, 2))
  await adb('shell', 'am', 'force-stop', pkg)
}
