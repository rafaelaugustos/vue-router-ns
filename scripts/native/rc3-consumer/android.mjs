import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, mkdir } from 'node:fs/promises'
const exec = promisify(execFile),
  serial = process.env.ANDROID_SERIAL || 'emulator-5560',
  pkg = 'org.nativescript.routerrc3validation',
  out = process.env.CONSUMER_REPORT || '/tmp/router-consumer-android'
await mkdir(out, { recursive: true })
const adb = async (...args) =>
  (
    await exec('adb', ['-s', serial, ...args], {
      maxBuffer: 16 * 1024 * 1024,
      timeout: 60000,
    })
  ).stdout
let count = 0
async function nodes() {
  await adb('shell', 'uiautomator', 'dump', '--compressed', '/sdcard/tutorial.xml')
  const xml = await adb('shell', 'cat', '/sdcard/tutorial.xml')
  await writeFile(`${out}/${++count}.xml`, xml)
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
async function wait(text) {
  for (let i = 0; i < 5; i++) {
    const list = await nodes()
    if (find(list, text)) return list
  }
  throw Error('Missing ' + text)
}
async function tap(text) {
  const n = find(await wait(text), text)
  const [l, t, r, b] = n.bounds.match(/\d+/g).map(Number)
  await adb('shell', 'input', 'tap', String((l + r) >> 1), String((t + b) >> 1))
}
const back = () => adb('shell', 'input', 'keyevent', '4')
// Install the consumer APK before running this script.
await adb('shell', 'am', 'force-stop', pkg)
await adb('shell', 'am', 'start', '-n', `${pkg}/com.tns.NativeScriptActivity`)
await wait('Published rc.3 · consumer acceptance')
await tap('Find a note')
await adb('shell', 'input', 'text', 'coast')
await back()
assert(!find(await nodes(), 'Into the forest'))
await tap('Along the coast')
await wait('A quiet path beside the sea.')
await tap('Edit in a modal')
await tap('Note draft')
await adb('shell', 'input', 'text', '%sNew%sidea.')
await back()
await wait('Unsaved changes')
const draft = (await nodes()).find((n) => n.class === 'android.widget.EditText')?.text
assert(draft?.includes('New idea.'))
await tap('Cancel')
await tap('Keep editing')
await wait('Unsaved changes')
await tap('Save note')
await wait(draft)
await back()
await wait('coast')
assert(!find(await nodes(), 'Into the forest'))
await tap('Along the coast')
await tap('Edit in a modal')
await tap('Note draft')
await adb('shell', 'input', 'text', '%sDiscard%sme.')
await back()
await tap('Cancel')
await tap('Discard')
await wait(draft)
await writeFile(
  `${out}/checks.json`,
  JSON.stringify(
    {
      platform: 'Android API 36',
      input: 'adb/UIAutomator',
      saved: draft,
      checks: [
        'retained query',
        'native modal',
        'guard refusal',
        'saved result',
        'discard preserves saved value',
      ],
    },
    null,
    2,
  ),
)
console.log(
  'Android rc.3 consumer: native input, query retention, guard refusal, saved result and discard passed',
)
