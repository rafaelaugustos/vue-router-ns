import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { recordEnvironment } from './environment.mjs'
const exec = promisify(execFile)
const serial = process.env.ANDROID_SERIAL
assert(serial, 'Select a dedicated emulator with ANDROID_SERIAL')
const pkg = 'org.nativescript.vuerouterns'
const activity = `${pkg}/com.tns.NativeScriptActivity`
const out = resolve(process.env.OUT ?? 'scripts/native/out/contracts-android')
const negative = process.env.EXPECT_HMR_FAILURE === '1'
const touchPkg = 'org.nativescript.contracttouch'
const touchApk = process.env.TOUCH_APK ?? '/tmp/router-contract-touch/touch.apk'
assert(
  negative || existsSync(touchApk),
  'Build the input driver: node scripts/native/contracts/build-touch.mjs',
)
const adb = async (...args) =>
  (
    await exec('adb', ['-s', serial, ...args], {
      timeout: 30000,
      maxBuffer: 16 * 1024 * 1024,
    })
  ).stdout
const pause = (ms = 200) => new Promise((done) => setTimeout(done, ms))
const reports = []
let currentPid = ''
let lastSequence = 0
let launcherRecoveries = 0
await mkdir(out, { recursive: true })
async function until(test, label, timeout = 30000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (await test()) return
    await pause()
  }
  throw new Error(`Timed out: ${label}`)
}
async function read() {
  try {
    return JSON.parse(
      await adb('shell', 'run-as', pkg, 'cat', 'files/native-contracts.json'),
    )
  } catch {
    return undefined
  }
}
async function result(command, timeout = 30000, expectFailure = false) {
  let report
  await until(
    async () => {
      report = await read()
      return (
        report?.command === command &&
        String(report.pid) === currentPid &&
        report.sequence > lastSequence
      )
    },
    command,
    timeout,
  )
  reports.push(report)
  lastSequence = report.sequence
  await writeFile(
    resolve(out, `${reports.length}-${command}.json`),
    JSON.stringify(report, null, 2),
  )
  if (expectFailure) {
    assert.equal(report.fault, true, 'Negative control must identify its fault build')
    assert.equal(report.ok, false, 'The old HMR path must fail')
    assert.match(report.error, /covered HMR|native Page replacement/)
  } else assert.equal(report.ok, true, report.error)
  console.log(
    `${command}: ${expectFailure ? 'expected regression detected' : 'passed'} (pid ${currentPid})`,
  )
  return report
}
async function command(name, timeout, expectFailure) {
  await tap(name)
  return result(name, timeout, expectFailure)
}
async function hierarchy() {
  await adb('shell', 'rm', '-f', '/sdcard/contracts.xml')
  await adb('shell', 'uiautomator', 'dump', '/sdcard/contracts.xml')
  return adb('shell', 'cat', '/sdcard/contracts.xml')
}
async function tapNode(xml, name) {
  const node = (xml.match(/<node\b[^>]*>/g) ?? []).find(
    (node) => node.includes(`text="${name}"`) || node.includes(`content-desc="${name}"`),
  )
  assert(node, `Visible button ${name}`)
  const coords = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node)
  assert(coords)
  await adb(
    'shell',
    'input',
    'tap',
    String(Math.round((+coords[1] + +coords[3]) / 2)),
    String(Math.round((+coords[2] + +coords[4]) / 2)),
  )
}
const launcherAnr = (xml) => xml.includes('text="Pixel Launcher isn\'t responding"')
async function recoverLauncher(xml) {
  assert.equal(launcherRecoveries++, 0, 'Repeated Pixel Launcher ANR: unstable emulator')
  await capture('pixel-launcher-anr')
  await writeFile(
    resolve(out, 'launcher-recovery.json'),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        title: "Pixel Launcher isn't responding",
        applicationPid: currentPid || null,
      },
      null,
      2,
    ),
  )
  await tapNode(xml, 'Close app')
  await pause(500)
}
async function tap(name) {
  let xml = await hierarchy()
  // Recover only this named system process, never an ANR from the app under test.
  // No app restart or failed scenario is retried.
  if (launcherAnr(xml)) {
    await recoverLauncher(xml)
    xml = await hierarchy()
  }
  await tapNode(xml, name)
}
async function prepareLauncher() {
  await adb('shell', 'input', 'keyevent', '3')
  let stable = 0
  await until(
    async () => {
      const xml = await hierarchy().catch(async (error) => {
        await writeFile(resolve(out, 'launcher-probe-error.txt'), String(error))
        return ''
      })
      if (!xml) {
        stable = 0
        return false
      }
      if (launcherAnr(xml)) {
        await recoverLauncher(xml)
        await adb('shell', 'input', 'keyevent', '3')
        stable = 0
        return false
      }
      const focused = (await adb('shell', 'dumpsys', 'window'))
        .split('\n')
        .some((line) => line.includes('mCurrentFocus=') && line.includes('nexuslauncher'))
      stable =
        focused && xml.includes('package="com.google.android.apps.nexuslauncher"')
          ? stable + 1
          : 0
      return stable >= 2
    },
    'Pixel Launcher ready after navigation mode change',
    120000,
  )
}
async function capture(name) {
  await adb('shell', 'uiautomator', 'dump', '/sdcard/contracts.xml')
  await writeFile(
    resolve(out, `${name}.xml`),
    await adb('shell', 'cat', '/sdcard/contracts.xml'),
  )
  const shot = await exec('adb', ['-s', serial, 'exec-out', 'screencap', '-p'], {
    encoding: 'buffer',
    maxBuffer: 8 * 1024 * 1024,
  })
  await writeFile(resolve(out, `${name}.png`), shot.stdout)
}
async function launch() {
  const launch = await adb('shell', 'am', 'start', '-W', '-n', activity)
  await writeFile(resolve(out, `launch-${reports.length}.txt`), launch)
  await until(async () => {
    currentPid = (await adb('shell', 'pidof', pkg).catch(() => '')).trim()
    return /^\d+$/.test(currentPid)
  }, 'launched process PID')
  lastSequence = 0
  await result('ready')
}
async function swipe(commit) {
  const size = await adb('shell', 'wm', 'size')
  const match = [...size.matchAll(/(\d+)x(\d+)/g)].at(-1)
  const mode = commit ? 'commit' : 'cancel'
  const output = await adb(
    'shell',
    'am',
    'instrument',
    '-w',
    '-e',
    'mode',
    mode,
    '-e',
    'width',
    match[1],
    '-e',
    'height',
    match[2],
    `${touchPkg}/.ContractTouch`,
  )
  await writeFile(resolve(out, `gesture-${mode}-${reports.length}.txt`), output)
  assert.match(output, /result=CONTRACT_TOUCH_OK/, output)
  assert.equal(
    (await adb('shell', 'pidof', pkg)).trim(),
    currentPid,
    'Input instrumentation must not restart the NativeScript process',
  )
  const shot = await exec(
    'adb',
    ['-s', serial, 'exec-out', 'run-as', touchPkg, 'cat', 'files/gesture.png'],
    {
      encoding: 'buffer',
      maxBuffer: 8 * 1024 * 1024,
    },
  )
  await writeFile(resolve(out, `gesture-${mode}-${reports.length}.png`), shot.stdout)
}
const previousBackAnimation = (
  await adb('shell', 'settings', 'get', 'global', 'enable_back_animation')
).trim()
const previousNavigation = (await adb('shell', 'cmd', 'overlay', 'list'))
  .split('\n')
  .find((line) => /^\[x\] com\.android\.internal\.systemui\.navbar\./.test(line))
  ?.slice(4)
