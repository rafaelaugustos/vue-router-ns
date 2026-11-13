import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

export async function recordLifecycle({ adb, serial, out, run }) {
  const file = '/sdcard/router-window-lifecycle.mp4'
  const recorder = spawn(
    'adb',
    [
      '-s',
      serial,
      'shell',
      'screenrecord',
      '--size',
      '540x1200',
      '--bit-rate',
      '2000000',
      '--time-limit',
      '120',
      file,
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  )
  const stopped = once(recorder, 'close')
  await new Promise((resolve) => setTimeout(resolve, 1000))
  const pid = (await adb('shell', 'pidof', 'screenrecord')).trim()
  assert(/^\d+$/.test(pid), 'Expected one recorder on the dedicated emulator')
  try {
    await run()
  } finally {
    await adb('shell', 'kill', '-2', pid).catch(() => {})
    await stopped
    await adb('pull', file, `${out}/window-lifecycle.mp4`)
  }
}
