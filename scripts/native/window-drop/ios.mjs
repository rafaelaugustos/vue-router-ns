import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { recordEnvironment } from '../contracts/environment.mjs'

const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
assert(sim, 'Use a dedicated iPad simulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/window-drop')
const project = resolve(process.env.XCTEST_PROJECT ?? '/tmp/window-drop-checks')
const pkg = 'org.nativescript.vuerouterns'
const run = (cmd, args, extra = {}) =>
  exec(cmd, args, { timeout: 30000, maxBuffer: 16 * 1024 * 1024, ...extra })
await mkdir(out, { recursive: true })
await recordEnvironment(out, {
  simulator: sim,
  xcode: (await run('xcodebuild', ['-version'])).stdout.trim(),
})
await run('ruby', ['scripts/native/window-drop/project.rb', project])
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
    ['simctl', 'io', sim, 'recordVideo', '--codec=h264', `${out}/window-drop.mp4`],
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
      `${project}/WindowDropChecks.xcodeproj`,
      '-scheme',
      'WindowDropChecks',
      '-destination',
      `platform=iOS Simulator,id=${sim}`,
      '-derivedDataPath',
      `${project}/build`,
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      `${out}/WindowDrop.xcresult`,
    ],
    { timeout: 600000 },
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
for (const name of await readdir(`${container}/Documents`)) {
  if (!/^windowdrop-\d+\.json$/.test(name)) continue
  const raw = await readFile(`${container}/Documents/${name}`, 'utf8')
  await writeFile(`${out}/${name}`, raw)
  reports.push(JSON.parse(raw))
}
await run('xcrun', ['simctl', 'io', sim, 'screenshot', `${out}/final.png`])
assert(!failure, `Native drag/drop test failed: ${out}/xcodebuild.log`)
const ordered = reports.sort((a, b) => a.sequence - b.sequence)
const expected = [
  'ready',
  'create-target',
  'drop-valid',
  'prepare-replay',
  ...['repeat', 'guard', 'account', 'removed'].flatMap((mode) => [
    `prepare-${mode}`,
    `drop-${mode}`,
  ]),
  'prepare-cancel',
  'cancel-cancel',
  'prepare-accessible',
  'command-accessible',
  'prepare-close',
  'drop-close',
  'prepare-clear',
]
assert.deepEqual(
  ordered.map((r) => r.command),
  expected,
)
for (const report of ordered) {
  assert(report.ok, `${report.command}: ${report.error}`)
  for (const [key, owner] of Object.entries(report.owners)) {
    assert.deepEqual(owner.logical, owner.native)
    assert.equal(owner.frame, 'main')
    assert.equal(owner.draft, `Independent draft ${key.toUpperCase()}`)
  }
  assert.deepEqual(report.owners.a.native, ['/library'])
  assert.equal(report.owners.a.guarded, 0)
  if (report.owners.b) {
    assert.notEqual(report.owners.a.windowId, report.owners.b.windowId)
    assert.notEqual(report.owners.a.sceneId, report.owners.b.sceneId)
  }
  if (report.command.startsWith('drop-') || report.command === 'command-accessible') {
    assert.equal(report.origin.windowId, report.owners.a.windowId)
    assert.notEqual(report.origin.windowId, report.target.windowId)
    assert.equal(report.origin.frame, report.target.frame)
  }
}
const by = Object.fromEntries(ordered.map((r) => [r.command, r]))
assert.equal(by['drop-valid'].result.navigation.status, 'handled')
assert.equal(
  by['drop-valid'].result.intent.target.windowId,
  by['drop-valid'].owners.b.windowId,
)
assert.equal(by['prepare-replay'].result.reason, 'repeat')
assert.equal(by['drop-repeat'].result.navigation.failure.type, 16)
assert.notEqual(
  by['drop-valid'].result.intent.delivery.id,
  by['drop-repeat'].result.intent.delivery.id,
)
assert.equal(by['drop-guard'].result.navigation.failure.type, 4)
assert.equal(by['drop-account'].result.reason, 'owner-changed')
assert.equal(by['drop-removed'].result.reason, 'unauthorized')
assert.equal(by['cancel-cancel'].accepted, by['prepare-cancel'].accepted)
assert.equal(by['command-accessible'].result.intent.source, 'internal')
const closed = by['drop-close'],
  final = by['prepare-clear']
assert.equal(closed.result.reason, 'disposed')
assert(closed.target.closed)
assert.deepEqual(Object.keys(closed.owners), ['a'])
assert.deepEqual(closed.closedTarget.native, ['/inbox'])
assert.equal(closed.closedTarget.draft, 'Independent draft B')
assert.equal(closed.loaded, by['prepare-close'].loaded)
assert.equal(final.allocations, 1)
assert.equal(final.drags, 7)
assert.equal(final.collections, 14)
assert.equal(final.accepted, 7)
assert.equal(final.loaded, 5)
await writeFile(`${out}/summary.json`, JSON.stringify(ordered, null, 2))
console.log(`Cross-window drop: ${ordered.length} native reports passed`)
