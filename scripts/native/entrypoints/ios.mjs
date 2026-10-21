import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, readdir, writeFile, copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { recordEnvironment } from '../contracts/environment.mjs'
const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
assert(sim, 'Set IOS_SIMULATOR to a dedicated simulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/entrypoints-ios')
const project = resolve(process.env.XCTEST_PROJECT ?? '/tmp/router-entrypoint-tests')
const pkg = 'org.nativescript.vuerouterns'
const run = (cmd, args, options = {}) =>
  exec(cmd, args, { maxBuffer: 32 * 1024 * 1024, ...options })
await mkdir(out, { recursive: true })
await recordEnvironment(out, {
  simulator: sim,
  xcode: (await run('xcodebuild', ['-version'])).stdout.trim(),
})
await run('ruby', ['scripts/native/entrypoints/project.rb', project])
await run('xcrun', ['simctl', 'uninstall', sim, pkg]).catch(() => {})
await run('xcrun', [
  'simctl',
  'install',
  sim,
  'demo/platforms/ios/build/Debug-iphonesimulator/demo.app',
])
let failure
try {
  const result = await run(
    'xcodebuild',
    [
      'test',
      '-project',
      `${project}/EntrypointChecks.xcodeproj`,
      '-scheme',
      'EntrypointChecks',
      '-destination',
      `platform=iOS Simulator,id=${sim}`,
      '-derivedDataPath',
      `${project}/build`,
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      `${out}/Entrypoints.xcresult`,
      ...(process.env.ENTRYPOINT_TEST
        ? [
            `-only-testing:EntrypointChecks/EntrypointUITests/${process.env.ENTRYPOINT_TEST}`,
          ]
        : []),
    ],
    { timeout: 600000 },
  )
  await writeFile(`${out}/xcodebuild.log`, result.stdout + result.stderr)
} catch (error) {
  failure = error
  await writeFile(`${out}/xcodebuild.log`, String(error.stdout) + String(error.stderr))
}
const container = (
  await run('xcrun', ['simctl', 'get_app_container', sim, pkg, 'data'])
).stdout.trim()
const reports = []
for (const name of await readdir(`${container}/Documents`)) {
  if (!/^entrypoints-\d+-\d+\.json$/.test(name)) continue
  await copyFile(`${container}/Documents/${name}`, `${out}/${name}`)
  reports.push(JSON.parse(await readFile(`${container}/Documents/${name}`, 'utf8')))
}
assert(reports.length, 'Native fixture produced reports')
for (const report of reports) assert.equal(report.ok, true, report.error)
if (failure) throw failure
console.log(`Native iOS entrypoints: ${reports.length} passing reports`)
