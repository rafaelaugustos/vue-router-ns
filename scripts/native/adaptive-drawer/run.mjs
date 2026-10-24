import assert from 'node:assert/strict'
import { command, initialize, reports } from './bridge.mjs'

await initialize()
function state(report, mode, open = false) {
  assert.equal(report.mode, mode)
  assert.equal(report.open, open)
  assert.equal(report.model, open)
  assert.equal(report.contentHidden, open)
  assert.equal(report.paneHidden, mode === 'overlay' && !open)
  assert.equal(report.paneVisible, mode === 'permanent' || open)
  assert.equal(report.preserved, true, 'Native or Vue identity changed')
  assert.deepEqual(report.issues, [])
}
const initial = await command('mode', 'overlay')
if (process.env.EXPECT_REDUCED_MOTION === '1') assert.equal(initial.reduceMotion, true)
state(await command('open'), 'overlay', true)
await command('push', 'home')
await command('draft', 'draft survives resize')
await command('push', 'settings')
await command('select', 'home')
await command('remember')
state(await command('mode', 'permanent'), 'permanent')
state(await command('open'), 'permanent')
state(await command('model', true), 'permanent')
await command('modal')
for (const mode of ['overlay', 'permanent', 'overlay', 'auto', 'permanent']) {
  const report = await command('mode', mode)
  state(
    report,
    mode === 'auto' ? (report.geometry.width >= 840 ? 'permanent' : 'overlay') : mode,
  )
  assert.equal(report.entriesPreserved, true)
  assert.equal(report.result, 'pending')
  assert(report.drafts.some((draft) => draft.value === 'draft survives resize'))
}
assert.equal((await command('back')).result, 'accepted')
await command('mode', 'overlay')
const before = await command('snapshot')
const interrupted = await command('interrupt')
state(interrupted, 'permanent')
assert.equal(
  interrupted.events.opened,
  before.events.opened + (interrupted.reduceMotion ? 1 : 0),
  'Interrupted opening emitted a late opened event',
)
state(await command('rtl', true), 'permanent')
const rtl = await command('snapshot')
assert(rtl.paneBounds.x > rtl.contentBounds.x)
await command('rtl', false)
await command('breakpoint', 350)
state(await command('mode', 'auto'), 'permanent')
for (const width of [320, '100%', 300, '100%']) {
  const report = await command('resize', width)
  state(report, width === '100%' ? 'permanent' : 'overlay')
  assert.equal(report.entriesPreserved, true)
}
await command('mode', 'overlay')
await command('guard', true)
await command('open')
await command('back')
state(await command('snapshot'), 'overlay', true)
state(await command('mode', 'permanent'), 'permanent')
await command('guard', false)
await command('back')
const popped = await command('snapshot')
assert.equal(popped.mode, 'permanent')
assert.equal(popped.open, false)
// Negative control: an intentional page pop must invalidate our retained-page
// detector, whereas presentation changes above must never do so.
assert.equal(popped.preserved, false)
assert.equal(popped.entriesPreserved, false)
console.log(`Native adaptive drawer contracts passed: ${reports.length} commands`)
