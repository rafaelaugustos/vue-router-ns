// Drives real emulator posture/window changes against the installed folds fixture.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const exec = promisify(execFile)
const serial = process.env.ANDROID_SERIAL ?? 'emulator-5580'
const out = resolve(process.env.OUT ?? 'scripts/native/out/folds')
await mkdir(out, { recursive: true })
const pkg = 'org.nativescript.vuerouterns'
const activity = `${pkg}/com.tns.NativeScriptActivity`
const adb = async (...args) =>
  (
    await exec('adb', ['-s', serial, ...args], {
      timeout: 20000,
      maxBuffer: 8 * 1024 * 1024,
    })
  ).stdout
const pause = () => new Promise((done) => setTimeout(done, 300))
let pid,
  log = ''
const results = []
const postures = []
const occluding = process.env.EXPECT_OCCLUDING === '1'
const displayFeatures = process.env.FOLD_DISPLAY_FEATURES
const previousFeatures =
  displayFeatures === undefined
    ? undefined
    : (await adb('shell', 'settings', 'get', 'global', 'display_features')).trim()
async function hinge(angle) {
  const expected = angle === 180 ? 'OPENED' : 'HALF_OPENED'
  await adb('emu', 'sensor', 'set', 'hinge-angle0', String(angle))
  // A successful emulator-console reply only acknowledges the sensor write.
  // Wait for Android's DeviceStateManager to commit the physical posture before
  // asking WindowManager/the app to validate its resulting FoldingFeature.
  let state = ''
  for (let attempt = 0; attempt < 50; attempt++) {
    state = await adb('shell', 'cmd', 'device_state', 'state')
    const committed = state
      .split('\n')
      .find((line) => line.startsWith('Committed state:'))
    if (committed?.includes(`name='${expected}'`)) {
      postures.push({ angle, state: state.trim() })
      return
    }
    if (attempt === 10 || attempt === 25) {
      // A listener attached after the first sample needs a fresh sensor edge.
      await adb('emu', 'sensor', 'set', 'hinge-angle0', String(angle === 180 ? 179 : 91))
      await pause()
      await adb('emu', 'sensor', 'set', 'hinge-angle0', String(angle))
    }
    await pause()
  }
  throw new Error(`Android did not commit hinge angle ${angle}: ${state}`)
}
async function wait(find, label) {
  const until = Date.now() + 60000
  while (Date.now() < until) {
    log = await adb(
      'logcat',
      '-d',
      '--pid',
      pid,
      '-v',
      'brief',
      '-s',
      'JS',
      'AndroidRuntime',
    )
    if (log.includes('FOLD_FATAL')) throw new Error(log.slice(-5000))
    const found = find(log)
    if (found) return found
    await pause()
  }
  throw new Error(`Timed out: ${label}\n${log.slice(-4000)}`)
}
async function command(name) {
  const id = String(Date.now())
  await adb(
    'shell',
    'am',
    'start',
    '-n',
    activity,
    '--es',
    'foldCommand',
    name,
    '--es',
    'foldId',
    id,
  )
  const result = await wait((text) => {
    const line = text
      .split('\n')
      .find((line) => line.includes(`FOLD_RESULT {"id":"${id}"`))
    return line && JSON.parse(line.split('FOLD_RESULT ')[1])
  }, name)
  assert(result.ok, `${name}: ${result.error}`)
  assert.equal(String(result.pid), pid, 'A posture change recreated the process')
  results.push(result)
  console.log(`${name}: passed; ${result.columns} / ${result.rows}`)
  const shot = await exec('adb', ['-s', serial, 'exec-out', 'screencap', '-p'], {
    encoding: 'buffer',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 20000,
  })
  // Android 16 can prefix multi-display warnings before the PNG bytes.
  const start = shot.stdout.indexOf(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  assert(start >= 0, 'screencap did not return a PNG')
  await writeFile(
    resolve(out, `${results.length}-${name}.png`),
    shot.stdout.subarray(start),
  )
}
try {
  await adb('shell', 'am', 'force-stop', pkg)
  if (displayFeatures !== undefined)
    await adb('shell', 'settings', 'put', 'global', 'display_features', displayFeatures)
  await adb('shell', 'wm', 'user-rotation', 'lock', '0')
  // Exercise the real sensor/provider before launching the app. On a freshly
  // booted AVD, the default OPENED state alone does not prove that the hinge
  // listener is ready to deliver a transition.
  await hinge(90)
  await hinge(180)
  await adb('shell', 'am', 'start', '-W', '-n', activity)
  pid = (await adb('shell', 'pidof', pkg)).trim()
  assert(pid, 'App did not launch')
  await wait((text) => text.includes('FOLD_READY '), 'fixture readiness')
  await command(occluding ? 'occluding' : 'flat')
  await hinge(90)
  await command('vertical')
  await command('focus')
  await hinge(180)
  await command(occluding ? 'occluding' : 'flat')
  await command('focused')
  await hinge(90)
  await command('vertical')
  await command('focused')
  await command('rtl')
  await command('ltr')
  await command('disable')
  await command('enable')
  await command('modal')
  await adb('shell', 'wm', 'user-rotation', 'lock', '1')
  await command('horizontal')
  await command('dismiss')
  await command('focused')
  await command('horizontal')
  await adb('shell', 'wm', 'size', '1800x1600')
  await command('resized')
  await command('focused')
  await adb('shell', 'wm', 'size', 'reset')
  await command('restored-size')
  await adb('shell', 'wm', 'user-rotation', 'lock', '0')
  await command('vertical')
  await command('back')
  await writeFile(
    resolve(out, 'results.json'),
    JSON.stringify({ serial, pid, results }, null, 2) + '\n',
  )
  console.log(`Passed ${results.length} native fold checkpoints`)
} finally {
  await writeFile(resolve(out, 'runtime.log'), log)
  await writeFile(resolve(out, 'postures.json'), JSON.stringify(postures, null, 2))
  const state = await adb('shell', 'dumpsys', 'device_state').catch(String)
  const sensors = await adb('emu', 'sensor', 'get', 'hinge-angle0').catch(String)
  await writeFile(resolve(out, 'device-state.txt'), state + '\n' + sensors)
  await adb('shell', 'am', 'force-stop', pkg).catch(() => {})
  if (previousFeatures !== undefined) {
    if (previousFeatures === 'null')
      await adb('shell', 'settings', 'delete', 'global', 'display_features')
    else
      await adb(
        'shell',
        'settings',
        'put',
        'global',
        'display_features',
        previousFeatures,
      )
  }
  await adb('shell', 'wm', 'size', 'reset').catch(() => {})
  await adb('emu', 'sensor', 'set', 'hinge-angle0', '180').catch(() => {})
  await adb('shell', 'wm', 'user-rotation', 'free').catch(() => {})
}
