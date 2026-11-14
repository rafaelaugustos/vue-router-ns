import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { recordEnvironment } from '../contracts/environment.mjs'

const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
assert(sim, 'Use a dedicated iPad simulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/drag-drop')
const project = resolve(process.env.XCTEST_PROJECT ?? '/tmp/drag-drop-checks')
const pkg = 'org.nativescript.vuerouterns'
const run = (cmd, args, extra = {}) =>
  exec(cmd, args, { timeout: 30000, maxBuffer: 16 * 1024 * 1024, ...extra })
await mkdir(out, { recursive: true })
await recordEnvironment(out, {
  simulator: sim,
  xcode: (await run('xcodebuild', ['-version'])).stdout.trim(),
})
await run('ruby', ['scripts/native/drag-drop/project.rb', project])
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
    ['simctl', 'io', sim, 'recordVideo', '--codec=h264', `${out}/drag-drop.mp4`],
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
      `${project}/DragDropChecks.xcodeproj`,
      '-scheme',
      'DragDropChecks',
      '-destination',
      `platform=iOS Simulator,id=${sim}`,
      '-derivedDataPath',
      `${project}/build`,
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      `${out}/DragDrop.xcresult`,
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
  if (!/^drop-\d+\.json$/.test(name)) continue
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
  'prepare-repeat',
  'drop-repeat',
  'prepare-cancel',
  'cancel-cancel',
  'prepare-multiple',
  'cancel-multiple',
  ...['invalid', 'expired', 'removed', 'slow', 'guard'].flatMap((mode) => [
    `prepare-${mode}`,
    `drop-${mode}`,
  ]),
  'prepare-accessible',
  'command-accessible',
  'prepare-keyboard',
  'command-keyboard',
  'prepare-clear',
]
assert.deepEqual(
  ordered.map((r) => r.command),
  expected,
)
for (const report of ordered) {
  assert(report.ok, `${report.command}: ${report.error}`)
  for (const stack of Object.values(report.stacks))
    assert.deepEqual(stack.native, stack.logical)
  assert.deepEqual(report.stacks.source.native, ['/library'])
  assert.equal(report.sourceDraft, 'Library draft')
  assert.equal(report.targetDraft, 'Inbox draft')
}
const by = Object.fromEntries(ordered.map((r) => [r.command, r]))
assert.equal(by['drop-valid'].selected, 'target')
assert.equal(by['drop-valid'].result.navigation.status, 'handled')
assert.equal(by['drop-repeat'].result.navigation.failure.type, 16)
assert.notEqual(
  by['drop-valid'].result.intent.delivery.id,
  by['drop-repeat'].result.intent.delivery.id,
)
assert.equal(by['prepare-replay'].result.reason, 'repeat')
for (const mode of ['cancel', 'multiple']) {
  assert.equal(by[`cancel-${mode}`].accepted, by[`prepare-${mode}`].accepted)
  assert.equal(by[`cancel-${mode}`].loaded, by[`prepare-${mode}`].loaded)
}
for (const mode of ['invalid', 'expired', 'removed', 'slow'])
  assert.equal(by[`drop-${mode}`].result.status, 'ignored')
assert.equal(by['drop-guard'].result.navigation.failure.type, 4)
for (const r of ordered.filter((r) => r.command.startsWith('drop-'))) {
  assert.equal(r.origin.windowId, r.target.windowId)
  assert.equal(r.origin.frame, 'source')
  assert.equal(r.target.frame, 'target')
}
assert.equal(by['command-keyboard'].result.intent.source, 'internal')
assert.equal(by['command-keyboard'].drags, 9)
assert.equal(by['command-keyboard'].collections, 18)
assert.equal(by['command-keyboard'].accepted, 9)
assert.equal(by['command-keyboard'].loaded, 8)
assert.equal(by['drop-slow'].loaded, by['prepare-slow'].loaded)
await writeFile(`${out}/summary.json`, JSON.stringify(ordered, null, 2) + '\n')
console.log(`Drag/drop: ${ordered.length} native reports passed`)
