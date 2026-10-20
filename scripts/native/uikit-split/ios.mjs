import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, readdir, writeFile, copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { recordEnvironment } from '../contracts/environment.mjs'
const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
assert(sim, 'Select a dedicated simulator with IOS_SIMULATOR')
const resize = process.env.SPLIT_RESIZE === '1'
const out = resolve(process.env.OUT ?? 'scripts/native/out/uikit-split')
const project = resolve(process.env.XCTEST_PROJECT ?? '/tmp/router-split-tests')
const pkg = 'org.nativescript.vuerouterns'
const run = (cmd, args, options = {}) =>
  exec(cmd, args, { maxBuffer: 32 * 1024 * 1024, ...options })
await mkdir(out, { recursive: true })
const devices = JSON.parse(
  (await run('xcrun', ['simctl', 'list', 'devices', '-j'])).stdout,
)
await recordEnvironment(out, {
  simulator: Object.values(devices.devices)
    .flat()
    .find((device) => device.udid === sim),
  xcode: (await run('xcodebuild', ['-version'])).stdout.trim(),
})
await run('ruby', ['scripts/native/uikit-split/project.rb', project])
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
      `${project}/SplitChecks.xcodeproj`,
      '-scheme',
      'SplitChecks',
      '-destination',
      `platform=iOS Simulator,id=${sim}`,
      '-derivedDataPath',
      `${project}/build`,
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      `${out}/Split.xcresult`,
      `-only-testing:SplitChecks/SplitUITests/${resize ? 'testWindowResize' : 'testNavigation'}`,
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
  if (!/^uikitsplit-\d+-\d+\.json$/.test(name)) continue
  await copyFile(`${container}/Documents/${name}`, `${out}/${name}`)
  reports.push(JSON.parse(await readFile(`${container}/Documents/${name}`, 'utf8')))
}
reports.sort((a, b) => a.pid - b.pid || a.sequence - b.sequence)
await writeFile(`${out}/results.json`, JSON.stringify(reports, null, 2))
await run('xcrun', ['simctl', 'io', sim, 'screenshot', `${out}/final.png`]).catch(
  () => {},
)
await run('xcrun', ['simctl', 'terminate', sim, pkg]).catch(() => {})
assert(!failure, `XCTest failed: ${out}/xcodebuild.log`)
assert(reports.length > 0, 'No native reports')
for (const report of reports) {
  assert(!report.error, `${report.command}: ${report.error}`)
  assert(report.splitRoot, 'UIKit SplitView must own the window root')
  assert.equal(
    report.diagnostics.issues.length,
    0,
    JSON.stringify(report.diagnostics.issues),
  )
}
if (resize) {
  const identities = reports.filter((report) => report.command === 'identities')
  assert(
    identities.some((report) => report.collapsed),
    'OS resize must collapse the columns',
  )
  assert.equal(
    identities.at(-1)?.collapsed,
    false,
    'OS resize must expand the columns again',
  )
  assert(
    new Set(reports.map((report) => report.width)).size > 1,
    'The UIWindow must resize, not scale',
  )
} else {
  assert(
    reports.some((report) => report.command === 'restored'),
    'Missing process restoration',
  )
  assert(
    reports.some((report) => report.command === 'guarded' && report.modalResults === 0),
    'Missing native guard checks',
  )
  assert(
    reports.some((report) => report.command === 'close' && report.modalResults === 1),
    'Missing modal result',
  )
  assert(
    new Set(reports.map((report) => report.pid)).size === 2,
    'Restoration needs two processes',
  )
}
console.log(`UIKit split ${resize ? 'window resizing' : 'navigation'} passed: ${out}`)
