import assert from 'node:assert/strict'
import { command, initialize, reports } from './bridge.mjs'

await initialize()
const state = (report, owner, id) =>
  report.captures[owner].states.find((action) => action.id === id)
async function until(check, label) {
  for (let i = 0; i < 30; i++) {
    const report = await command('snapshot')
    if (check(report)) return report
  }
  throw new Error(`Native transition did not settle: ${label}`)
}
let report = await command('snapshot')
assert(state(report, 0, 'save').enabled)
assert.equal(report.captures[0].header.filter((item) => item.title === 'Save').length, 1)
await command('start', { id: 'save' })
report = await command('execute', { id: 'save' })
assert.equal(report.result, false)
assert.equal(report.captures[0].started, 1)
assert.equal(state(report, 0, 'save').title, 'Saving…')
assert.equal(report.captures[0].header[0].enabled, false)
assert.equal(state(report, 0, 'delete').enabled, false)
report = await command('wait', 3200)
assert.equal(report.captures[0].saved, 1)
assert.deepEqual(report.captures[0].completions, [true])
assert.equal(state(report, 0, 'save').enabled, true)
report = await command('dispatch', { id: 'delete' })
assert.equal(report.result, false)
assert.equal(report.captures[0].errors, 1)
assert.match(report.captures[0].lastError, /Demo delete failure/)
await command('start', { id: 'modal' })
report = await until((report) => report.current === '/modal', 'modal presentation')
assert.equal(report.current, '/modal')
assert.equal(state(report, 0, 'save').enabled, false)
const modal = report.captures.findIndex(
  (capture) => capture.title === 'Action result' && capture.alive,
)
assert(modal >= 0)
report = await command('dispatch', { owner: modal, id: 'done' })
assert.equal(report.result, true, 'An action can successfully remove its own page')
assert.equal(report.current, '/')
assert.equal(state(report, 0, 'save').enabled, true)
await command('dispatch', { id: 'detail' })
report = await command('execute', { id: 'save' })
assert.equal(report.result, false)
const detail = report.captures.findIndex(
  (capture) => capture.title === 'Action details' && capture.alive,
)
assert(detail >= 0)
await command('start', { owner: detail, id: 'save' })
report = await command('back')
assert.equal(report.captures[detail].alive, false)
assert.equal(report.captures[detail].aborted, 1)
assert.equal(report.captures[detail].saved, 0)
assert.deepEqual(report.captures[detail].completions, [false])
await command('start', { id: 'save' })
report = await command('reload')
report = await until(
  (report) =>
    !report.captures[0].alive &&
    report.captures.some(
      (capture) =>
        capture.title === 'Shared actions' &&
        capture.alive &&
        capture.states.some((action) => action.id === 'save' && action.enabled),
    ),
  'page HMR',
)
assert.equal(report.captures[0].alive, false)
assert.equal(report.captures[0].aborted, 1)
const replaced = report.captures.findIndex(
  (capture) => capture.title === 'Shared actions' && capture.alive,
)
assert(replaced > 0)
assert.equal(state(report, replaced, 'save').enabled, true)
assert.equal(report.captures[replaced].header.length, 2)
assert.equal((await command('execute', { id: 'save' })).result, false)
await command('select', 'settings')
assert.equal((await command('execute', { owner: replaced, id: 'detail' })).result, false)
report = await command('snapshot')
const settings = report.captures.findIndex(
  (capture) => capture.title === 'Settings actions' && capture.alive,
)
assert(settings >= 0)
report = await command('dispatch', { owner: settings, id: 'detail' })
assert.equal(report.result, true)
assert.deepEqual(report.captures[replaced].history, ['/'])
assert.deepEqual(report.captures[settings].history, ['/settings', '/detail'])
assert.deepEqual(report.issues, [])
console.log(`Native shared action contracts passed: ${reports.length} commands`)
