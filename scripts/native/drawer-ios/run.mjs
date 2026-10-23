import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const sim = process.env.IOS_SIMULATOR
assert(sim, 'Set IOS_SIMULATOR to a dedicated test device; this reinstalls the fixture')
const exec = promisify(execFile)
const ios = async (...args) => (await exec('xcrun', ['simctl', ...args])).stdout.trim()
const pkg = 'org.nativescript.vuerouterns'
const out = resolve(process.env.OUT ?? 'scripts/native/out/drawer-ios')
await mkdir(out, { recursive: true })
await ios('terminate', sim, pkg).catch(() => {})
await ios('uninstall', sim, pkg).catch(() => {})
await ios(
  'install',
  sim,
  process.env.IOS_APP ?? 'demo/platforms/ios/build/Debug-iphonesimulator/demo.app',
)
await ios('launch', sim, pkg)
const container = await ios('get_app_container', sim, pkg, 'data')
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let ready = false
for (let i = 0; i < 150; i++) {
  try {
    await access(`${container}/Documents/drawer`)
    ready = true
    break
  } catch {}
  await pause(200)
}
assert(ready, 'Drawer fixture did not initialize within 30 seconds')
const reports = []
async function command(action, value) {
  const id = `${Date.now()}-${reports.length}`
  await writeFile(
    `${container}/Documents/drawer/command.json`,
    JSON.stringify({ id, action, value }),
  )
  let report
  for (let i = 0; i < 100; i++) {
    try {
      report = JSON.parse(
        await readFile(`${container}/Documents/drawer/result.json`, 'utf8'),
      )
    } catch {}
    if (report?.id === id) break
    await pause(200)
  }
  assert.equal(report?.id, id, `Timed out: ${action}`)
  assert(!report.error, report.error)
  reports.push({ action, value, ...report })
  await writeFile(`${out}/results.json`, JSON.stringify(reports, null, 2))
  console.log(`PASS ${action} ${JSON.stringify(value) ?? ''}`)
  return report
}
function state(report, open) {
  assert.equal(report.open, open)
  assert.equal(report.model, open)
  assert.equal(report.contentHidden, open)
  assert.equal(report.paneHidden, !open)
  assert.equal(report.modal, open)
}
const initial = await command('snapshot')
state(initial, false)
assert.equal(initial.controllerChildren, 1, 'Drawer content lacks UIKit containment')
if (process.env.EXPECT_REDUCED_MOTION === '1') assert.equal(initial.reduceMotion, true)
await command('remember')
let report = await command('open')
state(report, true)
if (report.reduceMotion) assert.equal(report.settledAtCommand, true)
assert.equal(report.width, 280)
assert.equal(report.x, 0)
assert.equal(report.events.opened, 1)
assert.equal((await command('open')).events.opened, 1)
state(await command('escape'), false)
state(await command('model', true), true)
state(await command('model', false), false)
state(await command('rapid'), true)
report = await command('width', 240)
assert.equal(report.width, 240)
assert(report.preserved)
report = await command('rtl', true)
assert.equal(report.x, report.hostWidth - report.width)
assert(report.preserved)
state(await command('push', '/detail'), false)
state(await command('open'), true)
state(await command('push', '/detail'), false)
assert.deepEqual((await command('snapshot')).history, ['/', '/detail'])
state(await command('toggle'), true)
const count = (await command('snapshot')).recognizers
// Remount with open=true also verifies native initialization after Vue mounted.
report = await command('remount')
state(report, true)
assert.equal(report.recognizers, count)
assert.equal(report.controllerChildren, initial.controllerChildren)
state(await command('close'), false)
console.log(`Native drawer contracts passed: ${reports.length} commands`)
