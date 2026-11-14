// Actual bundler -> NativeScript CLI -> native navigation/HMR acceptance. Edits are restored in finally.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { stripVTControlCharacters } from 'node:util'
import { createWriteStream } from 'node:fs'
import { access, mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import options from '../../examples/file-routing/file-routing.config.js'
import { prepareFileRouting } from '../../dist/file-routing/setup.js'

import {
  commandLog,
  iosRuntimeReader,
  cleanupAll,
  errorRecord,
  iosEnvironment,
} from './conventions/observer.mjs'
import { recordEnvironment } from './contracts/environment.mjs'
const platform = process.argv[2]
const bundler = process.env.ROUTER_BUNDLER ?? 'webpack'
const watch = process.env.NATIVE_HMR !== '0'
assert(['webpack', 'vite'].includes(bundler), 'ROUTER_BUNDLER must be webpack or vite')
assert(['android', 'ios'].includes(platform), 'Pass android or ios')
const serial =
  platform === 'ios'
    ? process.env.IOS_SIMULATOR
    : (process.env.ANDROID_SERIAL ?? 'emulator-5554')
assert(serial, 'Set IOS_SIMULATOR to a booted simulator UUID')
const root = fileURLToPath(new URL('../../', import.meta.url))
const project = resolve(root, 'examples/file-routing'),
  pages = resolve(project, 'src/pages')
const out = resolve(
  root,
  process.env.OUT ?? `scripts/native/out/conventions-${bundler}-${platform}`,
)
await mkdir(out, { recursive: true })
const exec = commandLog(resolve(out, 'commands'))
const id = String(Date.now())
const product = resolve(pages, 'products/[id].route.json')
const productView = resolve(pages, 'products/[id].vue')
const originalView = await readFile(productView, 'utf8')
const audit = resolve(project, 'src/middleware/01-audit.global.ts')
const originalAudit = await readFile(audit, 'utf8')
const addedMetadata = resolve(pages, 'live-added.route.json')
const added = resolve(pages, 'live-added.vue'),
  renamed = resolve(pages, 'live-renamed.vue')
for (const path of [added, renamed, addedMetadata]) {
  let exists = true
  try {
    await access(path)
  } catch {
    exists = false
  }
  assert(!exists, `Remove or rename your existing ${path} before this fixture runs`)
}
const original = await readFile(product, 'utf8')
assert(/"revision"\s*:\s*1/.test(original), 'The fixture starts with metadata revision 1')
const live = (meta = '') =>
  `<script setup lang="ts">const label = "Added while the app is running"; ${meta}</script><template><StackLayout padding="24"><Label id="page-heading"  :text="label" /></StackLayout></template>\n`
let initialEnvironment
if (platform === 'ios') {
  // Preserve the starting source/package snapshot before the fixture edits files.
  // Query native tools once, after acceptance and owned-process cleanup settle.
  initialEnvironment = await recordEnvironment(
    out,
    {
      simulator: serial,
      runtime: null,
      xcode: null,
      cli: null,
      metadata: { complete: false, phase: 'pending', errors: [] },
      bundler,
      vite: JSON.parse(
        await readFile(resolve(project, 'node_modules/vite/package.json'), 'utf8'),
      ).version,
      nativeVite: JSON.parse(
        await readFile(
          resolve(project, 'node_modules/@nativescript/vite/package.json'),
          'utf8',
        ),
      ).version,
      launchOwner: 'NativeScript CLI',
    },
    project,
  )
}
const logFile = createWriteStream(resolve(out, 'cli.log'))
let cliOutput = '',
  processExited = false
let interrupted = false
process.on('SIGINT', () => {
  interrupted = true
})
process.on('SIGTERM', () => {
  interrupted = true
})
const args = [
  'run',
  platform,
  // Switching webpack/Vite can otherwise retain the previous APK's entrypoint.
  '--clean',
  '--device',
  serial,
  '--env.conventionsTest',
  ...(watch ? ['--env.conventionsWatch'] : ['--no-hmr']),
  `--env.conventionsRun=${id}`,
]
let recorder, recording, recordingError
if (platform === 'ios' && process.env.RECORD_VIDEO === '1') {
  recorder = spawn(
    'xcrun',
    [
      'simctl',
      'io',
      serial,
      'recordVideo',
      '--codec=h264',
      resolve(out, 'native-vite.mp4'),
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  )
  const log = createWriteStream(resolve(out, 'recording.log'))
  recorder.stderr.pipe(log)
  recording = new Promise((resolve) => {
    recorder.on('error', (error) => {
      recordingError = error
      resolve()
    })
    recorder.on('close', (code, signal) => {
      if (code !== 0) recordingError = new Error(`Recorder exited: ${code}/${signal}`)
      log.end()
      resolve()
    })
  })
}
const child = spawn('ns', args, {
  cwd: project,
  env: process.env,
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
})
for (const stream of [child.stdout, child.stderr])
  stream.on('data', (data) => {
    logFile.write(data)
    cliOutput += stripVTControlCharacters(data.toString())
  })
const childClosed = new Promise((resolve) => child.once('close', () => resolve(true)))
child.on('error', (error) => {
  cliOutput += String(error)
  processExited = true
})
child.on('exit', () => {
  processExited = true
})
const pause = () => new Promise((resolve) => setTimeout(resolve, 1000))
let runtime = ''
let launchedAndroid = false
const readIos = iosRuntimeReader({ serial, id, run: exec })
async function readRuntime() {
  if (platform === 'ios') runtime = await readIos(cliOutput)
  else if (
    cliOutput.includes(`CONVENTIONS_PHASE ${id} `) ||
    cliOutput.includes(`CONVENTIONS_RESULT {"id":"${id}"`)
  )
    runtime = cliOutput
  else
    runtime = (
      await exec(
        'adb',
        ['-s', serial, 'logcat', '-d', '-v', 'brief', '-s', 'JS', 'AndroidRuntime'],
        { maxBuffer: 8 * 1024 * 1024, timeout: 20000 },
      )
    ).stdout
  await writeFile(resolve(out, 'runtime.log'), runtime)
  for (const line of runtime
    .split('\n')
    .filter((l) => l.includes('CONVENTIONS_RESULT '))) {
    const result = JSON.parse(line.slice(line.indexOf('CONVENTIONS_RESULT ') + 19))
    if (String(result.id) === id && !result.ok) throw new Error(result.error)
  }
}
async function waitFor(test, description, timeout = 180000) {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    if (interrupted) throw new Error('Native watch acceptance interrupted')
    if (processExited)
      throw new Error(
        `NativeScript stopped while ${description}: ${cliOutput.slice(-5000)}`,
      )
    const runningId = cliOutput.match(/CONVENTIONS_PHASE (\d+) ready/)?.[1]
    if (runningId && runningId !== id)
      throw new Error(
        `NativeScript launched a stale app (${runningId}, expected ${id}); clean its platform build before retrying`,
      )
    // Some CLI versions stall discovering the launcher after syncing the APK.
    if (
      platform === 'android' &&
      !launchedAndroid &&
      cliOutput.includes('Restarting application')
    ) {
      launchedAndroid = true
      const running = await exec('adb', [
        '-s',
        serial,
        'shell',
        'pidof',
        'org.nativescript.routerfiles',
      ]).catch(() => ({ stdout: '' }))
      if (!running.stdout.trim()) {
        await exec(
          'adb',
          [
            '-s',
            serial,
            'shell',
            'am',
            'start',
            '-n',
            'org.nativescript.routerfiles/com.tns.NativeScriptActivity',
          ],
          { timeout: 20000 },
        )
        console.log('Launched the synced Android fixture through adb')
      }
    }
    // The CLI owns iOS stop/start. A restart message or absent PID is not a completed launch.
    await readRuntime()
    if (test()) return
    await pause()
  }
  throw new Error(`Timed out ${description}. See ${out}`)
}
const phase = (name, timeout = 60000) =>
  waitFor(
    () => runtime.includes(`CONVENTIONS_PHASE ${id} ${name}`),
    `waiting for ${name}`,
    timeout,
  )
let failure,
  cleanupFailures = []
try {
  if (watch) {
    // A clean checkout can still be downloading/building its native runtime.
    await phase('ready', 600000)
    if (bundler === 'vite') {
      console.log(`${platform}: native baseline passed; applying template edit`)
      await writeFile(
        productView,
        originalView.replace('The everyday notebook', 'Live template edit'),
      )
      await waitFor(
        () => runtime.includes(`CONVENTIONS_TEMPLATE ${id} `),
        'waiting for template HMR',
        45000,
      )
      const probe = runtime
        .split('\n')
        .find((line) => line.includes(`CONVENTIONS_TEMPLATE ${id} `))
      console.log(probe)
      const state = JSON.parse(
        probe.slice(
          probe.indexOf(`CONVENTIONS_TEMPLATE ${id} `) +
            `CONVENTIONS_TEMPLATE ${id} `.length,
        ),
      )
      assert.equal(state.samePage, true)
      assert.equal(state.sameSetup, true)
      assert.equal(state.retainedDraft, true)
      assert.equal(state.visibleDraft, 'Retained product draft')
      assert.equal(state.route, '/products/7')
      assert.equal(state.backStack, 1)
      assert.equal(state.otherStack, true)
      await writeFile(resolve(out, 'template-probe.log'), probe + '\n')
    }
    console.log(`${platform}: applying middleware edit`)
    await writeFile(
      audit,
      originalAudit.replace('globalVisits.value++', 'globalVisits.value += 10'),
    )
    await phase('middleware')
    console.log(`${platform}: applying route table edits`)
    await writeFile(
      product,
      original.replace(/("revision"\s*:\s*)1/, (match, prefix) => `${prefix}2`),
    )
    await writeFile(added, live())
    await phase('added')
    await rename(added, renamed)
    await phase('renamed')
    await rm(renamed)
    await phase('removed')
    await writeFile(addedMetadata, JSON.stringify({ name: 'products-id' }))
    await writeFile(added, live())
    await waitFor(
      () => cliOutput.includes('Duplicate route name'),
      'waiting for a compilation diagnostic',
    )
    await writeFile(addedMetadata, JSON.stringify({ name: 'recovered' }))
    await phase('recovered')
  }
  await waitFor(
    () => runtime.includes(`CONVENTIONS_RESULT {"id":"${id}"`),
    'waiting for final result',
    watch ? 180000 : 600000,
  )
  const line = runtime
    .split('\n')
    .find((l) => l.includes(`CONVENTIONS_RESULT {"id":"${id}"`))
  const result = JSON.parse(line.slice(line.indexOf('CONVENTIONS_RESULT ') + 19))
  assert.equal(result.ok, true, result.error)
  assert.equal(result.checks.length, watch ? 24 : 15)
  assert.equal(new Set(result.checks).size, watch ? 24 : 15)
  await writeFile(resolve(out, 'results.json'), JSON.stringify(result, null, 2) + '\n')
  console.log(`Passed ${result.checks.length} native setup/watch checks on ${platform}`)
} catch (error) {
  failure = error
} finally {
  cleanupFailures = await cleanupAll([
    [
      'diagnostics',
      async () => {
        if (platform !== 'ios') return
        await Promise.allSettled([
          exec('xcrun', [
            'simctl',
            'spawn',
            serial,
            'log',
            'show',
            '--last',
            '10m',
            '--style',
            'compact',
            '--predicate',
            'process == "filerouting" OR eventMessage CONTAINS "CONVENTIONS_"',
          ]),
          exec('xcrun', ['simctl', 'spawn', serial, 'launchctl', 'list']),
          exec('xcrun', [
            'simctl',
            'io',
            serial,
            'screenshot',
            resolve(out, 'final.png'),
          ]),
        ])
      },
    ],
    [
      'recording',
      async () => {
        if (!recorder) return
        if (recorder.exitCode !== null || recorder.signalCode !== null)
          throw recordingError ?? new Error('Recorder ended before acceptance')
        recorder.kill('SIGINT')
        const timer = setTimeout(() => recorder.kill('SIGKILL'), 10000)
        try {
          await recording
        } finally {
          clearTimeout(timer)
        }
        if (recordingError) throw recordingError
      },
    ],
    [
      'stop CLI',
      async () => {
        try {
          process.kill(-child.pid, 'SIGINT')
        } catch {}
        for (let i = 0; i < 5 && !processExited; i++) await pause()
        // Include any descendants left by a CLI that already exited.
        try {
          process.kill(-child.pid, 'SIGKILL')
        } catch {}
        let timer
        const closed = await Promise.race([
          childClosed,
          new Promise((resolve) => {
            timer = setTimeout(() => resolve(false), 5000)
          }),
        ])
        clearTimeout(timer)
        if (!closed) {
          child.stdout.destroy()
          child.stderr.destroy()
        }
        logFile.end()
        assert(closed, 'CLI output pipes must close before their log is released')
      },
    ],
    ['restore metadata', () => writeFile(product, original)],
    ['restore template', () => writeFile(productView, originalView)],
    ['restore middleware', () => writeFile(audit, originalAudit)],
    ['remove temporary metadata', () => rm(addedMetadata, { force: true })],
    ['remove added page', () => rm(added, { force: true })],
    ['remove renamed page', () => rm(renamed, { force: true })],
    ['regenerate routes', () => prepareFileRouting(options(platform))],
    [
      'stop app',
      async () => {
        if (platform === 'android')
          await exec('adb', [
            '-s',
            serial,
            'shell',
            'am',
            'force-stop',
            'org.nativescript.routerfiles',
          ])
        else
          await exec('xcrun', [
            'simctl',
            'terminate',
            serial,
            'org.nativescript.routerfiles',
          ]).catch(() => {})
      },
    ],
    [
      'environment',
      async () => {
        if (platform !== 'ios') return
        const environment = await iosEnvironment({ serial, run: exec })
        environment.metadata.phase = 'after-cleanup'
        environment.metadata.collectedAt = new Date().toISOString()
        if (!environment.metadata.complete)
          console.error(
            'Incomplete environment metadata:',
            JSON.stringify(environment.metadata.errors),
          )
        await writeFile(
          resolve(out, 'environment.json'),
          JSON.stringify(
            {
              ...initialEnvironment,
              device: { ...initialEnvironment.device, ...environment },
            },
            null,
            2,
          ) + '\n',
        )
      },
    ],
  ])
  await writeFile(
    resolve(out, 'outcome.json'),
    JSON.stringify(
      {
        id,
        ok: !failure && !cleanupFailures.length,
        failure: failure ? errorRecord(failure) : undefined,
        cleanupFailures,
        launchOwner:
          platform === 'ios' ? 'NativeScript CLI' : 'CLI with Android fallback',
      },
      null,
      2,
    ) + '\n',
  )
}
if (failure) throw failure
assert.equal(cleanupFailures.length, 0, JSON.stringify(cleanupFailures))
