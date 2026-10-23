import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { startServer } from './server.mjs'
const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
const serial = process.env.ANDROID_SERIAL
assert(
  !!sim !== !!serial,
  'Set exactly one of IOS_SIMULATOR / ANDROID_SERIAL to a dedicated test device',
)
const pkg = 'org.nativescript.vuerouterns'
const out = resolve(
  process.env.OUT ?? `scripts/native/out/loaders-${sim ? 'ios' : serial}`,
)
await mkdir(out, { recursive: true })
const run = async (cmd, args) =>
  (await exec(cmd, args, { timeout: 60000, maxBuffer: 16 * 1024 * 1024 })).stdout.trim()
const adb = (...args) => run('adb', ['-s', serial, ...args])
const ios = (...args) => run('xcrun', ['simctl', ...args])
const appFiles = `/data/data/${pkg}/files/loaders`
const pause = (ms) => new Promise((done) => setTimeout(done, ms))
const server = await startServer({ controlled: true })
let container, recording
const results = []
async function command(action = 'snapshot', value) {
  const id = results.length + 1
  const body = JSON.stringify({ id, action, value })
  if (sim) await writeFile(`${container}/Documents/loaders/command.json`, body)
  else {
    await writeFile(`${out}/command.json`, body)
    await adb('push', `${out}/command.json`, '/data/local/tmp/loaders-command.json')
    await adb(
      'shell',
      'run-as',
      pkg,
      'cp',
      '/data/local/tmp/loaders-command.json',
      `${appFiles}/command.json`,
    )
  }
  let report
  for (let i = 0; i < 80; i++) {
    try {
      report = JSON.parse(
        sim
          ? await readFile(`${container}/Documents/loaders/result.json`, 'utf8')
          : await adb('shell', 'run-as', pkg, 'cat', `${appFiles}/result.json`),
      )
      if (report.id === id) break
    } catch {}
    await pause(200)
  }
  assert.equal(report?.id, id, `Command timed out: ${action}`)
  results.push({ action, value, ...report, requests: Object.fromEntries(server.counts) })
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2))
  assert(!report.error, JSON.stringify(report))
  if (recording && action !== 'snapshot') await pause(1000)
  return report
}
async function release(id, count = 1) {
  for (let i = 0; i < 100 && server.counts.get(id) !== count; i++) await pause(100)
  assert.equal(server.counts.get(id), count, `HTTP request count: ${id}`)
  server.release(id)
}
async function status(expected) {
  for (let i = 0; i < 60; i++) {
    const report = await command()
    if (report.states.at(-1)?.status === expected) return report
    await pause(100)
  }
  assert.fail(`Never reached ${expected}`)
}
async function screenshot(name) {
  if (sim) await ios('io', sim, 'screenshot', `${out}/${name}.png`)
  else {
    await adb('shell', 'screencap', '-p', '/sdcard/loaders.png')
    await adb('pull', '/sdcard/loaders.png', `${out}/${name}.png`)
  }
  if (recording) await pause(1500)
}
try {
  if (sim) {
    await ios('terminate', sim, pkg).catch(() => {})
    await ios('launch', sim, pkg)
    container = await ios('get_app_container', sim, pkg, 'data')
  } else {
    await adb('reverse', 'tcp:18818', 'tcp:18818')
    await adb('shell', 'am', 'force-stop', pkg)
    await adb('shell', 'pm', 'clear', pkg)
    await adb('shell', 'am', 'start', '-W', '-n', `${pkg}/com.tns.NativeScriptActivity`)
  }
  await pause(2500)
  if (process.env.RECORD === '1')
    recording = sim
      ? spawn(
          'xcrun',
          ['simctl', 'io', sim, 'recordVideo', '--codec=h264', `${out}/demo.mp4`],
          { stdio: 'ignore' },
        )
      : spawn(
          'adb',
          [
            '-s',
            serial,
            'shell',
            'screenrecord',
            '--bit-rate',
            '4000000',
            '/sdcard/loaders.mp4',
          ],
          { stdio: 'ignore' },
        )
  assert.equal((await command()).current, '/')
  const first = await command('push', '42')
  assert.equal(first.states.at(-1).status, 'pending')
  assert.equal(first.history, 2)
  await screenshot('pending')
  const second = await command('force')
  assert.equal(second.states.at(-1).status, 'pending')
  assert.notEqual(second.page, first.page)
  assert.equal(second.history, 3)
  await release('42')
  const success = await status('success')
  assert.equal(success.page, second.page)
  assert.deepEqual(
    success.states.map((s) => s.status),
    ['success', 'success'],
  )
  assert.equal(success.states.at(-1).data.id, '42')
  await screenshot('success')
  const retained = await command('back')
  assert.equal(retained.page, first.page)
  assert.equal(retained.states[0].status, 'success')
  assert.equal(server.counts.get('42'), 1)
  assert.equal((await command('back')).current, '/')
  const failing = await command('push', 'error')
  await release('error')
  const failed = await status('error')
  assert.equal(failed.page, failing.page)
  assert.equal(failed.history, 2)
  await screenshot('error')
  const retry = await command('retry')
  assert.equal(retry.states.at(-1).status, 'pending')
  assert.equal(retry.page, failing.page)
  await release('error', 2)
  assert.equal((await status('success')).page, failing.page)
  await screenshot('retry')
  await command('back')
  await command('push', 'slow')
  if (serial) {
    await adb('shell', 'input', 'keyevent', '4')
    await pause(700)
  } else await command('back')
  assert.equal((await status('cancelled')).current, '/')
  await release('slow')
  await pause(300)
  const gone = await command()
  assert.equal(gone.current, '/')
  assert.equal(gone.history, 1)
  assert.equal(gone.states.at(-1).status, 'cancelled')
  assert.equal(gone.states.at(-1).data, undefined)
  assert.equal((await command('push', 'secret')).current, '/')
  assert.equal(server.counts.get('secret'), undefined)
  await command('link', '42')
  const linked = await status('success')
  assert.equal(linked.current, '/products/42')
  assert.equal(server.counts.get('42'), 1)
  await command('modal', 'modal')
  const dismissed = await command('back')
  assert.equal(dismissed.current, '/products/42')
  assert.equal(dismissed.states.at(-1).status, 'cancelled')
  await release('modal')
  await pause(300)
  assert.equal((await command()).states.at(-1).data, undefined)
  await screenshot('final')
  console.log(
    'PASS native HTTP loading, shared cache, retained Page/history, error/retry, cancellation, guards, deep link and modal dismissal',
  )
} finally {
  if (recording) {
    if (sim) recording.kill('SIGINT')
    else await adb('shell', 'pkill', '-INT', 'screenrecord').catch(() => {})
    await pause(1500)
    if (serial)
      await adb('pull', '/sdcard/loaders.mp4', `${out}/demo.mp4`).catch(() => {})
  }
  if (serial) await adb('reverse', '--remove', 'tcp:18818').catch(() => {})
  await server.close()
}
