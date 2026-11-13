import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { recordEnvironment } from '../contracts/environment.mjs'

const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
assert(sim, 'Use a dedicated iPad simulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/intent-windows')
const project = resolve(process.env.XCTEST_PROJECT ?? '/tmp/intent-windows-checks')
const pkg = 'org.nativescript.vuerouterns'
const run = (cmd, args, extra = {}) =>
  exec(cmd, args, { timeout: 30000, maxBuffer: 16 * 1024 * 1024, ...extra })
await mkdir(out, { recursive: true })
await recordEnvironment(out, {
  simulator: sim,
  xcode: (await run('xcodebuild', ['-version'])).stdout.trim(),
})
await run('ruby', ['scripts/native/intent-windows/project.rb', project])
await run('xcrun', ['simctl', 'uninstall', sim, pkg]).catch(() => {})
const built = resolve('demo/platforms/ios/build/Debug-iphonesimulator')
const apps = (await readdir(built)).filter((name) => name.endsWith('.app'))
assert.equal(apps.length, 1)
await run('xcrun', ['simctl', 'install', sim, resolve(built, apps[0])], {
  timeout: 180000,
})
let recorder, recorded, failure
if (process.env.RECORD_VIDEO === '1') {
  recorder = spawn(
    'xcrun',
    ['simctl', 'io', sim, 'recordVideo', '--codec=h264', `${out}/intent-windows.mp4`],
    { stdio: 'ignore' },
  )
  recorded = new Promise((resolve) => recorder.on('close', resolve))
}
try {
  const result = await run(
    'xcodebuild',
    [
      'test',
      '-project',
      `${project}/IntentWindowsChecks.xcodeproj`,
      '-scheme',
      'IntentWindowsChecks',
      '-destination',
      `platform=iOS Simulator,id=${sim}`,
      '-derivedDataPath',
      `${project}/build`,
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      `${out}/IntentWindows.xcresult`,
    ],
    { timeout: 300000 },
  )
  await writeFile(`${out}/xcodebuild.log`, result.stdout + result.stderr)
} catch (error) {
  failure = error
  await writeFile(
    `${out}/xcodebuild.log`,
    `${error.stdout ?? ''}${error.stderr ?? ''}\n${String(error)}`,
  )
} finally {
  if (recorder) {
    // Keep the final OS-delivered destination visible while simctl flushes frames.
    await new Promise((resolve) => setTimeout(resolve, 3000))
    recorder.kill('SIGINT')
    await recorded
  }
}
const container = (
  await run('xcrun', ['simctl', 'get_app_container', sim, pkg, 'data'])
).stdout.trim()
const reports = []
for (const name of [
  'create-saved',
  'repeat',
  'reuse',
  'focus-a',
  'focus-b',
  'reset',
  'wrong-owner',
  'create-fresh',
  'close-b',
  'guard',
  'dispose',
]) {
  const raw = await readFile(
    `${container}/Documents/intent-window-${name}.json`,
    'utf8',
  ).catch(() => undefined)
  if (!raw) continue
  await writeFile(`${out}/${name}.json`, raw)
  reports.push(JSON.parse(raw))
}
await run('xcrun', ['simctl', 'io', sim, 'screenshot', `${out}/final.png`])
assert(!failure, `Native intent-windows test failed: ${out}/xcodebuild.log`)
assert.equal(reports.length, 11)
for (const report of reports) {
  assert(report.ok, report.error)
  for (const stack of Object.values(report.stacks))
    assert.deepEqual(stack.native, stack.logical)
  assert.equal(report.sourceDraft, 'Unsent draft a')
  assert.equal(
    new Set(Object.values(report.stacks).map((s) => s.windowId)).size,
    Object.keys(report.stacks).length,
  )
}
assert.equal(reports.at(-1).allocations, 2)
assert.deepEqual(Object.keys(reports.at(-1).stacks), ['a', 'c'])
await writeFile(`${out}/summary.json`, JSON.stringify(reports, null, 2) + '\n')
console.log(`IntentWindows: ${reports.length} native reports passed`)
