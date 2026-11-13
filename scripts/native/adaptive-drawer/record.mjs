// Record the actual Android fixture after validating its retained native state.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { adb, command, initialize, out, pause, serial } from './bridge.mjs'

assert(serial, 'Use a dedicated Android emulator')
await initialize()
await command('mode', 'permanent')
await command('push', 'home')
await command('draft', 'My draft stays here')
await command('remember')
const file = '/sdcard/router-drawer-settlement.mp4'
const recording = spawn(
  'adb',
  [
    '-s',
    serial,
    'shell',
    'screenrecord',
    '--size',
    '1104x920',
    '--bit-rate',
    '4000000',
    '--time-limit',
    '60',
    file,
  ],
  { stdio: ['ignore', 'ignore', 'inherit'] },
)
const stopped = once(recording, 'close')
await pause(1200)
const pid = await adb('shell', 'pidof', 'screenrecord')
assert(/^\d+$/.test(pid), 'Expected exactly our dedicated screen recorder')
async function show(action, value) {
  const report = await command(action, value)
  assert.equal(report.preserved, true)
  assert.equal(report.entriesPreserved, true)
  assert.deepEqual(report.issues, [])
  await pause(900)
  return report
}
try {
  await show('mode', 'overlay')
  assert.equal((await show('open')).open, true)
  assert.equal((await show('close')).open, false)
  await show('mode', 'permanent')
  await show('select', 'settings')
  await show('select', 'home')
  await show('modal')
  assert.equal((await show('back')).result, 'accepted')
  await show('mode', 'overlay')
  assert.equal((await show('open')).open, true)
  assert.equal((await show('mode', 'permanent')).open, false)
} finally {
  await adb('shell', 'kill', '-2', pid).catch(() => {})
  await stopped
  await adb('pull', file, `${out}/drawer-settlement.mp4`)
}
console.log(`Actual native recording: ${out}/drawer-settlement.mp4`)
