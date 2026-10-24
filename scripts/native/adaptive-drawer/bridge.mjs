import assert from 'node:assert/strict'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const exec = promisify(execFile)
export const sim = process.env.IOS_SIMULATOR
export const serial = process.env.ANDROID_SERIAL
assert(
  Boolean(sim) !== Boolean(serial),
  'Set exactly one dedicated IOS_SIMULATOR or ANDROID_SERIAL',
)
export const pkg = 'org.nativescript.vuerouterns'
export const out = resolve(
  process.env.OUT ?? `scripts/native/out/adaptive-${sim ? 'ios' : 'android'}`,
)
export const ios = async (...args) =>
  (await exec('xcrun', ['simctl', ...args])).stdout.trim()
export const adb = async (...args) =>
  (await exec('adb', ['-s', serial, ...args])).stdout.trim()
export const pause = (ms) => new Promise((done) => setTimeout(done, ms))
let directory
let sequence = 0
export const reports = []
export async function initialize() {
  await mkdir(out, { recursive: true })
  if (sim) {
    await ios('terminate', sim, pkg).catch(() => {})
    await ios('uninstall', sim, pkg).catch(() => {})
    await ios(
      'install',
      sim,
      process.env.IOS_APP ?? 'demo/platforms/ios/build/Debug-iphonesimulator/demo.app',
    )
    await ios('launch', sim, pkg)
    directory = `${await ios('get_app_container', sim, pkg, 'data')}/Documents/adaptive`
  } else {
    await adb(
      'install',
      '-r',
      process.env.ANDROID_APK ??
        'demo/platforms/android/app/build/outputs/apk/debug/app-debug.apk',
    )
    await adb('shell', 'pm', 'clear', pkg)
    await adb('shell', 'am', 'start', '-n', `${pkg}/com.tns.NativeScriptActivity`)
  }
  for (let i = 0; i < 150; i++) {
    try {
      if (sim) await access(directory)
      else await adb('shell', 'run-as', pkg, 'ls', 'files/adaptive')
      return
    } catch {
      await pause(200)
    }
  }
  throw new Error('Adaptive fixture failed to initialize')
}
export async function command(action, value) {
  if (sim && !directory)
    directory = `${await ios('get_app_container', sim, pkg, 'data')}/Documents/adaptive`
  const id = `${Date.now()}-${sequence++}`
  const payload = JSON.stringify({ id, action, value })
  if (sim) await writeFile(`${directory}/command.json`, payload)
  else
    execFileSync(
      'adb',
      ['-s', serial, 'shell', `run-as ${pkg} sh -c 'cat > files/adaptive/command.json'`],
      { input: payload },
    )
  let result
  for (let i = 0; i < 100; i++) {
    try {
      result = JSON.parse(
        sim
          ? await readFile(`${directory}/result.json`, 'utf8')
          : await adb('shell', 'run-as', pkg, 'cat', 'files/adaptive/result.json'),
      )
    } catch {}
    if (result?.id === id) break
    await pause(200)
  }
  assert.equal(result?.id, id, `Timed out: ${action}`)
  assert(!result.error, result.error)
  reports.push({ action, value, ...result })
  await mkdir(out, { recursive: true })
  await writeFile(`${out}/results.json`, JSON.stringify(reports, null, 2))
  return result
}
