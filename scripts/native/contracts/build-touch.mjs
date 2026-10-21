import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT
assert(sdk, 'ANDROID_HOME is required')
const version = readdirSync(`${sdk}/build-tools`)
  .filter((name) => /^\d+\.\d+\.\d+$/.test(name))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .at(-1)
const bin = `${sdk}/build-tools/${version}`
const android = `${sdk}/platforms/android-36/android.jar`
assert(existsSync(android), 'Install Android SDK platform 36')
const out = resolve(process.argv[2] ?? '/tmp/router-contract-touch')
const source = resolve('scripts/native/contracts/android-touch')
mkdirSync(`${out}/classes`, { recursive: true })
mkdirSync(`${out}/dex`, { recursive: true })
const run = (command, args) => execFileSync(command, args, { stdio: 'inherit' })
run('javac', [
  '-source',
  '8',
  '-target',
  '8',
  '-bootclasspath',
  android,
  '-d',
  `${out}/classes`,
  `${source}/ContractTouch.java`,
])
run(`${bin}/d8`, [
  '--lib',
  android,
  '--min-api',
  '34',
  '--output',
  `${out}/dex`,
  `${out}/classes/org/nativescript/contracttouch/ContractTouch.class`,
])
run(`${bin}/aapt2`, [
  'link',
  '-I',
  android,
  '--manifest',
  `${source}/AndroidManifest.xml`,
  '-o',
  `${out}/unsigned.apk`,
])
run('zip', ['-j', `${out}/unsigned.apk`, `${out}/dex/classes.dex`])
if (!existsSync(`${out}/debug.keystore`))
  run('keytool', [
    '-genkeypair',
    '-keystore',
    `${out}/debug.keystore`,
    '-storepass',
    'android',
    '-keypass',
    'android',
    '-alias',
    'androiddebugkey',
    '-keyalg',
    'RSA',
    '-validity',
    '3650',
    '-dname',
    'CN=Native Contracts',
  ])
run(`${bin}/apksigner`, [
  'sign',
  '--ks',
  `${out}/debug.keystore`,
  '--ks-pass',
  'pass:android',
  '--key-pass',
  'pass:android',
  '--out',
  `${out}/touch.apk`,
  `${out}/unsigned.apk`,
])
console.log(`Native input instrumentation: ${out}/touch.apk`)
