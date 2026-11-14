import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { recordEnvironment } from '../contracts/environment.mjs'

const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
assert(sim, 'Use a dedicated iPad simulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/sidebar-drop')
const project = resolve(process.env.XCTEST_PROJECT ?? '/tmp/sidebar-drop-checks')
const pkg = 'org.nativescript.vuerouterns'
const run = (cmd, args, extra = {}) =>
  exec(cmd, args, { timeout: 30000, maxBuffer: 16 * 1024 * 1024, ...extra })
await mkdir(out, { recursive: true })
await recordEnvironment(out, {
  simulator: sim,
  xcode: (await run('xcodebuild', ['-version'])).stdout.trim(),
})
await run('ruby', ['scripts/native/sidebar-drop/project.rb', project])
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
    ['simctl', 'io', sim, 'recordVideo', '--codec=h264', `${out}/sidebar-drop.mp4`],
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
      `${project}/SidebarDropChecks.xcodeproj`,
      '-scheme',
      'SidebarDropChecks',
      '-destination',
      `platform=iOS Simulator,id=${sim}`,
      '-derivedDataPath',
      `${project}/build`,
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      `${out}/SidebarDrop.xcresult`,
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
      failure ??= new Error('Screen recording stopped before native acceptance finished')
    recorder.kill('SIGINT')
    await recorded
  }
}
const container = (
  await run('xcrun', ['simctl', 'get_app_container', sim, pkg, 'data'])
).stdout.trim()
const reports = []
for (const name of await readdir(`${container}/Documents`)) {
  if (!/^sidebar-drop-\d+\.json$/.test(name)) continue
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
  'prepare-archive',
  'drop-archive',
  'prepare-replay',
  'prepare-repeat',
  'drop-repeat',
  ...[
    'cancel',
    'multiple',
    'removehover',
    'slow',
    'owner',
    'permission',
    'guard',
  ].flatMap((mode) => [
    `prepare-${mode}`,
    `${['cancel', 'multiple', 'removehover'].includes(mode) ? 'cancel' : 'drop'}-${mode}`,
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
assert.equal(new Set(ordered.map((r) => r.process)).size, 1)
for (const report of ordered) {
  assert(report.ok, `${report.command}: ${report.error}`)
  assert.equal(report.presentation, 'permanent')
  assert.equal(report.highlighted, null)
  for (const stack of Object.values(report.stacks))
    assert.deepEqual(stack.native, stack.logical)
  assert.deepEqual(report.stacks.source.native, ['/library'])
  assert.deepEqual(report.drafts, {
    source: 'Library draft',
    inbox: 'Inbox draft',
    archive: 'Archive draft',
  })
  for (const hover of report.hovered) assert.equal(hover.selected, 'source')
}
const by = Object.fromEntries(ordered.map((r) => [r.command, r]))
for (const [name, destination] of [
  ['valid', 'inbox'],
  ['archive', 'archive'],
]) {
  const r = by[`drop-${name}`]
  assert.equal(r.selected, destination)
  assert.equal(r.result.navigation.status, 'handled')
  assert.equal(r.result.navigation.failure, undefined)
  assert.deepEqual(r.stacks[destination].native, [`/${destination}`, '/documents/7'])
}
assert.deepEqual(by['drop-archive'].stacks.inbox.native, ['/inbox', '/documents/7'])
assert.equal(by['drop-repeat'].result.navigation.failure.type, 16)
assert.notEqual(
  by['drop-repeat'].result.intent.delivery.id,
  by['drop-valid'].result.intent.delivery.id,
)
assert.equal(by['prepare-replay'].result.reason, 'repeat')
for (const mode of ['cancel', 'multiple', 'removehover']) {
  const before = by[`prepare-${mode}`],
    after = by[`cancel-${mode}`]
  assert.equal(after.accepted, before.accepted)
  assert.equal(after.loaded, before.loaded)
  assert.deepEqual(after.stacks, before.stacks)
}
assert(by['cancel-removehover'].hovered.length > 0)
assert.equal(by['cancel-removehover'].disabled, 'inbox')
for (const [mode, reason] of [
  ['slow', 'disposed'],
  ['owner', 'owner-changed'],
  ['permission', 'unauthorized'],
]) {
  assert.equal(by[`drop-${mode}`].result.reason, reason)
  assert.deepEqual(by[`drop-${mode}`].stacks, by[`prepare-${mode}`].stacks)
  assert.equal(by[`drop-${mode}`].selected, 'source')
}
assert.equal(by['drop-guard'].result.navigation.failure.type, 4)
for (const r of ordered.filter((r) => r.command.startsWith('drop-'))) {
  assert.equal(r.origin.windowId, r.target.windowId)
  assert.equal(r.origin.frame, 'source')
  assert.equal(r.target.frame, r.mode === 'archive' ? 'archive' : 'inbox')
}
assert.equal(by['command-accessible'].result.intent.source, 'internal')
assert.equal(by['command-accessible'].target.frame, 'archive')
assert.equal(by['command-keyboard'].result.intent.source, 'internal')
assert.equal(by['command-keyboard'].drags, 10)
assert.equal(by['command-keyboard'].collections, 20)
assert.equal(by['command-keyboard'].drops, 7)
assert.equal(by['command-keyboard'].accepted, 9)
assert.equal(by['command-keyboard'].loaded, 7)
await writeFile(`${out}/summary.json`, JSON.stringify(ordered, null, 2) + '\n')
console.log(`Sidebar drop: ${ordered.length} native reports passed`)
