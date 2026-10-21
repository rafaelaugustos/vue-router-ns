// Build: cd demo && ns build android --env.drawerTest
// Run: ANDROID_SERIAL=<serial> node scripts/native/drawer-android.mjs
// This clears the installed fixture app's data. Device settings are restored.
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { resolve } from 'node:path'

const exec = promisify(execFile)
const serial = process.env.ANDROID_SERIAL
if (!serial) throw new Error('Set ANDROID_SERIAL to the device to test.')
const out = resolve(process.env.OUT ?? `scripts/native/out/drawer-${serial}`)
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
const settings = []
let currentCheck = 'Launch the fixture'
async function setting(group, name, value) {
  settings.push([group, name, await adb('shell', 'settings', 'get', group, name)])
  await adb('shell', 'settings', 'put', group, name, String(value))
}
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
  await adb('shell', 'rm', '-f', '/sdcard/drawer-window.xml')
  const result = await adb(
    'shell',
    'uiautomator',
    'dump',
    '--compressed',
    '/sdcard/drawer-window.xml',
  )
  if (!result.includes('dumped to:')) return []
  return nodes(await adb('shell', 'cat', '/sdcard/drawer-window.xml'))
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
async function capture(name) {
  const shot = await exec('adb', ['-s', serial, 'exec-out', 'screencap', '-p'], {
    encoding: 'buffer',
    maxBuffer: 16 * 1024 * 1024,
  })
  await writeFile(`${out}/${name}.png`, shot.stdout)
  await adb('shell', 'uiautomator', 'dump', '--compressed', '/sdcard/drawer-window.xml')
  await writeFile(
    `${out}/${name}.xml`,
    await adb('shell', 'cat', '/sdcard/drawer-window.xml'),
  )
}
async function check(name, action) {
  currentCheck = name
  await action()
  results.push({ name, status: 'passed' })
  console.log(`PASS ${name}`)
}
const back = async () => {
  await adb('shell', 'input', 'keyevent', '4')
  await sleep(700)
}
const open = async () => {
  await tap('MENU')
  return wait('Drawer destinations')
}
const close = async () => {
  await back()
  return wait('Drawer destinations', true)
}
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

