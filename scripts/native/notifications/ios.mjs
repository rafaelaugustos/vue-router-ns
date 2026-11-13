import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { recordEnvironment } from '../contracts/environment.mjs'

const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
assert(sim, 'Use a dedicated iPad simulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/notifications')
const project = resolve(process.env.XCTEST_PROJECT ?? '/tmp/notifications-checks')
const pkg = 'org.nativescript.vuerouterns'
const run = (cmd, args, extra = {}) =>
  exec(cmd, args, { timeout: 30000, maxBuffer: 16 * 1024 * 1024, ...extra })
await mkdir(out, { recursive: true })
await recordEnvironment(out, {
  simulator: sim,
  xcode: (await run('xcodebuild', ['-version'])).stdout.trim(),
})
await run('ruby', ['scripts/native/notifications/project.rb', project])
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
    ['simctl', 'io', sim, 'recordVideo', '--codec=h264', `${out}/notifications.mp4`],
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
      `${project}/NotificationsChecks.xcodeproj`,
      '-scheme',
      'NotificationsChecks',
      '-destination',
      `platform=iOS Simulator,id=${sim}`,
      '-derivedDataPath',
      `${project}/build`,
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      `${out}/Notifications.xcresult`,
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
  'received-warm',
  'login-warm',
  'repeat',
  'received-invalid',
  'received-expired',
  'received-missing',
  'compare',
  'received-cold',
  'login-cold',
]) {
  const raw = await readFile(
    `${container}/Documents/notification-${name}.json`,
    'utf8',
  ).catch(() => undefined)
  if (!raw) continue
  await writeFile(`${out}/${name}.json`, raw)
  reports.push(JSON.parse(raw))
}
await run('xcrun', ['simctl', 'io', sim, 'screenshot', `${out}/final.png`])
assert(!failure, `Native notifications test failed: ${out}/xcodebuild.log`)
assert.equal(reports.length, 9)
for (const report of reports) {
  assert(report.ok, report.error)
  for (const stack of Object.values(report.stacks))
    assert.deepEqual(stack.native, stack.logical)
  assert.deepEqual(report.stacks.source.native, ['/'])
  assert.equal(report.sourceDraft, 'Unsent source draft')
}
assert.notEqual(
  reports[0].process,
  reports[7].process,
  'Cold notification starts a new process',
)
assert.equal(reports[7].nativeCallbacks, 1)
assert.equal(reports[0].nativeCallbacks, 1)
assert.equal(reports[5].nativeCallbacks, 4)
assert.equal(reports[1].guarded, 1, 'Warm resume passes through the normal guard')
assert.equal(reports[8].guarded, 1, 'Cold resume passes through the normal guard')
for (const report of reports.slice(2, 7))
  assert.deepEqual(
    report.stacks,
    reports[1].stacks,
    'Rejected/duplicate destinations preserve both stacks',
  )
await writeFile(
  `${out}/summary.json`,
  JSON.stringify(
    reports.map(
      ({
        command,
        ok,
        result,
        windowId,
        stacks,
        sourceDraft,
        process,
        nativeCallbacks,
        guarded,
      }) => ({
        command,
        ok,
        result,
        windowId,
        stacks,
        sourceDraft,
        process,
        nativeCallbacks,
        guarded,
      }),
    ),
    null,
    2,
  ) + '\n',
)
console.log(`Notifications: ${reports.length} native reports passed`)
