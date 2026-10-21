import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const exec = promisify(execFile)
const serial = process.env.ANDROID_SERIAL
assert(serial, 'Set ANDROID_SERIAL to a test emulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/windows')
const pkg = 'org.nativescript.vuerouterns'
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
  await pause(1500)
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
  const after = (await adb('shell', 'pidof', pkg)).trim()
  assert.notEqual(after, before)
  assert(after)
  await writeFile(
    resolve(out, 'process.json'),
    JSON.stringify({ before, after }, null, 2),
  )
  pass(await result('ready', after))
  const restored = await command('restore', after)
  pass(restored)
  for (const session of restored.sessions) {
    const original = prepared.sessions.find((item) => item.key === session.key)
    assert(original)
    assert.notEqual(
      session.window,
      original.window,
      'App reconstructs into a new native window',
    )
    assert.deepEqual(
      session.entryKeys,
      original.entryKeys.slice(0, 2),
      'Saved entry identities survive in their window',
    )
  }
  pass(await command('link', after))
  const recreated = await command('recreate', after)
  if (process.env.EXPECT_RECREATION_FAILURE === '1') {
    assert.equal(
      recreated.ok,
      false,
      'Published dependency must reproduce the lifecycle failure',
    )
    assert.equal(recreated.stage, 'back-after-recreate')
    assert.equal(recreated.error, 'Error: logical history after recreation')
    assert.notEqual(recreated.recreation.before, recreated.recreation.after)
    const broken = recreated.sessions.find((session) => session.key === 'b')
    assert.deepEqual(broken.paths, [])
    assert.equal(
      broken.nativePages,
      2,
      'Native history still exists when Vue apps are disposed',
    )
    console.log(`Reproduced upstream recreation failure: ${recreated.error}`)
  } else {
    pass(recreated)
    pass(await command('close', after))
  }
  console.log('Window isolation, process-death restoration and OS link checks passed')
} finally {
  await writeFile(
    resolve(out, 'logcat.txt'),
    await adb('logcat', '-d', '-v', 'threadtime'),
  )
}
