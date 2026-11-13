import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
assert(sim, 'Use a dedicated iPad simulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/recording')
const project = resolve(process.env.XCTEST_PROJECT ?? '/tmp/recording-checks')
const pkg = 'org.nativescript.vuerouterns'
const run = (cmd, args, extra = {}) =>
  exec(cmd, args, { timeout: 30000, maxBuffer: 16 * 1024 * 1024, ...extra })
await mkdir(out, { recursive: true })
await run('ruby', ['scripts/native/recording/project.rb', project])
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
    ['simctl', 'io', sim, 'recordVideo', '--codec=h264', `${out}/recording.mp4`],
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
      `${project}/RecordingChecks.xcodeproj`,
      '-scheme',
      'RecordingChecks',
      '-destination',
      `platform=iOS Simulator,id=${sim}`,
      '-derivedDataPath',
      `${project}/build`,
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      `${out}/Recording.xcresult`,
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
  'initial',
  'success',
  'blocked',
  'cancelled',
  'modal',
  'divergence',
  'recovery',
  'truncate',
  'clear',
  'stop',
]) {
  const raw = await readFile(
    `${container}/Documents/recording-${name}.json`,
    'utf8',
  ).catch(() => undefined)
  if (!raw) continue
  await writeFile(`${out}/${name}.json`, raw)
  const report = JSON.parse(raw),
    capture = report.capture
  assert.equal(capture.retainedBytes, Buffer.byteLength(JSON.stringify(capture.records)))
  assert(capture.retainedBytes <= capture.limits.maxBytes)
  assert(capture.records.length <= capture.limits.maxRecords)
  reports.push(report)
}
const legacy = await readFile(`${container}/Documents/recording-v1.json`, 'utf8').catch(
  () => undefined,
)
if (legacy) await writeFile(`${out}/v1.json`, legacy)
await run('xcrun', ['simctl', 'io', sim, 'screenshot', `${out}/final.png`])
assert(!failure, `Native recording test failed: ${out}/xcodebuild.log`)
assert.equal(reports.length, 10)
for (const report of reports) assert(report.ok, report.error)
assert(legacy, 'The existing viewer still receives a v1 export')
await writeFile(
  `${out}/summary.json`,
  JSON.stringify(
    reports.map(({ command, capture: c }) => ({
      command,
      records: c.records.length,
      retainedBytes: c.retainedBytes,
      exportBytes: Buffer.byteLength(JSON.stringify(c)),
      dropped: c.droppedRecords,
      cleared: c.clearedRecords,
      overhead: c.overhead,
    })),
    null,
    2,
  ) + '\n',
)
console.log(`Recording: ${reports.length} native reports passed`)