try {
  await setting('system', 'accelerometer_rotation', 0)
  await setting('system', 'user_rotation', 0)
  await adb('shell', 'am', 'force-stop', pkg)
  await adb('shell', 'pm', 'clear', pkg)
  await adb('shell', 'am', 'start', '-n', activity)
  await wait('Drawer home')
  await check(
    'ActionBar opens the native drawer and hides covered content from accessibility',
    async () => {
      const list = await open()
      assert(
        !list.some((node) => node.text === 'Push detail'),
        'Covered page remains in the accessibility tree',
      )
      const destination = list.find((node) => node.text.toLowerCase() === 'go settings')
      assert(
        destination?.clickable === 'true' && destination.focusable === 'true',
        'Destination is not actionable',
      )
      await capture('01-open')
    },
  )
  await check('Back closes the drawer without changing the root page', async () => {
    await close()
    await wait('route /')
  })
  const sdk = Number(await adb('shell', 'getprop', 'ro.build.version.sdk'))
  const size = await adb('shell', 'wm', 'size')
  const [width, height] = [...size.matchAll(/(\d+)x(\d+)/g)].at(-1).slice(1).map(Number)
  if (sdk < 29)
    await check('The native start-edge drag opens the drawer', async () => {
      await adb(
        'shell',
        'input',
        'swipe',
        '2',
        String(height / 2),
        String(width * 0.65),
        String(height / 2),
        '500',
      )
      await wait('Drawer destinations')
      await close()
    })
  await check('A drawer destination navigates and closes the pane', async () => {
    await open()
    await tap('Go detail')
    await wait('Drawer detail')
    await wait('Drawer destinations', true)
    await wait('history / > /detail')
  })
  await check('A blocked navigation leaves its drawer and page in place', async () => {
    await tap('Block leaving')
    await open()
    await tap('Go home')
    await wait('Drawer destinations')
    await close()
    await wait('route /detail')
    await tap('Unblock leaving')
  })
  await check('Rotation preserves an open drawer and the detail page', async () => {
    await tap('Draft')
    await adb('shell', 'input', 'text', 'drawer-state')
    await back()
    await open()
    await adb('shell', 'settings', 'put', 'system', 'user_rotation', '1')
    await sleep(2000)
    await wait('Drawer destinations')
    await capture('02-landscape')
    await close()
    await wait('history / > /detail')
    await wait('drawer-state')
    await adb('shell', 'settings', 'put', 'system', 'user_rotation', '0')
    await sleep(2000)
  })
  await check('Three destination stacks retain their histories', async () => {
    await open()
    await tap('Go settings')
    await wait('Drawer settings')
    await tap('Account')
    await wait('Drawer account')
    await tap('Home')
    await wait('Drawer detail')
    await wait('drawer-state')
  })
  await check('RTL puts the drawer on the right and preserves navigation', async () => {
    await tap('Use RTL')
    const list = await open()
    const pane = list.find((node) => node.text === 'Drawer destinations')
    assert(
      Number(pane.bounds.match(/\d+/)[0]) > 0,
      `RTL drawer is on the left: ${pane.bounds}`,
    )
    await capture('04-rtl')
    await close()
    if (sdk < 29) {
      await adb(
        'shell',
        'input',
        'swipe',
        String(width - 2),
        String(height / 2),
        String(width * 0.35),
        String(height / 2),
        '500',
      )
      await wait('Drawer destinations')
      await close()
    }
    await wait('history / > /detail')
    await wait('drawer-state')
    await tap('Use LTR')
  })
  await check('Back dismisses the modal before the drawer behind it', async () => {
    await open()
    await tap('Keep drawer under modal')
    await wait('Drawer modal')
    await back()
    await wait('Drawer destinations')
    await close()
    await wait('Drawer detail')
    await wait('modal result undefined')
  })
  await check('A modal guard still vetoes Back above an open drawer', async () => {
    await open()
    await tap('Keep drawer under modal')
    await wait('Drawer modal')
    await tap('Block leaving')
    await back()
    await wait('Drawer modal')
    await tap('Unblock leaving')
    await tap('Return result')
    await wait('Drawer destinations')
    await close()
    await wait('modal result accepted')
  })
  await check('A Material sheet takes Back before the drawer', async () => {
    await open()
    await tap('Keep drawer under sheet')
    await wait('Drawer modal')
    const list = await read()
    assert(
      list.some((node) => node['resource-id'].endsWith('design_bottom_sheet')),
      'Material sheet missing',
    )
    await capture('03-sheet')
    await back()
    await wait('Drawer destinations')
    await close()
    await wait('Drawer detail')
  })
  await check(
    'The drawer does not prevent page restoration after process death',
    async () => {
      await open()
      const before = await adb('shell', 'pidof', pkg)
      await adb('shell', 'input', 'keyevent', '3')
      await sleep(2500)
      await adb('shell', 'am', 'kill', pkg)
      await sleep(1500)
      let dead = await adb('shell', 'pidof', pkg).catch(() => '')
      // Some Android 8 builds retain the previous app above the cached
      // priority that `am kill` targets. Kill only this debuggable app's
      // own PID, without force-stopping its task or clearing saved state.
      if (dead === before && /^\d+$/.test(dead)) {
        await adb('shell', 'run-as', pkg, 'kill', '-9', dead)
        await sleep(1500)
        dead = await adb('shell', 'pidof', pkg).catch(() => '')
      }
      assert(!dead, `Process ${before} did not die`)
      await adb('shell', 'am', 'start', '-n', activity)
      await wait('Drawer detail')
      await wait('drawer-state')
      await wait('history / > /detail')
      assert((await adb('shell', 'pidof', pkg)) !== before, 'PID did not change')
      await wait('Drawer destinations', true)
      await capture('05-restored')
    },
  )
  await check('Keyboard Tab and Enter activate a drawer destination', async () => {
    await open()
    let focused = false
    for (let attempt = 0; attempt < 10; attempt++) {
      await adb('shell', 'input', 'keyevent', '61')
      const list = await read()
      focused = list.some(
        (node) => node.text === 'Go settings' && node.focused === 'true',
      )
      if (focused) break
    }
    assert(focused, 'Tab did not reach Go settings')
    await adb('shell', 'input', 'keyevent', '66')
    await wait('Drawer settings')
    await wait('Drawer destinations', true)
  })
  await check('An OS deep link selects its tab and closes an open drawer', async () => {
    await open()
    await adb(
      'shell',
      'am',
      'start',
      '-n',
      activity,
      '-a',
      'android.intent.action.VIEW',
      '-d',
      'vuerouterns://detail',
    )
    await wait('Drawer detail')
    await wait('Drawer destinations', true)
    await wait('drawer-state')
  })
} catch (error) {
  results.push({ name: currentCheck, status: 'failed', error: error.message })
  await capture('failure').catch(() => {})
  console.error(error)
  process.exitCode = 1
} finally {
  for (const [group, name, value] of settings.reverse()) {
    try {
      await adb(
        'shell',
        'settings',
        value === 'null' ? 'delete' : 'put',
        group,
        name,
        ...(value === 'null' ? [] : [value]),
      )
    } catch (error) {
      results.push({ name: `Restore ${name}`, status: 'failed', error: error.message })
      console.error(`Could not restore ${group}.${name} to ${value}: ${error.message}`)
      process.exitCode = 1
    }
  }
  await writeFile(`${out}/results.json`, JSON.stringify({ serial, results }, null, 2))
  console.log(`Evidence: ${out}`)
}
