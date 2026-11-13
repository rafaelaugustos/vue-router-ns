import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { startDataServer } from './data-server.mjs'
const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
assert(sim, 'Use a dedicated iPad simulator')
const data = process.env.PRELOAD_DATA_TEST === '1'
const out = resolve(
  process.env.OUT ?? `scripts/native/out/${data ? 'preloaddata' : 'preload'}`,
)
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
const server = data ? await startDataServer() : undefined
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
      data
        ? '-only-testing:PreloadChecks/DataPreloadUITests/testDataPreparation'
        : '-only-testing:PreloadChecks/PreloadUITests/testCodePreparation',
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
  await server?.close()
}
const container = (
  await run('xcrun', ['simctl', 'get_app_container', sim, pkg, 'data'])
).stdout.trim()
const reports = []
const names = data
  ? [
      'cold-presented',
      'cold',
      'prepared-before',
      'prepared',
      'abandon',
      'denied',
      'blocked-before',
      'blocked',
      'account-stale',
      'account-before',
      'account',
      'dispose',
    ]
  : [
      'cold',
      'prepared-before',
      'prepared',
      'abandon',
      'blocked-before',
      'blocked',
      'dispose',
    ]
for (const name of names) {
  const raw = await readFile(
    `${container}/Documents/${data ? 'preloaddata' : 'preload'}-${name}.json`,
    'utf8',
  ).catch(() => undefined)
  if (raw) {
    await writeFile(`${out}/${name}.json`, raw)
    reports.push(JSON.parse(raw))
  }
}
await run('xcrun', ['simctl', 'io', sim, 'screenshot', `${out}/final.png`])
if (server)
  await writeFile(`${out}/http.json`, JSON.stringify(server.requests, null, 2) + '\n')
assert(!failure, `Native preload test failed: ${out}/xcodebuild.log`)
assert.equal(reports.length, names.length)
for (const report of reports) assert(report.ok, report.error)
if (server) {
  assert.deepEqual(
    server.requests.map(({ account, id }) => `${account}/${id}`),
    [
      'A/cold',
      'A/prepared',
      'A/abandon',
      'A/blocked',
      'A/account',
      'B/account',
      'A/dispose',
    ],
  )
  assert(
    server.requests.every((request) => request.completed),
    'Even abandoned requests complete at transport level',
  )
}
console.log(
  `${data ? 'Data' : 'Code'} preloading: ${reports.length} native reports passed`,
)
