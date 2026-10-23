// Drive the real Android document picker; install --env.flowsTest first.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const exec = promisify(execFile)
const serial = process.env.ANDROID_SERIAL ?? 'emulator-5580'
const out = resolve(process.env.OUT ?? 'scripts/native/out/flows-android')
const pkg = 'org.nativescript.vuerouterns'
const activity = `${pkg}/com.tns.NativeScriptActivity`
await mkdir(out, { recursive: true })
const adb = async (...args) =>
  (
    await exec('adb', ['-s', serial, ...args], {
      timeout: 30000,
      maxBuffer: 8 * 1024 * 1024,
    })
  ).stdout
const pause = (ms = 300) => new Promise((done) => setTimeout(done, ms))
const checks = []
let runtime = ''
let activePid = ''
async function logs() {
  runtime = await adb('logcat', '-d', '-v', 'brief', '-s', 'JS', 'AndroidRuntime')
  assert(!runtime.includes('FLOW_FATAL'), runtime.slice(-6000))
  return runtime
}
async function until(test, label, timeout = 30000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await test()) return
    await pause()
  }
  throw new Error(`Timed out: ${label}`)
}
const resultLines = () =>
  runtime
    .split('\n')
    .filter((l) => l.includes('FLOW_RESULT '))
    .map((l) => JSON.parse(l.slice(l.indexOf('FLOW_RESULT ') + 12)))
    .filter((result) => String(result.pid) === activePid)
