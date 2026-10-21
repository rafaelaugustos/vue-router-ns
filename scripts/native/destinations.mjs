import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { recordEnvironment } from './contracts/environment.mjs'

const exec = promisify(execFile)
const ios = process.argv[2] === 'ios'
assert(
  ios || process.argv[2] === 'android',
  'Usage: node scripts/native/destinations.mjs ios|android',
)
const device = ios ? process.env.IOS_SIMULATOR : process.env.ANDROID_SERIAL
assert(device, 'Select a dedicated IOS_SIMULATOR or ANDROID_SERIAL')
const out = resolve(
  process.env.OUT ?? `scripts/native/out/destinations-${ios ? 'ios' : 'android'}`,
)
const pkg = 'org.nativescript.vuerouterns'
const run = (command, args, options = {}) =>
  exec(command, args, { maxBuffer: 32 * 1024 * 1024, ...options })
const adb = (...args) => run('adb', ['-s', device, ...args])
const sim = (...args) => run('xcrun', ['simctl', ...args])
const pause = (ms) => new Promise((done) => setTimeout(done, ms))
await mkdir(out, { recursive: true })
await recordEnvironment(out, { platform: ios ? 'ios' : 'android', device })
let documents
let deathMethod = ios ? 'simctl-terminate' : 'am-kill'
async function readReport() {
  const text = ios
    ? await readFile(`${documents}/destinations.json`, 'utf8')
    : (await adb('shell', 'run-as', pkg, 'cat', 'files/destinations.json')).stdout
  return JSON.parse(text)
}
async function waitReport(name, oldPid) {
  for (let i = 0; i < 180; i++) {
    const report = await readReport().catch(() => undefined)
    if (report && report.pid !== oldPid) {
      assert(!report.error, report.error)
      assert.equal(
        report.diagnostics.issues.length,
        0,
        JSON.stringify(report.diagnostics.issues),
      )
      if (report.name === name) return report
    }
    await pause(500)
  }
  throw new Error(`Timed out waiting for ${name}`)
}
async function launch() {
  if (ios) await sim('launch', device, pkg)
  else
    await adb('shell', 'am', 'start', '-W', '-n', `${pkg}/com.tns.NativeScriptActivity`)
}
try {
  if (ios) {
    await sim('terminate', device, pkg).catch(() => {})
    await sim('uninstall', device, pkg).catch(() => {})
    await sim(
      'install',
      device,
      resolve('demo/platforms/ios/build/Debug-iphonesimulator/demo.app'),
    )
    documents = `${(await sim('get_app_container', device, pkg, 'data')).stdout.trim()}/Documents`
  } else {
    await adb('uninstall', pkg).catch(() => {})
    await adb(
      'install',
      resolve(
        process.env.ANDROID_APP ??
          'demo/platforms/android/app/build/outputs/apk/debug/app-debug.apk',
      ),
    )
  }
  await launch()
  const beforeBack = await waitReport('system-back-required')
  await writeFile(`${out}/before-system-back.json`, JSON.stringify(beforeBack, null, 2))
  if (ios) {
    const project = `/tmp/router-native-destinations-${device}`
    await run('ruby', ['scripts/native/destinations/project.rb', project])
    let failure
    const result = await run(
      'xcodebuild',
      [
        'test',
        '-project',
        `${project}/DestinationChecks.xcodeproj`,
        '-scheme',
        'DestinationChecks',
        '-destination',
        `platform=iOS Simulator,id=${device}`,
        '-derivedDataPath',
        `${project}/build`,
        '-collect-test-diagnostics',
        'never',
      ],
      { timeout: 180000 },
    ).catch((error) => {
      failure = error
      return { stdout: error.stdout, stderr: error.stderr }
    })
    await writeFile(`${out}/xcodebuild.log`, result.stdout + result.stderr)
    assert(!failure, `Native back gesture XCTest failed: ${out}/xcodebuild.log`)
  } else {
    await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
  }
  const first = await waitReport('restart-required')
  assert.equal(first.collections.length, 3, 'Expected three fixed GC rounds')
  assert.equal(first.collections.at(-1), 0, 'No native instances may remain after GC')
  for (const name of [
    'Complete/native/42',
    'Cancel/native/42',
    'Pop/native/42',
    'Dismiss/native/42',
    'Complete/modal/9',
    'guard',
    'cover-return',
    'collected',
    'system-back',
  ])
    assert(first.checks.includes(name), `Missing acceptance: ${name}`)
  assert.equal(
    first.created - first.disposed,
    1,
    'Only the visible restore destination may remain',
  )
  await writeFile(`${out}/before-restart.json`, JSON.stringify(first, null, 2))
  console.log(
    `${ios ? 'iOS' : 'Android'}: roundtrips, guard, native removal and weak-reference collection passed`,
  )
  if (ios) {
    await sim('io', device, 'screenshot', `${out}/native.png`)
    await sim('terminate', device, pkg)
  } else {
    // execFile's default text decoding is unsuitable for PNG.
    const binary = await run('adb', ['-s', device, 'exec-out', 'screencap', '-p'], {
      encoding: 'buffer',
    })
    await writeFile(`${out}/native.png`, binary.stdout)
    await adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    await pause(2000)
    let pid
    for (let attempt = 0; attempt < 4; attempt++) {
      await adb('shell', 'am', 'kill', pkg)
      await pause(1500)
      pid = await adb('shell', 'pidof', pkg).catch(() => ({ stdout: '' }))
      if (!pid.stdout.trim()) break
    }
    // Android can keep the most recently stopped app above am kill's cached
    // threshold. Kill only this verified debuggable PID, retaining task/state.
    if (pid.stdout.trim() === String(first.pid)) {
      deathMethod = 'run-as-kill'
      await adb('shell', 'run-as', pkg, 'kill', '-9', String(first.pid))
      await pause(1500)
      pid = await adb('shell', 'pidof', pkg).catch(() => ({ stdout: '' }))
    }
    assert.equal(
      pid.stdout.trim(),
      '',
      'Android process must actually die before restoration',
    )
  }
  await launch()
  const restored = await waitReport('restored', first.pid)
  assert.equal(restored.created, 1)
  assert.equal(restored.disposed, 1)
  assert.equal(restored.path, '/')
  await writeFile(`${out}/restored.json`, JSON.stringify(restored, null, 2))
  await writeFile(
    `${out}/restart.json`,
    JSON.stringify(
      {
        method: deathMethod,
        before: first.pid,
        after: restored.pid,
      },
      null,
      2,
    ),
  )
  console.log(`Restoration passed with fresh PID ${restored.pid} (previous ${first.pid})`)
} finally {
  const report = await readReport().catch(() => undefined)
  await writeFile(`${out}/last-report.json`, JSON.stringify(report ?? null, null, 2))
  const log = ios
    ? await sim(
        'spawn',
        device,
        'log',
        'show',
        '--last',
        '5m',
        '--style',
        'compact',
        '--predicate',
        'process == "demo"',
      ).catch(() => ({ stdout: '' }))
    : await adb('logcat', '-d', '-t', '2500').catch(() => ({ stdout: '' }))
  await writeFile(`${out}/runtime.log`, log.stdout)
}
