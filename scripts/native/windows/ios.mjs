import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
assert(sim, 'Set IOS_SIMULATOR to a dedicated iPad simulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/windows-ios')
const project = resolve(process.env.XCTEST_PROJECT ?? '/tmp/router-window-tests')
const pkg = 'org.nativescript.vuerouterns'
const run = (cmd, args, options = {}) =>
  exec(cmd, args, { maxBuffer: 32 * 1024 * 1024, ...options })
await mkdir(out, { recursive: true })
await run('ruby', ['scripts/native/windows/project.rb', project])
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
      `${project}/WindowChecks.xcodeproj`,
      '-scheme',
      'WindowChecks',
      '-destination',
      `platform=iOS Simulator,id=${sim}`,
      '-derivedDataPath',
      `${project}/build`,
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      `${out}/Windows.xcresult`,
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
for (const command of ['prepare', 'resume', 'hmr', 'close']) {
  const source = await readFile(
    `${container}/Documents/windows-${command}.json`,
    'utf8',
  ).catch(() => undefined)
  if (!source) continue
  await writeFile(`${out}/${command}.json`, source)
  reports.push(JSON.parse(source))
}
await run('xcrun', ['simctl', 'io', sim, 'screenshot', `${out}/final.png`]).catch(
  () => {},
)
assert(!failure, `XCTest failed: ${out}/xcodebuild.log`)
assert.equal(reports.length, 4)
for (const report of reports) assert(report.ok, report.error)
// Foreground/background alone does not prove OS-driven scene reconnection.
const resume = reports.find((report) => report.command === 'resume')
await writeFile(
  `${out}/scene-coverage.json`,
  JSON.stringify(
    {
      backgroundResume: true,
      disconnectedBeforeResume: resume.sceneEvents.filter(
        (event) => event.event === 'sceneDidDisconnect',
      ),
    },
    null,
    2,
  ),
)
console.log('iPad window isolation, modal results, background resume and closure passed')
