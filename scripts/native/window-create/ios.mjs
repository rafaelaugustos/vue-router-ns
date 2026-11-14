import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { recordEnvironment } from '../contracts/environment.mjs'

const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
assert(sim, 'Use a dedicated iPad simulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/window-create')
const project = resolve(process.env.XCTEST_PROJECT ?? '/tmp/window-create-checks')
const pkg = 'org.nativescript.vuerouterns'
const run = (cmd, args, extra = {}) =>
  exec(cmd, args, { timeout: 30000, maxBuffer: 16 * 1024 * 1024, ...extra })
await mkdir(out, { recursive: true })
await recordEnvironment(out, {
  simulator: sim,
  xcode: (await run('xcodebuild', ['-version'])).stdout.trim(),
})
await run('ruby', ['scripts/native/window-create/project.rb', project])
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
    ['simctl', 'io', sim, 'recordVideo', '--codec=h264', `${out}/window-create.mp4`],
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
      `${project}/WindowCreateChecks.xcodeproj`,
      '-scheme',
      'WindowCreateChecks',
      '-destination',
      `platform=iOS Simulator,id=${sim}`,
      '-derivedDataPath',
      `${project}/build`,
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      `${out}/WindowCreate.xcresult`,
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
    if (recorder.exitCode !== null || recorder.signalCode !== null)
      failure ??= new Error('Recording stopped before native acceptance finished')
    recorder.kill('SIGINT')
    await recorded
  }
}
const container = (
  await run('xcrun', ['simctl', 'get_app_container', sim, pkg, 'data'])
).stdout.trim()
const reports = []
for (const name of await readdir(`${container}/Documents`)) {
  if (!/^windowcreate-\d+\.json$/.test(name)) continue
  const raw = await readFile(`${container}/Documents/${name}`, 'utf8')
  await writeFile(`${out}/${name}`, raw)
  reports.push(JSON.parse(raw))
}
await run('xcrun', ['simctl', 'io', sim, 'screenshot', `${out}/final.png`])
assert(!failure, `Native drag/drop test failed: ${out}/xcodebuild.log`)
const ordered = reports.sort((a, b) => a.sequence - b.sequence)
const expected = [
  'ready',
  'drop-valid',
  'prepare-replay',
  ...[
    'cancel',
    'guard',
    'account',
    'permission',
    'removed',
    'expired',
    'close',
    'race',
  ].flatMap((mode) => [
    `prepare-${mode}`,
    ...(mode === 'race' ? ['guard-waiting'] : []),
    mode === 'cancel' ? 'cancel-cancel' : `drop-${mode}`,
  ]),
  'prepare-button',
  'command-button',
  'prepare-keyboard',
  'command-keyboard',
  'prepare-clear',
]
assert.deepEqual(
  ordered.map((r) => r.command),
  expected,
)
assert.equal(new Set(ordered.map((r) => r.process)).size, 1)
for (const r of ordered) {
  assert(r.ok, `${r.command}: ${r.error}`)
  const source = r.owners.find((s) => s.key === 'source')
  assert.deepEqual(source.logical, ['/library'])
  assert.deepEqual(source.native, ['/library'])
  assert.equal(source.draft, 'Library draft')
  assert.equal(source.guarded, 0)
  for (const s of r.owners) {
    assert.deepEqual(s.logical, s.native)
    if (s.key !== 'source') {
      assert.notEqual(s.windowId, source.windowId)
      assert.notEqual(s.sceneId, source.sceneId)
    }
  }
  if (r.command !== 'guard-waiting') assert.equal(r.pending, 0)
}
const by = Object.fromEntries(ordered.map((r) => [r.command, r]))
assert.equal(by['drop-valid'].explicitRequests, 0)
assert.equal(by['drop-valid'].connections.length, 1)
assert.equal(
  by['cancel-cancel'].connections.length,
  by['prepare-cancel'].connections.length,
)
for (const [mode, reason] of [
  ['account', 'scope-changed'],
  ['permission', 'unauthorized'],
  ['removed', 'unmatched'],
  ['expired', 'expired'],
  ['close', 'cancelled'],
]) {
  const r = by[`drop-${mode}`]
  assert.equal(r.result.reason, reason)
  assert.equal(r.nativeWindowIds.length, 1)
}
assert.equal(by['drop-guard'].result.failure.type, 4)
assert.equal(by['drop-race'].result.failure.type, 8)
assert.equal(by['drop-race'].nativeWindowIds.length, 1)
assert.equal(by['prepare-replay'].result.reason, 'repeat')
for (const name of ['drop-valid', 'command-button', 'command-keyboard']) {
  const r = by[name],
    target = r.owners.find((s) => s.key !== 'source')
  assert.equal(r.result.status, 'handled')
  assert.equal(r.result.failure, undefined)
  assert.equal(r.result.intent.target.windowId, target.windowId)
  assert.equal(r.result.intent.target.frame, 'main')
  assert.equal(r.result.intent.source, name === 'drop-valid' ? 'drag-drop' : 'internal')
  assert.deepEqual(target.native, ['/inbox', '/documents/7'])
  assert.equal(target.draft, 'New window draft')
}
const last = ordered.at(-1)
assert.equal(last.drags, 9)
assert.equal(last.collections, 18)
assert.equal(last.copyEnds, 8)
assert.equal(last.cancelEnds, 1)
assert.equal(last.explicitRequests, 2)
assert.equal(last.connections.length, 10)
assert.equal(last.closed.length, 10)
assert.equal(last.allocations, 6)
assert.equal(last.nativeWindowIds.length, 1)
assert.equal(last.pending, 0)
await writeFile(`${out}/summary.json`, JSON.stringify(ordered, null, 2) + '\n')
console.log(`Native edge creation: ${ordered.length} reports passed`)