async function count(name) {
  await logs()
  return resultLines().filter((r) => r.name === name).length
}
async function outcome(name, previous = 0) {
  await until(async () => (await count(name)) > previous, name)
  const result = resultLines()
    .filter((r) => r.name === name)
    .at(-1)
  checks.push(result)
  console.log(`${name}: passed (pid ${result.pid})`)
  return result
}
async function ui() {
  await adb('shell', 'uiautomator', 'dump', '/sdcard/flow-ui.xml')
  return adb('shell', 'cat', '/sdcard/flow-ui.xml').catch(() => '')
}
async function tap(text) {
  const xml = await ui()
  const node = (xml.match(/<node\b[^>]*>/g) ?? []).find(
    (node) => node.includes(`text="${text}"`) || node.includes(`content-desc="${text}"`),
  )
  if (!node) return false
  const coords = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node)
  assert(coords, node)
  await adb(
    'shell',
    'input',
    'tap',
    String(Math.round((+coords[1] + +coords[3]) / 2)),
    String(Math.round((+coords[2] + +coords[4]) / 2)),
  )
  return true
}
async function picker() {
  await until(
    async () => (await ui()).includes('documentsui'),
    'system document picker',
    45000,
  )
}
async function selectDocument() {
  await picker()
  if (!(await tap('router-flow-sample.txt'))) {
    assert(await tap('Show roots'), 'Open picker locations')
    assert(await tap('Downloads'), 'Downloads location')
    await until(() => tap('router-flow-sample.txt'), 'fixture document')
  }
}
async function command(name) {
  // Result delivery can precede DocumentsUI's exit animation and Activity resume.
  await until(async () => {
    const xml = await ui()
    return xml.includes(`package="${pkg}"`) && !xml.includes('documentsui')
  }, `origin visible before ${name}`)
  await adb(
    'shell',
    'am',
    'start',
    '--activity-single-top',
    '-n',
    activity,
    '--es',
    'flowCommand',
    name,
  )
}
const back = () => adb('shell', 'input', 'keyevent', '4')
async function start() {
  await adb('shell', 'am', 'force-stop', pkg)
  await adb('shell', 'am', 'start', '-W', '-n', activity)
  const pid = (await adb('shell', 'pidof', pkg)).trim()
  activePid = pid
  await until(async () => (await logs()).includes(`FLOW_READY ${pid}`), 'fixture ready')
  return pid
}
async function capture(name) {
  await writeFile(resolve(out, `${name}.xml`), await ui())
  const shot = await exec('adb', ['-s', serial, 'exec-out', 'screencap', '-p'], {
    encoding: 'buffer',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 30000,
  })
  const start = shot.stdout.indexOf(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  assert(start >= 0)
  await writeFile(resolve(out, `${name}.png`), shot.stdout.subarray(start))
}
try {
  await adb('shell', 'am', 'force-stop', pkg)
  await adb('shell', 'pm', 'clear', pkg)
  await adb('logcat', '-c')
  const document = resolve(out, 'router-flow-sample.txt')
  await writeFile(document, 'Native flow acceptance document\n')
  await adb('push', document, '/sdcard/Download/router-flow-sample.txt')
  await exec('bash', ['-c', 'source scripts/native/ui.sh; prepare_home'], {
    env: { ...process.env, ADB: 'adb', ANDROID_SERIAL: serial, OUT: out },
    timeout: 150000,
  })
  await start()
  await command('guard')
  await outcome('guard:guard')
  await command('pick')
  await picker()
  await capture('system-picker')
  await back()
  await outcome('pick:user')
  await command('pick')
  await selectDocument()
  await outcome('pick:completed')
  await command('pick')
  await picker()
  await adb('shell', 'wm', 'user-rotation', 'lock', '1')
  await selectDocument()
  await outcome('pick:completed', 1)
  await adb('shell', 'wm', 'user-rotation', 'lock', '0')
  await command('concurrent')
  await picker()
  await pause(1200)
  await back()
  await picker()
  await back()
  await outcome('concurrent-second:user')
  await outcome('concurrent-first:user')
  await command('dispose')
  await picker()
  await outcome('dispose:disposed')
  await selectDocument()
  await until(async () => (await ui()).includes('Flow home'), 'origin page removed')
  await logs()
  assert.equal(
    resultLines().filter((result) => result.name.startsWith('dispose:')).length,
    1,
    'A result after parent disposal must not settle the flow again',
  )
  await capture('disposed-origin')
  await start()
  // On smaller phones the modal button is below the viewport. Send the fixture
  // command before opening it; use a real tap inside the modal so am start does
  // not bring the underlying Activity forward and dismiss the dialog.
  await command('modal')
  await pause(1200)
  await until(() => tap('pick'), 'modal picker button')
  await picker()
  await back()
  await outcome('pick:user')
  await start()
  await command('recreate')
  await picker()
  // The router retains the originating page during Activity recreation, so
  // the pending system result must rebind and complete rather than be disposed.
  await until(async () => {
    await logs()
    const created = runtime
      .split('\n')
      .filter((line) => line.includes('FLOW_OWNER_CREATED '))
      .at(-1)
      ?.split('FLOW_OWNER_CREATED ')[1]
    const original = runtime
      .split('\n')
      .findLast((line) => line.includes('FLOW_OWNER '))
      ?.split('FLOW_OWNER ')[1]
    return created && original && created !== original
  }, 'replacement Activity while picker remains open')
  assert.equal(
    await count('recreate:disposed'),
    0,
    'Retained page keeps its pending flow',
  )
  await logs()
  const owners = runtime
    .split('\n')
    .filter((l) => l.includes('FLOW_OWNER_CREATED '))
    .map((l) => l.split('FLOW_OWNER_CREATED ')[1])
  const original = runtime
    .split('\n')
    .findLast((l) => l.includes('FLOW_OWNER '))
    .split('FLOW_OWNER ')[1]
  assert.notEqual(owners.at(-1), original, 'Activity must actually be recreated')
  await selectDocument()
  await outcome('recreate:completed')
  await pause(700)
  assert.equal(
    await count('recreate:completed'),
    1,
    'Rebound result settles exactly once',
  )
  assert.equal(
    await count('recreate:disposed'),
    0,
    'Recreation does not dispose retained pages',
  )
  const before = await start()
  await command('pick')
  await picker()
  // The system picker covers the app; kill only its debuggable process, retain the task.
  await adb('shell', 'run-as', pkg, 'kill', '-9', before)
  await until(async () => {
    try {
      return !(await adb('shell', 'pidof', pkg)).trim()
    } catch {
      return true
    }
  }, 'old process absent')
  await selectDocument()
  await until(async () => {
    try {
      const now = (await adb('shell', 'pidof', pkg)).trim()
      if (!now || now === before) return false
      activePid = now
      return true
    } catch {
      return false
    }
  }, 'system result recreates process')
  const recovery = await outcome('recovery:orphan')
  assert.equal(String(recovery.pid), activePid)
  assert.equal(recovery.outcome.previous, `${before}:pick`)
  await until(
    async () => (await logs()).includes(`FLOW_READY ${recovery.pid}`),
    'new page ready',
  )
  const cancels = await count('pick:user')
  await command('pick')
  await picker()
  await back()
  await outcome('pick:user', cancels)
  await command('close')
  await picker()
  await outcome('close:disposed')
  await back()
  console.log(`Passed ${checks.length} native flow outcomes`)
} catch (error) {
  await capture('failure').catch(() => {})
  throw error
} finally {
  await writeFile(resolve(out, 'results.json'), JSON.stringify(checks, null, 2) + '\n')
  await writeFile(
    resolve(out, 'runtime.log'),
    await adb('logcat', '-d', '-v', 'brief', '-s', 'JS', 'AndroidRuntime'),
  )
  await adb('shell', 'wm', 'user-rotation', 'free').catch(() => {})
}
