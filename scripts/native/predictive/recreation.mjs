import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { captureLogcat } from './logcat.mjs'
const exec = promisify(execFile)
const serial = process.env.ANDROID_SERIAL
assert(serial, 'Set ANDROID_SERIAL')
const out = resolve(process.env.OUT ?? 'scripts/native/out/predictive-recreation')
const pkg = 'org.nativescript.vuerouterns'
const activity = `${pkg}/com.tns.NativeScriptActivity`
const adb = async (...args) =>
  (
    await exec('adb', ['-s', serial, ...args], {
      timeout: 60000,
      maxBuffer: 12 * 1024 * 1024,
    })
  ).stdout
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
await mkdir(out, { recursive: true })
if (process.env.ANDROID_APP) await adb('install', '-r', resolve(process.env.ANDROID_APP))
async function result(command, pid) {
  const end = Date.now() + 30000
  while (Date.now() < end) {
    let report
    try {
      report = JSON.parse(
        await adb('shell', 'run-as', pkg, 'cat', 'files/predictive-plain.json'),
      )
    } catch {}
    if (report?.command === command && String(report.pid) === pid) return report
    await pause(150)
  }
  throw new Error(`Timeout: ${command}`)
}
const failures = []
try {
  for (const mode of process.env.PREVIEW_MODE
    ? [process.env.PREVIEW_MODE]
    : ['legacy', 'core']) {
    await adb('shell', 'am', 'force-stop', pkg)
    await adb('shell', 'am', 'start', '-W', '-n', activity)
    const pid = (await adb('shell', 'pidof', pkg)).trim()
    assert(pid)
    const ready = await result('ready', pid)
    assert.equal(ready.ok, true, ready.error)
    await adb(
      'shell',
      'am',
      'start',
      '-n',
      activity,
      '--es',
      'predictivePlainCommand',
      mode,
    )
    const report = await result('recreated', pid)
    await writeFile(resolve(out, `${mode}.json`), JSON.stringify(report, null, 2))
    if (!report.ok) {
      failures.push(report)
      continue
    }
    assert.notEqual(report.activity, report.oldActivity, 'Real Activity recreation')
    assert.equal((await adb('shell', 'pidof', pkg)).trim(), pid, 'Same JS process')
    const shot = await exec('adb', ['-s', serial, 'exec-out', 'screencap', '-p'], {
      encoding: 'buffer',
      maxBuffer: 10 * 1024 * 1024,
    })
    await writeFile(resolve(out, `${mode}.png`), shot.stdout)
    console.log(`${serial}: ${mode} Activity recreation passed`)
  }
  if (process.env.EXPECT_RECREATION_FAILURE === '1') {
    assert.equal(
      failures.length,
      1,
      'Published-Core negative control must reproduce one failure',
    )
    const report = failures[0]
    assert.equal(report.mode, 'legacy')
    assert.equal(report.stage, 'back-after-recreate')
    assert.equal(report.error, 'Error: Native Frame not ready')
    assert.equal(report.frameLoaded, true)
    assert.equal(report.pageLoaded, true)
    assert.equal(report.attached, false)
    assert.equal(report.queueEmpty, false)
    assert.equal(report.sessionActive, false)
    assert.notEqual(report.activity, report.oldActivity)
    console.log('Published-Core early-attachment regression reproduced')
  } else {
    assert.equal(
      failures.length,
      0,
      JSON.stringify(failures.map(({ mode, stage, error }) => ({ mode, stage, error }))),
    )
  }
} finally {
  await captureLogcat(serial, resolve(out, 'logcat.txt'))
}
