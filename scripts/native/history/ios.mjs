import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
assert(sim, 'Use a dedicated iPad simulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/history')
const project = resolve(process.env.XCTEST_PROJECT ?? '/tmp/history-checks')
const pkg = 'org.nativescript.vuerouterns'
const guards = process.env.HISTORY_GUARDS === '1'
const audit = process.env.HISTORY_MENU_AUDIT === '1'
const menu = process.env.HISTORY_MENU === '1' || audit
const run = (cmd, args, extra = {}) =>
  exec(cmd, args, { timeout: 30000, maxBuffer: 16 * 1024 * 1024, ...extra })
await mkdir(out, { recursive: true })
if (process.env.XCTEST_PREPARED === '1') {
  await access(`${project}/HistoryChecks.xcodeproj/project.pbxproj`)
} else {
  await run('ruby', ['scripts/native/history/project.rb', project])
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
    ['simctl', 'io', sim, 'recordVideo', '--codec=h264', `${out}/history.mp4`],
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
      `${project}/HistoryChecks.xcodeproj`,
      '-scheme',
      'HistoryChecks',
      guards
        ? '-only-testing:HistoryChecks/MenuUITests/testGuardedBack'
        : audit
          ? '-only-testing:HistoryChecks/MenuUITests/testGuardedUIKitHistoryAudit'
          : menu
            ? '-only-testing:HistoryChecks/MenuUITests/testBackHistoryMenu'
            : '-only-testing:HistoryChecks/HistoryUITests/testRetainedHistory',
      '-destination',
      `platform=iOS Simulator,id=${sim}`,
      '-derivedDataPath',
      `${project}/build`,
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      `${out}/History.xcresult`,
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
for (const name of guards
  ? [
      'seed',
      'guard',
      'protect',
      'protected',
      'header',
      'header-ok',
      'confirm',
      'selected',
      'arm',
      'unchanged',
      'single',
      'handoff',
      'native',
      'teardown',
    ]
  : audit
    ? ['seed', 'guard', 'unchanged']
    : menu
      ? [
          'seed',
          'native',
          'unchanged',
          'guard',
          'refused',
          'selected',
          'invalidate',
          'dispose',
        ]
      : [
          'seed',
          'blocked',
          'jump',
          'stale',
          'prepare',
          'cancelled',
          'native',
          'dispose',
        ]) {
  const raw = await readFile(`${container}/Documents/history-${name}.json`, 'utf8').catch(
    () => undefined,
  )
  if (raw) {
    await writeFile(`${out}/${name}.json`, raw)
    reports.push(JSON.parse(raw))
  }
}
await run('xcrun', ['simctl', 'io', sim, 'screenshot', `${out}/final.png`])
assert(!failure, `Native history test failed: ${out}/xcodebuild.log`)
assert.equal(reports.length, guards ? 14 : audit ? 3 : 8)
for (const report of reports) assert(report.ok, report.error)
console.log(
  guards
    ? 'Guarded UIKit Back: refusal, covered guard, confirmation, exact duplicate, header ownership, stale menu and restoration passed'
    : audit
      ? 'UIKit guard regression: native history selection preserves the guarded stack'
      : menu
        ? 'Back history menu: UIKit audit, long press, keyboard, dismissal, guards, duplicates and disposal passed'
        : 'Retained history: exact duplicates, guards, other stack isolation, native gestures and disposal passed',
)
