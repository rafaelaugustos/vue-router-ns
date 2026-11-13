import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { recordEnvironment } from '../contracts/environment.mjs'

const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
assert(sim, 'Use a dedicated iPad simulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/intent-entries')
const project = resolve(process.env.XCTEST_PROJECT ?? '/tmp/intent-entries-checks')
const pkg = 'org.nativescript.vuerouterns'
const run = (cmd, args, extra = {}) =>
  exec(cmd, args, { timeout: 30000, maxBuffer: 16 * 1024 * 1024, ...extra })
await mkdir(out, { recursive: true })
await recordEnvironment(out, {
  simulator: sim,
  xcode: (await run('xcodebuild', ['-version'])).stdout.trim(),
})
await run('ruby', ['scripts/native/intent-entries/project.rb', project])
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
    ['simctl', 'io', sim, 'recordVideo', '--codec=h264', `${out}/intent-entries.mp4`],
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
      `${project}/IntentEntriesChecks.xcodeproj`,
      '-scheme',
      'IntentEntriesChecks',
      '-destination',
      `platform=iOS Simulator,id=${sim}`,
      '-derivedDataPath',
      `${project}/build`,
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      `${out}/IntentEntries.xcresult`,
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
  if (!/^intent-entry-.+\-\d+\.json$/.test(name)) continue
  const raw = await readFile(`${container}/Documents/${name}`, 'utf8')
  await writeFile(`${out}/${name}`, raw)
  reports.push(JSON.parse(raw))
}
await run('xcrun', ['simctl', 'io', sim, 'screenshot', `${out}/final.png`])
assert(!failure, `Native scene intent test failed: ${out}/xcodebuild.log`)
const expected = [
  'publish',
  'rename',
  'received-shortcut-warm-1',
  'login-shortcut-warm-1',
  'replay',
  'received-shortcut-warm-2',
  'prepare-cold',
  'received-shortcut-cold-1',
  'login-shortcut-cold-1',
  'index',
  'received-spotlight-search-1',
  'login-spotlight-search-1',
  'received-spotlight-search-2',
  'revoke-search',
  'received-spotlight-search-3',
  'received-url-search-4',
  'compare',
  'remove-route',
  'received-shortcut-search-5',
  'clear',
]
assert.equal(reports.length, expected.length)
const ordered = expected.map((command) => {
  const matches = reports.filter((report) => report.command === command)
  assert.equal(matches.length, 1, command)
  return matches[0]
})
for (const report of ordered) {
  assert(report.ok, `${report.command}: ${report.error}`)
  for (const stack of Object.values(report.stacks))
    assert.deepEqual(stack.native, stack.logical)
  assert.deepEqual(report.stacks.source.native, ['/'])
  assert.equal(report.sourceDraft, 'Unsent source draft')
}
const by = Object.fromEntries(ordered.map((report) => [report.command, report]))
assert.equal(
  new Set([by.publish.process, by.index.process, by.clear.process]).size,
  3,
  'Two actual cold process starts',
)
for (const name of [
  'login-shortcut-warm-1',
  'login-shortcut-cold-1',
  'login-spotlight-search-1',
]) {
  assert.equal(by[name].guarded, 1)
  assert.deepEqual(by[name].stacks.target.native, ['/', '/articles/7'])
}
assert.equal(by['received-shortcut-warm-1'].nativeCallbacks, 1)
assert.equal(by['received-shortcut-warm-2'].nativeCallbacks, 2)
assert.notEqual(
  by['received-shortcut-warm-1'].result.delivery.id,
  by['received-shortcut-warm-2'].result.delivery.id,
)
assert.equal(by['received-shortcut-cold-1'].nativeCallbacks, 1)
assert.equal(by['received-spotlight-search-1'].nativeCallbacks, 1)
assert.equal(by['received-spotlight-search-3'].result.reason, 'unmatched')
assert.equal(by['received-shortcut-search-5'].result.reason, 'unmatched')
assert.equal(by.replay.result.reason, 'repeat')
assert.equal(by.clear.quickActions, 0)
for (const name of [
  'received-spotlight-search-2',
  'received-spotlight-search-3',
  'received-url-search-4',
  'received-shortcut-search-5',
  'clear',
]) {
  assert.deepEqual(
    by[name].stacks,
    by['login-spotlight-search-1'].stacks,
    `${name} preserves both stacks`,
  )
}
await writeFile(`${out}/summary.json`, JSON.stringify(ordered, null, 2) + '\n')
console.log(`Scene intents: ${ordered.length} native reports passed`)
