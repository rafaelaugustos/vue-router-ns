// Fault injection for a dedicated emulator, after android.mjs has finished.
// Disconnect only its ADB transport while reading SystemUI. No app command or
// gesture is issued; the fixture report must stay byte-for-byte unchanged.
import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { readSystemUi } from './system-ui.mjs'

const serial = process.env.ANDROID_SERIAL
assert.match(serial ?? '', /^emulator-\d+$/, 'Set ANDROID_SERIAL to a dedicated emulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/system-ui-recovery')
const exec = promisify(execFile)
const run = async (args, options = {}) =>
  (
    await exec('adb', ['-s', serial, ...args], {
      timeout: 15000,
      maxBuffer: 12 * 1024 * 1024,
      ...options,
    })
  ).stdout
await mkdir(out, { recursive: true })
const bootId = (await run(['shell', 'cat', '/proc/sys/kernel/random/boot_id'])).trim()
const appPid = (await run(['shell', 'pidof', 'org.nativescript.vuerouterns'])).trim()
assert(bootId && appPid, 'Start the predictive fixture before fault injection')
const report = () =>
  run(['shell', 'run-as', 'org.nativescript.vuerouterns', 'cat', 'files/predictive.json'])
const before = await report()
assert.equal(JSON.parse(before).ok, true)
const events = []
async function record(event) {
  events.push({ at: Date.now(), ...event })
  await writeFile(resolve(out, 'events.json'), JSON.stringify(events, null, 2))
}
let first = true
const result = await readSystemUi({
  bootId,
  appPid,
  record,
  run: async (args, options) => {
    if (!args.includes('dumpsys') || !first) return run(args, options)
    first = false
    return new Promise((resolveRead, reject) => {
      const child = spawn('adb', ['-s', serial, ...args], options)
      let stdout = '',
        stderr = '',
        reconnect,
        resume
      child.stdout.on('data', (chunk) => {
        stdout += chunk
        if (!reconnect) {
          // Keep the pipe busy until this transport has been interrupted.
          child.stdout.pause()
          reconnect = run(['reconnect']).catch((error) => ({ error }))
          resume = setTimeout(() => child.stdout.resume(), 500)
        }
      })
      child.stderr.on('data', (chunk) => {
        stderr += chunk
      })
      child.on('error', reject)
      child.on('close', async (code, signal) => {
        clearTimeout(resume)
        const disconnected = await reconnect
        if (disconnected?.error) return reject(disconnected.error)
        if (code === 0) return resolveRead(stdout)
        reject(
          Object.assign(new Error('Injected ADB transport interruption'), {
            code,
            signal,
            killed: child.killed,
            stdout,
            stderr,
          }),
        )
      })
    })
  },
})
assert(
  events.some((event) => event.stage === 'failed-read' && event.code === 255),
  'Fault injection must produce an actual partial ADB read with exit 255',
)
assert(events.some((event) => event.stage === 'read-recovered'))
const after = await report()
assert.equal(after, before, 'Fixture state changed during read-only recovery')
await writeFile(resolve(out, 'system-ui.txt'), result)
await writeFile(
  resolve(out, 'result.json'),
  JSON.stringify(
    {
      bootId,
      appPid,
      reportUnchanged: true,
      report: JSON.parse(after),
    },
    null,
    2,
  ),
)
console.log(
  `Interrupted SystemUI read recovered; app PID ${appPid} and fixture state unchanged`,
)
