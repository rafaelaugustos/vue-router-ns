import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
assert(sim, 'Use a dedicated iPad simulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/preload')
const project = resolve(process.env.XCTEST_PROJECT ?? '/tmp/preload-checks')
const pkg = 'org.nativescript.vuerouterns'
const run = (cmd, args, extra = {}) =>
  exec(cmd, args, { timeout: 30000, maxBuffer: 16 * 1024 * 1024, ...extra })
await mkdir(out, { recursive: true })
if (process.env.XCTEST_PREPARED === '1') {
  await access(`${project}/PreloadChecks.xcodeproj/project.pbxproj`)
} else {
  await run('ruby', ['scripts/native/preload/project.rb', project])
}
await run('xcrun', ['simctl', 'uninstall', sim, pkg]).catch(() => {})
const built = resolve('demo/platforms/ios/build/Debug-iphonesimulator')
const apps = (await readdir(built)).filter((name) => name.endsWith('.app'))
assert.equal(apps.length, 1)
// First installation on a cold hosted simulator is setup, not a navigation probe.
await run('xcrun', ['simctl', 'install', sim, resolve(built, apps[0])], {
  timeout: 180000,
})
let recorder, recorded
if (process.env.RECORD_VIDEO === '1') {
  recorder = spawn(
    'xcrun',
    ['simctl', 'io', sim, 'recordVideo', '--codec=h264', `${out}/preload.mp4`],
    { stdio: 'ignore' },
  )
  recorded = new Promise((resolve) => recorder.on('close', resolve))
}
let failure
try {
  const result = await run(
    'xcodebuild',
    [
      'test',
      '-project',
      `${project}/PreloadChecks.xcodeproj`,
      '-scheme',
      'PreloadChecks',
      '-only-testing:PreloadChecks/PreloadUITests/testCodePreparation',
      '-destination',
      `platform=iOS Simulator,id=${sim}`,
      '-derivedDataPath',
      `${project}/build`,
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      `${out}/Preload.xcresult`,
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
    recorder.kill('SIGINT')
    await recorded
  }
}
const container = (
  await run('xcrun', ['simctl', 'get_app_container', sim, pkg, 'data'])
).stdout.trim()
const reports = []
for (const name of [
  'cold',
  'prepared-before',
  'prepared',
  'abandon',
  'blocked-before',
  'blocked',
  'dispose',
]) {
  const raw = await readFile(`${container}/Documents/preload-${name}.json`, 'utf8').catch(
    () => undefined,
  )
  if (raw) {
    await writeFile(`${out}/${name}.json`, raw)
    reports.push(JSON.parse(raw))
  }
}
await run('xcrun', ['simctl', 'io', sim, 'screenshot', `${out}/final.png`])
assert(!failure, `Native preload test failed: ${out}/xcodebuild.log`)
assert.equal(reports.length, 7)
for (const report of reports) assert(report.ok, report.error)
console.log(
  'Code preloading: cold/prepared touch, zero speculative allocations, abandoned import, guard refusal and disposal passed',
)
