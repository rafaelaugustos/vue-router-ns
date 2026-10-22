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
const restoreScenes = process.env.RESTORE_SCENES === '1'
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
async function test(method, label) {
  const result = await run(
    'xcodebuild',
    [
      'test',
      '-project',
      `${project}/WindowChecks.xcodeproj`,
      '-scheme',
      'WindowChecks',
      `-only-testing:WindowChecks/WindowUITests/${method}`,
      '-destination',
      `platform=iOS Simulator,id=${sim}`,
      '-derivedDataPath',
      `${project}/build`,
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      `${out}/${label}.xcresult`,
    ],
    { timeout: 600000 },
  )
  await writeFile(`${out}/${label}.log`, result.stdout + result.stderr)
}
try {
  if (restoreScenes) {
    await test('testPrepareOnly', 'prepare')
    // Only a dedicated simulator: restart SpringBoard to discard the app
    // process while preserving UIKit's real scene-session records.
    await run('xcrun', [
      'simctl',
      'spawn',
      sim,
      'launchctl',
      'stop',
      'com.apple.SpringBoard',
    ])
    await test('testResumeOnly', 'restore')
  } else await test('testWindows', 'Windows')
} catch (error) {
  failure = error
  await writeFile(`${out}/xcodebuild.log`, String(error.stdout) + String(error.stderr))
}
const container = (
  await run('xcrun', ['simctl', 'get_app_container', sim, pkg, 'data'])
).stdout.trim()
const reports = []
for (const command of [
  'prepare',
  restoreScenes ? 'restore-scenes' : 'resume',
  'hmr',
  'close',
]) {
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
const resume = reports.find(
  (report) => report.command === (restoreScenes ? 'restore-scenes' : 'resume'),
)
if (restoreScenes) {
  const prepared = reports.find((report) => report.command === 'prepare')
  assert.notEqual(
    resume.pid,
    prepared.pid,
    'UIKit reconstructed sessions in a new app process',
  )
  assert.equal(resume.sessions.length, 2)
  for (const session of resume.sessions) {
    const original = prepared.sessions.find((item) => item.key === session.key)
    assert(original)
    assert.equal(
      session.window,
      original.window,
      'Document stays in its original UIKit session',
    )
    assert.deepEqual(session.entryKeys, original.entryKeys.slice(0, 2))
  }
}
await writeFile(
  `${out}/scene-coverage.json`,
  JSON.stringify(
    {
      backgroundResume: !restoreScenes,
      processRestoration: restoreScenes,
      disconnectedBeforeResume: resume.sceneEvents.filter(
        (event) => event.event === 'sceneDidDisconnect',
      ),
    },
    null,
    2,
  ),
)
console.log(
  restoreScenes
    ? 'iPad OS scene-session restoration, document identity, HMR and closure passed'
    : 'iPad window isolation, modal results, background resume and closure passed',
)
