import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { recordEnvironment } from '../contracts/environment.mjs'
const exec = promisify(execFile)
const serial = process.env.ANDROID_SERIAL
assert(serial, 'Set ANDROID_SERIAL to a dedicated emulator')
const mode = process.env.PREVIEW_MODE ?? 'core'
assert(['core', 'legacy'].includes(mode))
const out = resolve(process.env.OUT ?? `scripts/native/out/predictive-${mode}`)
const pkg = 'org.nativescript.vuerouterns'
const activity = `${pkg}/com.tns.NativeScriptActivity`
const adb = async (...args) =>
  (
    await exec('adb', ['-s', serial, ...args], {
      timeout: 60000,
      maxBuffer: 12 * 1024 * 1024,
    })
  ).stdout
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
await mkdir(out, { recursive: true })
const reports = []
let pid
let seq = 0
async function until(test, label, timeout = 30000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const value = await test()
    if (value) return value
    await pause(150)
  }
  throw new Error(`Timeout: ${label}`)
}
async function read() {
  try {
    return JSON.parse(await adb('shell', 'run-as', pkg, 'cat', 'files/predictive.json'))
  } catch {
    return undefined
  }
}
async function result(command) {
  const report = await until(
    async () => {
      const value = await read()
      return value?.command === command &&
        String(value.pid) === pid &&
        value.sequence > seq
        ? value
        : undefined
    },
    command,
    command === 'memory' ? 60000 : 30000,
  )
  seq = report.sequence
  reports.push(report)
  await writeFile(
    resolve(out, `${reports.length}-${command}.json`),
    JSON.stringify(report, null, 2),
  )
  assert.equal(report.ok, true, report.error)
  console.log(`${serial} ${mode}: ${command} passed`)
  return report
}
async function command(name) {
  await adb('shell', 'am', 'start', '-n', activity, '--es', 'predictiveCommand', name)
  return result(name)
}
async function screenshot(name, touch = false) {
  const args = touch
    ? ['exec-out', 'run-as', 'org.nativescript.contracttouch', 'cat', 'files/gesture.png']
    : ['exec-out', 'screencap', '-p']
  const image = await exec('adb', ['-s', serial, ...args], {
    encoding: 'buffer',
    maxBuffer: 10 * 1024 * 1024,
  })
  await writeFile(resolve(out, `${name}.png`), image.stdout)
}
async function swipe(name, commit) {
  const size = [...(await adb('shell', 'wm', 'size')).matchAll(/(\d+)x(\d+)/g)].at(-1)
  const output = await adb(
    'shell',
    'am',
    'instrument',
    '-w',
    '-e',
    'mode',
    commit ? 'commit' : 'cancel',
    '-e',
    'width',
    size[1],
    '-e',
    'height',
    size[2],
    'org.nativescript.contracttouch/.ContractTouch',
  )
  await writeFile(resolve(out, `${name}-input.txt`), output)
  assert.match(output, /result=CONTRACT_TOUCH_OK/)
  assert.equal((await adb('shell', 'pidof', pkg)).trim(), pid)
  await screenshot(`${name}-progress`, true)
  await pause(500)
  await screenshot(`${name}-after`)
}
const previousBackAnimation = (
  await adb('shell', 'settings', 'get', 'global', 'enable_back_animation')
).trim()
const previousNavigation = (await adb('shell', 'cmd', 'overlay', 'list'))
  .split('\n')
  .find((line) => /^\[x\] com\.android\.internal\.systemui\.navbar\./.test(line))
  ?.slice(4)
try {
  if (process.env.ANDROID_APP)
    await adb('install', '-r', resolve(process.env.ANDROID_APP))
  await adb(
    'install',
    '-r',
    process.env.TOUCH_APK ?? '/tmp/router-contract-touch/touch.apk',
  )
  await adb('shell', 'settings', 'put', 'global', 'enable_back_animation', '1')
  await adb(
    'shell',
    'cmd',
    'overlay',
    'enable-exclusive',
    '--category',
    'com.android.internal.systemui.navbar.gestural',
  )
  await adb('shell', 'am', 'force-stop', pkg)
  await adb('shell', 'input', 'keyevent', '3')
  await pause(2000)
  await adb('shell', 'am', 'start', '-W', '-n', activity)
  pid = await until(
    async () => (await adb('shell', 'pidof', pkg).catch(() => '')).trim(),
    'app PID',
  )
  await result('ready')
  await command(`mode-${mode}`)
  await recordEnvironment(out, {
    serial,
    mode,
    coreRevision: process.env.CORE_REVISION,
    fingerprint: (await adb('shell', 'getprop', 'ro.build.fingerprint')).trim(),
  })
  for (const [setup, gesture, check] of [
    ['prepare', 'cancel', 'cancel-check'],
    ['prepare', 'commit', 'commit-check'],
    ['global-guard', 'commit', 'guard-check'],
    ['leave-guard', 'commit', 'leave-check'],
    ['custom', 'cancel', 'custom-check'],
    ['modal', 'commit', 'modal-check'],
  ]) {
    await command(setup)
    await swipe(setup + '-' + gesture, gesture === 'commit')
    await command(check)
  }
  await command('replace-clear')
  if (mode === 'core') {
    await command('interrupt')
    await command('memory')
  }
  await writeFile(resolve(out, 'results.json'), JSON.stringify(reports, null, 2))
  console.log(`Predictive ${mode}: ${reports.length} reports passed`)
} catch (error) {
  await screenshot('failure').catch(() => {})
  await writeFile(
    resolve(out, 'last-report.json'),
    JSON.stringify({ report: await read(), error: String(error) }, null, 2),
  )
  throw error
} finally {
  await writeFile(resolve(out, 'logcat.txt'), await adb('logcat', '-d', '-t', '3000'))
  if (previousNavigation)
    await adb(
      'shell',
      'cmd',
      'overlay',
      'enable-exclusive',
      '--category',
      previousNavigation,
    )
  await adb(
    'shell',
    'settings',
    previousBackAnimation === 'null' ? 'delete' : 'put',
    'global',
    'enable_back_animation',
    ...(previousBackAnimation === 'null' ? [] : [previousBackAnimation]),
  )
}