await recordEnvironment(out, {
  serial,
  fingerprint: (await adb('shell', 'getprop', 'ro.build.fingerprint')).trim(),
  avd: (await adb('emu', 'avd', 'name')).trim(),
  size: (await adb('shell', 'wm', 'size')).trim(),
  density: (await adb('shell', 'wm', 'density')).trim(),
})
try {
  await adb('shell', 'pm', 'clear', pkg)
  await adb('logcat', '-c')
  await adb(
    'shell',
    'cmd',
    'overlay',
    'enable-exclusive',
    '--category',
    'com.android.internal.systemui.navbar.gestural',
  )
  await adb('shell', 'settings', 'put', 'global', 'enable_back_animation', '1')
  if (!negative) {
    await adb('uninstall', touchPkg).catch(() => {})
    await adb('install', touchApk)
  }
  await prepareLauncher()
  await launch()
  if (negative) {
    await command('hmr', 30000, true)
  } else {
    await command('suite')
    await capture('contract-suite')
    await command('hmr')
    await capture('covered-hmr')
    await command('gesture-setup')
    await swipe(false)
    await command('cancel-check')
    await swipe(true)
    await command('commit-check')
    await command('guard-setup')
    await swipe(true)
    await command('guard-check')
    await command('allow')
    await swipe(true)
    await command('commit-check')
    await command('modal-setup')
    await adb('shell', 'input', 'keyevent', '4')
    await command('modal-check')
    await command('allow')
    await tap('finish-modal')
    await command('modal-result-check')
    await command('restore-setup')
    const oldPid = currentPid
    await adb('shell', 'input', 'keyevent', '3')
    await pause(1500)
    await adb('shell', 'am', 'kill', pkg)
    await pause(500)
    if ((await adb('shell', 'pidof', pkg).catch(() => '')).trim() === oldPid) {
      try {
        await adb('shell', 'run-as', pkg, 'kill', '-9', oldPid)
      } catch (error) {
        if ((await adb('shell', 'pidof', pkg).catch(() => '')).trim() === oldPid)
          throw error
      }
    }
    await until(
      async () => !(await adb('shell', 'pidof', pkg).catch(() => '')).trim(),
      'old process exits',
    )
    // /proc can lose the PID before ActivityManager handles binder death.
    // Starting in that interval delivers to the dying Activity instead of
    // restoring its saved task. Wait for the system's process record as well.
    let processes
    await until(async () => {
      processes = await adb('shell', 'dumpsys', 'activity', 'processes')
      return !processes.includes(`${oldPid}:${pkg}/`)
    }, 'ActivityManager acknowledges process death')
    await writeFile(resolve(out, `process-death-${oldPid}.txt`), processes)
    await launch()
    assert.notEqual(currentPid, oldPid)
    await command('restore-check')
    await capture('restored-history')
    await command('measure', 180000)
  }
} catch (error) {
  await capture('failure').catch(() => {})
  throw error
} finally {
  await writeFile(resolve(out, 'results.json'), JSON.stringify(reports, null, 2))
  await writeFile(
    resolve(out, 'runtime.log'),
    await adb('logcat', '-d', '-v', 'threadtime'),
  )
  await adb(
    'shell',
    'settings',
    previousBackAnimation === 'null' ? 'delete' : 'put',
    'global',
    'enable_back_animation',
    ...(previousBackAnimation === 'null' ? [] : [previousBackAnimation]),
  )
  await adb('shell', 'am', 'force-stop', pkg)
  if (!negative) await adb('uninstall', touchPkg)
  if (previousNavigation)
    await adb(
      'shell',
      'cmd',
      'overlay',
      'enable-exclusive',
      '--category',
      previousNavigation,
    )
}
