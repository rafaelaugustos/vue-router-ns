import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { access, mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { startServer } from '../loaders/server.mjs'
const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
const serial = process.env.ANDROID_SERIAL
assert(
  !!sim !== !!serial,
  'Set exactly one of IOS_SIMULATOR / ANDROID_SERIAL to a dedicated test device',
)
const pkg = 'org.nativescript.vuerouterns'
const out = resolve(
  process.env.OUT ?? `scripts/native/out/suspense-${sim ? 'ios' : serial}`,
)
await mkdir(out, { recursive: true })
const versions = {}
for (const name of [
  '@nativescript/core',
  'nativescript-vue',
  '@vue/runtime-core',
  '@vue/compiler-sfc',
  '@nativescript/ios',
  '@nativescript/android',
]) {
  versions[name] = JSON.parse(
    await readFile(`demo/node_modules/${name}/package.json`, 'utf8'),
  ).version
}
await writeFile(`${out}/versions.json`, JSON.stringify(versions, null, 2))

const run = async (cmd, args) =>
  (await exec(cmd, args, { timeout: 60000, maxBuffer: 16 * 1024 * 1024 })).stdout.trim()
const adb = (...args) => run('adb', ['-s', serial, ...args])
const ios = (...args) => run('xcrun', ['simctl', ...args])
const appFiles = `/data/data/${pkg}/files/suspense`
const pause = (ms) => new Promise((done) => setTimeout(done, ms))
// Compile before opening any deliberately pending HTTP requests. Gesture cases
// then reuse this build instead of spending the request's lifetime compiling.
if (sim && process.env.GESTURES === '1') await xcode('build-for-testing', 'build')
const server = await startServer({ controlled: true })
let container, recording
const results = []
const commandBase = Date.now()
async function waitForBridge() {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    try {
      // The fixture creates this file when its native command bridge starts.
      if (sim) await access(`${container}/Documents/suspense/result.json`)
      else await adb('shell', 'run-as', pkg, 'test', '-f', `${appFiles}/result.json`)
      return
    } catch {
      await pause(200)
    }
  }
  assert.fail('Native Suspense command bridge did not become ready within 30s')
}
async function command(action = 'snapshot', value, frame) {
  // A previous launch can leave result.json behind; only accept this run's IDs.
  const id = commandBase + results.length + 1
  const body = JSON.stringify({ id, action, value, frame })
  if (sim) await writeFile(`${container}/Documents/suspense/command.json`, body)
  else {
    await writeFile(`${out}/command.json`, body)
    await adb('push', `${out}/command.json`, '/data/local/tmp/suspense-command.json')
    await adb(
      'shell',
      'run-as',
      pkg,
      'cp',
      '/data/local/tmp/suspense-command.json',
      `${appFiles}/command.json`,
    )
  }
  let report
  for (let i = 0; i < 80; i++) {
    try {
      report = JSON.parse(
        sim
          ? await readFile(`${container}/Documents/suspense/result.json`, 'utf8')
          : await adb('shell', 'run-as', pkg, 'cat', `${appFiles}/result.json`),
      )
      if (report.id === id) break
    } catch {}
    await pause(200)
  }
  assert.equal(report?.id, id, `Command timed out: ${action}`)
  results.push({
    action,
    value,
    observedAt: new Date().toISOString(),
    ...report,
    requests: Object.fromEntries(server.counts),
  })
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2))
  assert(!report.error, JSON.stringify(report))
  assert.deepEqual(report.unhandled, [], 'Unhandled native rendering errors')
  if (recording && action !== 'snapshot') await pause(1000)
  return report
}
async function release(id, count = 1) {
  for (let i = 0; i < 100 && server.counts.get(id) !== count; i++) await pause(100)
  assert.equal(server.counts.get(id), count, `HTTP request count: ${id}`)
  server.release(id)
}
async function until(test, label) {
  for (let i = 0; i < 80; i++) {
    const report = await command()
    if (test(report)) return report
    await pause(100)
  }
  assert.fail(`Never reached ${label}`)
}
const last = (report) => report.pages.at(-1)
const resolved = () => until((r) => last(r).events.includes('resolve'), 'resolved')
async function screenshot(name) {
  if (sim) await ios('io', sim, 'screenshot', `${out}/${name}.png`)
  else {
    await adb('shell', 'screencap', '-p', '/sdcard/suspense.png')
    await adb('pull', '/sdcard/suspense.png', `${out}/${name}.png`)
  }
  if (recording) await pause(1500)
}
async function stopRecording() {
  if (!recording) return
  if (sim) recording.kill('SIGINT')
  else await adb('shell', 'pkill', '-INT', 'screenrecord').catch(() => {})
  await pause(1500)
  if (serial) await adb('pull', '/sdcard/suspense.mp4', `${out}/demo.mp4`)
  recording = undefined
}
async function xcode(action, name, args = []) {
  const project = process.env.SUSPENSE_UI_PROJECT ?? '/tmp/router-suspense-tests'
  let output
  try {
    output = await exec(
      'xcodebuild',
      [
        action,
        '-project',
        `${project}/SuspenseChecks.xcodeproj`,
        '-scheme',
        'SuspenseChecks',
        '-destination',
        `platform=iOS Simulator,id=${sim}`,
        '-derivedDataPath',
        `${project}/build`,
        ...args,
      ],
      { timeout: 180000, maxBuffer: 32 * 1024 * 1024 },
    )
  } catch (error) {
    output = error
    throw error
  } finally {
    await writeFile(`${out}/${name}.log`, (output?.stdout ?? '') + (output?.stderr ?? ''))
  }
}
async function gesture(mode) {
  if (sim) {
    const method = {
      cancel: 'testCancelBack',
      commit: 'testCommitBack',
      modal: 'testDismissModal',
    }[mode]
    await xcode('test-without-building', `gesture-${mode}`, [
      `-only-testing:SuspenseChecks/SuspenseUITests/${method}`,
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      `${out}/gesture-${mode}.xcresult`,
    ])
  } else if (mode === 'modal') {
    await adb('shell', 'input', 'keyevent', '4')
  } else {
    const size = [...(await adb('shell', 'wm', 'size')).matchAll(/(\d+)x(\d+)/g)].at(-1)
    const result = await adb(
      'shell',
      'am',
      'instrument',
      '-w',
      '-e',
      'mode',
      mode,
      '-e',
      'width',
      size[1],
      '-e',
      'height',
      size[2],
      'org.nativescript.contracttouch/.ContractTouch',
    )
    await writeFile(`${out}/gesture-${mode}.log`, result)
    assert.match(result, /result=CONTRACT_TOUCH_OK/)
  }
  await pause(700)
}
try {
  if (sim) {
    await ios('terminate', sim, pkg).catch(() => {})
    await ios('launch', sim, pkg)
    container = await ios('get_app_container', sim, pkg, 'data')
  } else {
    await adb('reverse', 'tcp:18818', 'tcp:18818')
    await adb('shell', 'am', 'force-stop', pkg)
    await adb('shell', 'pm', 'clear', pkg)
    await adb('shell', 'am', 'start', '-W', '-n', `${pkg}/com.tns.NativeScriptActivity`)
  }
  await waitForBridge()
  if (process.env.RECORD === '1')
    recording = sim
      ? spawn(
          'xcrun',
          ['simctl', 'io', sim, 'recordVideo', '--codec=h264', `${out}/demo.mp4`],
          { stdio: 'ignore' },
        )
      : spawn(
          'adb',
          [
            '-s',
            serial,
            'shell',
            'screenrecord',
            '--bit-rate',
            '4000000',
            '/sdcard/suspense.mp4',
          ],
          { stdio: 'ignore' },
        )
  const initial = await command()
  assert.match(initial.stockError, /No known component for element div/)
  assert.deepEqual(initial.unhandled, [])
  assert.equal(initial.current, '/')
  const first = await command('push', '/product/42')
  assert(last(first).events.includes('fallback'))
  await screenshot('pending')
  await release('42')
  const success = await resolved()
  assert.deepEqual(success.frames, first.frames)
  assert.equal(last(success).page, last(first).page)
  assert.equal(last(success).actionBar, last(first).actionBar)
  assert.equal(last(success).heading, last(first).heading)
  assert.deepEqual(last(success).size, last(first).size)
  assert(last(success).texts.includes('Product 42'))
  await screenshot('success')
  await command('back')
  await command('push', '/product/error')
  await release('error')
  const failed = await until((r) => !!last(r).error, 'captured error')
  assert.deepEqual(failed.unhandled, [])
  await screenshot('error')
  await command('retry')
  await release('error', 2)
  const retry = await until(
    (r) => !last(r).error && last(r).texts.includes('Product error'),
    'retry',
  )
  assert.deepEqual(retry.frames, failed.frames)
  assert.equal(last(retry).page, last(failed).page)
  assert.equal(last(retry).actionBar, last(failed).actionBar)
  await screenshot('retry')
  await stopRecording()
  assert.equal(last(retry).heading, last(failed).heading)
  await command('back')
  for (const mode of ['setup', 'lazy', 'nested', 'deferred']) {
    const pending = await command('push', `/product/${mode}?mode=${mode}`)
    await until((r) => last(r).events.includes('fallback'), `${mode} fallback`)
    await release(mode)
    const ready = await resolved()
    assert.equal(last(ready).page, last(pending).page)
    assert(last(ready).texts.includes(`Product ${mode}`))
    assert.equal(server.counts.get(mode), 1)
    if (mode === 'deferred')
      assert(
        last(ready).events.indexOf('activated') < last(ready).events.indexOf('pending'),
      )
    await command('back')
  }
  const rapid = await command('push', '/product/rapid')
  await command('retry')
  await command('retry')
  await release('rapid', 3)
  const latest = await resolved()
  assert.equal(last(latest).page, last(rapid).page)
  assert.equal(latest.consumers.at(-1).resolved, true)
  assert(latest.consumers.slice(-3, -1).every((c) => c.disposed && !c.resolved))
  await command('back')
  // Reloading a Promise does not make an already mounted async setup suspend again.
  await command('push', '/product/timeout?timeout=3000')
  await release('timeout')
  const beforeRefresh = await resolved()
  const beforeEvents = [...last(beforeRefresh).events]
  await command('refresh')
  await release('timeout', 2)
  const refreshed = await until((r) => last(r).status === 'success', 'plain refresh')
  assert.deepEqual(last(refreshed).events, beforeEvents)
  assert(last(refreshed).texts.includes('Product timeout'))
  const replaced = await command('retry')
  assert.equal(last(replaced).events.at(-1), 'pending')
  assert(
    last(replaced).texts.includes('Product timeout'),
    'old content retained until timeout',
  )
  const timed = await until(
    (r) => last(r).events.at(-1) === 'fallback',
    'replacement timeout',
  )
  assert(last(timed).texts.includes('Loading product…'))
  assert(
    !last(timed).texts.includes('Product timeout'),
    'previous branch removed at timeout',
  )
  await release('timeout', 3)
  const afterTimeout = await until(
    (r) => last(r).events.at(-1) === 'resolve',
    'replacement resolution',
  )
  assert.equal(last(afterTimeout).page, last(beforeRefresh).page)
  assert.equal(last(afterTimeout).heading, last(beforeRefresh).heading)
  await command('back')
  if (process.env.GESTURES === '1') {
    const pendingGesture = await command('push', '/product/gesture')
    await gesture('cancel')
    const cancelled = await command()
    assert.equal(cancelled.current, '/product/gesture')
    assert.equal(last(cancelled).page, last(pendingGesture).page)
    assert.equal(last(cancelled).status, 'pending')
    assert.equal(last(cancelled).disposed, false)
    await gesture('commit')
    const committed = await until((r) => r.current === '/', 'native Back commit')
    assert(last(committed).disposed)
    await release('gesture')
    assert.equal((await command()).consumers.at(-1).resolved, false)
  }
  // Two entries consume one cache request; removing one must not cancel the other.
  const shared = await command('push', '/product/shared')
  await command('push', '/product/shared?copy=1')
  const removed = await command('back')
  assert(last(removed).disposed)
  await release('shared')
  const retained = await until(
    (r) => r.pages.at(-2).events.includes('resolve'),
    'shared survivor',
  )
  assert.equal(retained.frames.a.page, last(shared).page)
  assert(last(retained).disposed)
  assert.equal(last(retained).status, 'cancelled')
  assert.equal(server.counts.get('shared'), 1)
  await command('back')
  // Resolve one page while another covers it, then reveal its retained native Page.
  const covered = await command('push', '/product/covered')
  await command('push', '/product/cover')
  await release('covered')
  const hidden = await until(
    (r) => r.pages.at(-2).events.includes('resolve'),
    'covered resolution',
  )
  assert.equal(hidden.current, '/product/cover')
  const back = await command('back')
  assert.equal(back.frames.a.page, last(covered).page)
  await release('cover')
  const noResurrection = await command()
  assert(last(noResurrection).disposed)
  assert.equal(last(noResurrection).status, 'cancelled')
  await command('back')
  // Separate tab stacks stay responsive and own separate Suspense boundaries.
  const tabA = await command('push', '/product/tab-a', 'a')
  const tabB = await command('push', '/product/tab-b', 'b')
  await release('tab-a')
  await until(
    (r) => r.pages.at(-2).events.includes('resolve'),
    'background tab resolution',
  )
  const switched = await command('select', 'a')
  assert.equal(switched.frames.a.page, last(tabA).page)
  assert.equal(switched.frames.b.page, last(tabB).page)
  await release('tab-b')
  await resolved()
  // A dismissed modal never mounts its late async child or changes the active route.
  await command('modal', '/product/modal')
  if (process.env.GESTURES === '1') await gesture('modal')
  else await command('back')
  await until((r) => r.current === '/product/tab-a', 'modal dismissal')
  await release('modal')
  const dismissed = await command()
  assert(last(dismissed).disposed)
  assert.equal(last(dismissed).status, 'cancelled')
  assert.equal(dismissed.current, '/product/tab-a')
  assert.deepEqual(dismissed.frames.a, tabA.frames.a)
  assert.deepEqual(dismissed.frames.b, tabB.frames.b)
  assert.equal(dismissed.consumers.at(-1).resolved, false)
  await screenshot('final')
  console.log(
    'PASS native Suspense: stock failure, SFC/async setup/lazy/nested/Deferred, errors/retry, timeout, cache, disposal, tabs and modal',
  )
} catch (error) {
  // Preserve the loader error and native view that caused a failed gesture,
  // rather than leaving the artifact at the last successful pending snapshot.
  if (results.length) {
    await command().catch(() => {})
  }
  await screenshot('failure').catch(() => {})
  throw error
} finally {
  await stopRecording()
  if (serial) await adb('reverse', '--remove', 'tcp:18818').catch(() => {})
  await server.close()
}
