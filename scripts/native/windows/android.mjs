import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { activityStates } from './activity-state.mjs'
const exec = promisify(execFile)
const serial = process.env.ANDROID_SERIAL
assert(serial, 'Set ANDROID_SERIAL to a test emulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/windows')
const pkg = 'org.nativescript.vuerouterns'
const restoreTasks = process.env.RESTORE_TASKS === '1'
async function restoreTask(id) {
  try {
    await adb('shell', 'am', 'task', 'lock', String(id))
    await pause(1500)
  } finally {
    await adb('shell', 'am', 'task', 'lock', 'stop')
  }
}
const adb = async (...args) =>
  (
    await exec('adb', ['-s', serial, ...args], {
      timeout: 60000,
      maxBuffer: 12 * 1024 * 1024,
    })
  ).stdout
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
await mkdir(out, { recursive: true })
async function result(command, pid) {
  const end = Date.now() + 45000
  while (Date.now() < end) {
    let report
    try {
      report = JSON.parse(
        await adb('shell', 'run-as', pkg, 'cat', 'files/windows-result.json'),
      )
    } catch {}
    if (report?.command === command && String(report.pid) === pid) {
      await writeFile(resolve(out, `${command}.json`), JSON.stringify(report, null, 2))
      return report
    }
    await pause(200)
  }
  throw new Error(`Timeout waiting for ${command}`)
}
async function command(name, pid) {
  await adb(
    'shell',
    'am',
    'broadcast',
    '-a',
    `${pkg}.WINDOWS_TEST`,
    '-p',
    pkg,
    '--es',
    'command',
    name,
  )
  return result(name, pid)
}
const pass = (report) => assert.equal(report.ok, true, `${report.stage}: ${report.error}`)
try {
  if (process.env.ANDROID_APP)
    await adb('install', '-r', resolve(process.env.ANDROID_APP))
  await adb('shell', 'am', 'force-stop', pkg)
  await adb('shell', 'pm', 'clear', pkg)
  // pm clear can return before ActivityTaskManager removes the old tasks.
  // Starting during that cleanup can kill the fresh process as "remove task".
  const cleanupDeadline = Date.now() + 15000
  while (
    (await adb('shell', 'dumpsys', 'activity', 'activities'))
      .split('\n')
      .some((line) => line.includes('Hist  #') && line.includes(pkg))
  ) {
    assert(Date.now() < cleanupDeadline, 'Previous fixture Activities were removed')
    await pause(200)
  }
  await adb('logcat', '-c')
  await adb(
    'shell',
    'am',
    'start',
    '-W',
    '-f',
    '0x18000000',
    '-n',
    `${pkg}/com.tns.NativeScriptActivity`,
  )
  const before = (await adb('shell', 'pidof', pkg)).trim()
  pass(await result('ready', before))
  const prepared = await command('prepare', before)
  pass(prepared)
  await adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
  // A busy emulator can still be stopping B after a fixed sleep. Killing then
  // makes ActivityTaskManager discard it as "app died, no saved state".
  // Wait for the OS to own both saved bundles before testing reconstruction.
  const savedDeadline = Date.now() + 45000
  while (true) {
    const dump = await adb('shell', 'dumpsys', 'activity', 'activities')
    const states = activityStates(
      dump,
      pkg,
      prepared.sessions.map((session) => session.task),
    )
    const ready = states.every((state) => state.present && state.stopped && state.saved)
    if (ready || Date.now() >= savedDeadline) {
      await writeFile(resolve(out, 'before-kill-activities.txt'), dump)
      assert(ready, `OS saved both stopped Activities: ${JSON.stringify(states)}`)
      break
    }
    await pause(250)
  }
  await adb('shell', 'am', 'kill', pkg)
  await pause(1500)
  if ((await adb('shell', 'pidof', pkg).catch(() => '')).trim() === before) {
    await adb('shell', 'run-as', pkg, 'kill', '-9', before)
    await pause(800)
  }
  assert.equal(
    (await adb('shell', 'pidof', pkg).catch(() => '')).trim(),
    '',
    'The old app process actually died',
  )
  if (restoreTasks)
    await restoreTask(prepared.sessions.find((session) => session.key === 'a').task)
  else {
    await adb(
      'shell',
      'am',
      'start',
      '-W',
      '-f',
      '0x18000000',
      '-n',
      `${pkg}/com.tns.NativeScriptActivity`,
    )
  }
  const after = (await adb('shell', 'pidof', pkg)).trim()
  assert.notEqual(after, before)
  assert(after)
  await writeFile(
    resolve(out, 'process.json'),
    JSON.stringify({ before, after, restoreTasks }, null, 2),
  )
  pass(await result('ready', after))
  if (restoreTasks)
    await restoreTask(prepared.sessions.find((session) => session.key === 'b').task)
  const restored = await command(restoreTasks ? 'restore-existing' : 'restore', after)
  pass(restored)
  for (const session of restored.sessions) {
    const original = prepared.sessions.find((item) => item.key === session.key)
    assert(original)
    if (restoreTasks) {
      assert.equal(session.task, original.task, 'OS restores the original task record')
      // Core boots the first Activity with no native saved state after process
      // death, so its generated window ID may change. Application keys and
      // original task IDs are the persistence identity; B retains its native ID.
      if (session.key === 'b') assert.equal(session.window, original.window)
    } else {
      assert.notEqual(
        session.window,
        original.window,
        'App reconstructs into a new native window',
      )
    }
    assert.deepEqual(
      session.entryKeys,
      original.entryKeys.slice(0, 2),
      'Saved entry identities survive in their window',
    )
  }
  pass(await command('link', after))
  const recreated = await command('recreate', after)
  pass(recreated)
  pass(await command('hmr', after))
  pass(await command('close', after))
  pass(await command('launcher', after))
  console.log('Window isolation, process-death restoration and OS link checks passed')
} finally {
  await writeFile(
    resolve(out, 'logcat.txt'),
    await adb('logcat', '-d', '-v', 'threadtime'),
  )
}
