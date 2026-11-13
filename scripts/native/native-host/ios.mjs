import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
assert(sim, 'Use a dedicated iPad simulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/native-host')
const project = resolve(process.env.XCTEST_PROJECT ?? '/tmp/native-host-checks')
const pkg = 'org.nativescript.hostcontract176'
const run = (cmd, args, extra = {}) =>
  exec(cmd, args, { timeout: 30000, maxBuffer: 16 * 1024 * 1024, ...extra })
await mkdir(out, { recursive: true })
await run('ruby', ['scripts/native/native-host/project.rb', project])
await run('xcrun', ['simctl', 'uninstall', sim, pkg]).catch(() => {})
const built = resolve(
  'examples/native-host-app/platforms/ios/build/Debug-iphonesimulator',
)
const apps = (await readdir(built)).filter((name) => name.endsWith('.app'))
assert.equal(apps.length, 1)
await run('xcrun', ['simctl', 'install', sim, resolve(built, apps[0])])
let recorder, recorded
if (process.env.RECORD_VIDEO === '1') {
  recorder = spawn(
    'xcrun',
    ['simctl', 'io', sim, 'recordVideo', '--codec=h264', `${out}/native-host.mp4`],
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
      `${project}/HostChecks.xcodeproj`,
      '-scheme',
      'HostChecks',
      '-only-testing:HostChecks/HostUITests/testExternalHost',
      '-destination',
      `platform=iOS Simulator,id=${sim}`,
      '-derivedDataPath',
      `${project}/build`,
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      `${out}/Host.xcresult`,
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
  'conformance',
  'prepare',
  'cancelled',
  'guard-on',
  'guarded',
  'committed',
  'detach',
  'reattach',
  'dispose',
]) {
  const raw = await readFile(`${container}/Documents/host-${name}.json`, 'utf8').catch(
    () => undefined,
  )
  if (raw) {
    await writeFile(`${out}/${name}.json`, raw)
    reports.push(JSON.parse(raw))
  }
}
await run('xcrun', ['simctl', 'io', sim, 'screenshot', `${out}/final.png`])
assert(!failure, `Native adapter test failed: ${out}/xcodebuild.log`)
assert.equal(reports.length, 9)
for (const report of reports) assert(report.ok, report.error)
console.log(
  'Packed external NativeHost: conformance, cancelled/blocked/committed Back, detach/reattach and disposal passed',
)
