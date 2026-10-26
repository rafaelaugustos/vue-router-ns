import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { initialize, command, ios, sim, pkg, pause, out } from './bridge.mjs'

const exec = promisify(execFile)
assert(
  sim,
  'Set IOS_SIMULATOR to a dedicated booted iPad (this driver reinstalls the app)',
)
await initialize()
const directory = `${await ios('get_app_container', sim, pkg, 'data')}/Documents/adaptive`
await command('push', 'settings')
await command('draft', { frame: 'settings', text: 'Inactive settings draft' })
await command('draft', { frame: 'home', text: 'Home draft survives rotation' })
await command('select', 'home')
await writeFile(`/tmp/router-rotation-${sim}.json`, JSON.stringify({ directory }))
const project = await mkdtemp(join(tmpdir(), 'router-rotation-tests-'))
await exec(process.env.RUBY ?? 'ruby', [
  'scripts/native/adaptive-drawer/project.rb',
  project,
  'rotation',
])
let recording
if (process.env.RECORD_VIDEO === '1') {
  recording = spawn(
    'xcrun',
    ['simctl', 'io', sim, 'recordVideo', '--codec=h264', join(out, 'rotation.mp4')],
    { stdio: 'ignore' },
  )
  await pause(500)
}
let testError
try {
  const result = await exec(
    'xcodebuild',
    [
      'test',
      '-project',
      join(project, 'AdaptiveDrawerChecks.xcodeproj'),
      '-scheme',
      'AdaptiveDrawerChecks',
      '-destination',
      `platform=iOS Simulator,id=${sim}`,
      '-parallel-testing-enabled',
      'NO',
      '-derivedDataPath',
      join(project, 'build'),
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      join(out, 'rotation.xcresult'),
    ],
    { timeout: 240000, maxBuffer: 16 * 1024 * 1024 },
  )
  await writeFile(join(out, 'rotation-xctest.log'), result.stdout + result.stderr)
} catch (error) {
  testError = error
  await writeFile(
    join(out, 'rotation-xctest.log'),
    `${error.stdout ?? ''}\n${error.stderr ?? ''}`,
  )
} finally {
  if (recording && recording.exitCode === null) {
    const stopped = new Promise((resolve) => recording.once('exit', resolve))
    recording.kill('SIGINT')
    await stopped
  }
}
const cases = {}
for (const name of await readdir(directory)) {
  if (!/^(push-device-|back-device-|commit-|cancel-|settled|modal).*\.json$/.test(name))
    continue
  const value = await readFile(join(directory, name), 'utf8')
  await writeFile(join(out, name), value)
  if (!name.endsWith('-driver.json')) cases[name.replace('.json', '')] = JSON.parse(value)
}
if (testError) throw new Error(`XCTest failed; see ${join(out, 'rotation-xctest.log')}`)
assert.equal(
  Object.keys(cases).length,
  10,
  'Every direction, gesture intent and control must produce evidence',
)
const summary = []
for (const [name, report] of Object.entries(cases)) {
  assert(report.finished && !report.error, `${name}: ${report.error ?? 'unfinished'}`)
  const { before, after, events, operation } = report
  if (report.notReproduced) {
    assert(operation.startsWith('gesture') && report.landscape === false)
    assert.deepEqual(after.frames, before.frames)
    assert.deepEqual(after.captures, before.captures)
    assert.deepEqual(after.entries, before.entries)
    assert.deepEqual(after.issues, [])
    assert(!events.some((e) => e.kind === 'navigation-observed'))
    summary.push({
      case: name,
      requestedDuringNavigation: false,
      visualOverlap: null,
      navigationCancelled: null,
      result: 'gesture-not-reproduced',
    })
    continue
  }
  const navigates = operation !== 'settled'
  const nativeStart = events.find((e) => e.kind === 'navigation-observed')
  const nativeEnd = events.find((e) => e.kind === 'navigation-ended')
  const rotation = events.find((e) => e.kind === 'rotation-began')
  const driver = JSON.parse(await readFile(join(out, `${name}-driver.json`), 'utf8'))
  assert(
    rotation && events.some((e) => e.kind === 'rotation-ended'),
    `${name}: rotation never completed`,
  )
  if (navigates) {
    assert(
      nativeStart && nativeEnd && nativeStart.duration > 0,
      `${name}: missing animated navigation`,
    )
    assert(
      driver.requestedAt >= nativeStart.wallTime &&
        driver.requestedAt < nativeEnd.wallTime,
      `${name}: orientation must be requested while navigation is active`,
    )
    assert.equal(events.filter((e) => e.kind === 'navigation-ended').length, 1)
    assert.equal(nativeStart.interactive, operation.startsWith('gesture'))
  }
  assert.equal(
    report.settlements,
    operation.startsWith('push') || operation.startsWith('back') ? 1 : 0,
  )
  assert.equal(after.mode, report.landscape ? 'permanent' : 'overlay', name)
  assert.equal(after.open, false)
  assert.equal(after.contentHidden, false)
  assert.equal(after.paneHidden, after.mode === 'overlay')
  assert(after.geometry.content.width > 0 && after.geometry.content.height > 0)
  assert.equal(after.bounds[0].width, after.geometry.content.width)
  if (after.mode === 'permanent') {
    assert.equal(after.bounds[0].x, after.geometry.pane.width)
    assert.equal(after.bounds[1].width, after.geometry.pane.width)
  }
  assert.equal(after.selected, before.selected)
  assert.equal(after.result, before.result)
  assert.equal(after.resultSettlements, before.resultSettlements)
  assert.deepEqual(after.issues, [])
  assert(
    after.diagnostics.stacks.every((stack) => !stack.busy),
    `${name}: busy stack after settlement`,
  )
  for (const stack of after.diagnostics.stacks) {
    assert.deepEqual(
      stack.native.flatMap((host) => host.entries),
      stack.logical.map((entry) => entry.id),
      `${name}: native/logical history mismatch`,
    )
  }
  const beforeHome = before.frames.find((f) => f.name === 'home')
  const afterHome = after.frames.find((f) => f.name === 'home')
  const popped = navigates && !operation.startsWith('push') && !nativeEnd.cancelled
  const poppedPage = popped ? beforeHome.pages.at(-1) : null
  assert.equal(
    after.captures.length,
    before.captures.length + Number(operation.startsWith('push')),
    `${name}: unexpected Vue mount`,
  )
  for (const stack of before.diagnostics.stacks) {
    const current = after.diagnostics.stacks.find((item) => item.id === stack.id)
    assert(current, `${name}: logical stack replaced`)
    const retained = stack.logical.map((entry) => entry.id)
    if (stack.name === 'home' && popped) retained.pop()
    assert.deepEqual(
      current.logical.slice(0, retained.length).map((entry) => entry.id),
      retained,
      `${name}: surviving logical entry IDs changed`,
    )
  }
  for (const frame of before.frames) {
    const current = after.frames.find((f) => f.id === frame.id)
    assert(current, `${name}: Frame replaced`)
    assert.equal(current.native, frame.native)
    assert.deepEqual(
      current.controllers,
      current.pageControllers,
      `${name}: orphan native controller`,
    )
    if (frame.name === 'settings')
      assert.deepEqual(current, frame, `${name}: inactive stack changed`)
  }
  const expected = operation.startsWith('push')
    ? beforeHome.pages.length + 1
    : beforeHome.pages.length - Number(popped)
  assert.equal(afterHome.pages.length, expected, name)
  assert.deepEqual(
    afterHome.pages.slice(0, beforeHome.pages.length - Number(popped)),
    beforeHome.pages.slice(0, beforeHome.pages.length - Number(popped)),
  )
  for (const capture of before.captures) {
    const current = after.captures.find((item) => item.id === capture.id)
    assert(current, `${name}: Vue instance replaced`)
    assert.equal(current.page, capture.page)
    assert.equal(current.draft, capture.draft)
    if (capture.page === poppedPage) {
      assert.equal(current.alive, false)
      assert.equal(current.disposals, 1)
    } else {
      assert.equal(current.alive, capture.alive)
      assert.equal(current.disposals, capture.disposals)
      if (capture.alive) assert.equal(current.native, capture.native)
    }
  }
  const inactive = before.diagnostics.stacks.find((stack) => stack.name === 'settings')
  assert.deepEqual(
    after.diagnostics.stacks.find((stack) => stack.name === 'settings'),
    inactive,
  )
  summary.push({
    case: name,
    requestedDuringNavigation: navigates,
    visualOverlap: rotation.navigationActive,
    navigationCancelled: nativeEnd?.cancelled ?? null,
    result: rotation.navigationActive
      ? 'overlap'
      : navigates
        ? 'rotation-deferred'
        : 'settled-control',
  })
}
// Follow-up navigation and refusing guard must still work after the entire matrix.
await command('mode', 'overlay')
await command('push', 'home')
await command('guard', true)
const guarded = await command('snapshot')
const refused = await command('back')
assert.deepEqual(refused.entries, guarded.entries, 'Guard no longer refuses navigation')
await command('open')
assert.equal((await command('snapshot')).open, true)
await command('close')
await command('guard', false)
const recovered = await command('back')
assert.deepEqual(recovered.issues, [])
assert.equal(recovered.open, false)
assert.equal(recovered.result, 'accepted')
assert.equal(
  recovered.resultSettlements,
  1,
  'Unrelated modal result must settle exactly once',
)
await pause(500)
const stable = await command('snapshot')
assert.deepEqual(
  stable.entries,
  recovered.entries,
  'Late callback changed settled history',
)
await writeFile(join(out, 'rotation-summary.json'), JSON.stringify(summary, null, 2))
console.table(summary)
const missing = summary.filter((item) => item.result === 'gesture-not-reproduced').length
console.log(
  `${summary.length - missing} rotation cases exercised; ${missing} gesture cases NOT reproduced. Evidence: ${out}`,
)
