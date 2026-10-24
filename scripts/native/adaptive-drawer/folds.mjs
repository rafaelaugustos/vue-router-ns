import assert from 'node:assert/strict'
import { adb, command, initialize, pause, serial } from './bridge.mjs'

assert(serial, 'Android foldable only')
const features = await adb('shell', 'settings', 'get', 'global', 'display_features')
const rotation = await adb('shell', 'settings', 'get', 'system', 'user_rotation')
const automaticRotation = await adb(
  'shell',
  'settings',
  'get',
  'system',
  'accelerometer_rotation',
)
async function hinge(angle) {
  await adb('emu', 'sensor', 'set', 'hinge-angle0', String(angle))
  for (let i = 0; i < 50; i++) {
    const state = await adb('shell', 'cmd', 'device_state', 'state')
    if (state.includes(`name='${angle === 180 ? 'OPENED' : 'HALF_OPENED'}'`)) return
    if (i === 10 || i === 25) {
      await adb('emu', 'sensor', 'set', 'hinge-angle0', String(angle === 180 ? 179 : 91))
      await pause(200)
      await adb('emu', 'sensor', 'set', 'hinge-angle0', String(angle))
    }
    await pause(200)
  }
  throw new Error('Physical posture did not commit')
}
async function check(label, vertical) {
  let report
  for (let i = 0; i < 20; i++) {
    report = await command('snapshot')
    if (report.folds.some((fold) => fold.occluding && fold.vertical === vertical)) break
    await pause(200)
  }
  const fold = report.folds.find((item) => item.occluding && item.vertical === vertical)
  assert(fold, `${label}: WindowManager did not report the configured hinge`)
  assert.equal(report.mode, 'permanent')
  assert.equal(report.preserved, true)
  assert.equal(report.entriesPreserved, true)
  assert.deepEqual(report.issues, [])
  const start = vertical ? fold.left - report.viewport.x : fold.top - report.viewport.y
  const end = vertical ? fold.right - report.viewport.x : fold.bottom - report.viewport.y
  for (const rect of [report.geometry.pane, report.geometry.content]) {
    const origin = vertical ? rect.x : rect.y
    const length = vertical ? rect.width : rect.height
    assert(
      origin + length <= start || origin >= end,
      `${label}: a pane overlaps the hinge`,
    )
  }
  console.log(
    `PASS ${label}: physical hinge excluded; native identities and histories retained`,
  )
  return report
}
try {
  await adb(
    'shell',
    'settings',
    'put',
    'global',
    'display_features',
    'hinge-[1056,0,1152,1840]',
  )
  await adb('shell', 'wm', 'user-rotation', 'lock', '0')
  await hinge(90)
  await hinge(180)
  await initialize()
  await command('mode', 'permanent')
  await command('push', 'home')
  await command('push', 'settings')
  await command('select', 'home')
  await command('draft', 'fold draft')
  await command('remember')
  await check('flat hinge', true)
  await hinge(90)
  await check('half-open posture', true)
  await command('rtl', true)
  const rtl = await check('RTL', true)
  assert(rtl.geometry.pane.x > rtl.geometry.content.x)
  await command('rtl', false)
  await command('modal')
  await adb('shell', 'wm', 'user-rotation', 'lock', '1')
  await check('horizontal hinge below modal', false)
  assert.equal((await command('back')).result, 'accepted')
  await command('foldAware', false)
  const disabled = await command('snapshot')
  assert.equal(disabled.geometry.pane.y, 0)
  await command('foldAware', true)
  await check('observer re-enabled', false)
  await adb('shell', 'wm', 'user-rotation', 'lock', '0')
  await check('portrait restored', true)
} finally {
  await hinge(180).catch(() => {})
  for (const [group, name, value] of [
    ['global', 'display_features', features],
    ['system', 'user_rotation', rotation],
    ['system', 'accelerometer_rotation', automaticRotation],
  ]) {
    await adb(
      'shell',
      'settings',
      value === 'null' ? 'delete' : 'put',
      group,
      name,
      ...(value === 'null' ? [] : [value]),
    ).catch(() => {})
  }
}
