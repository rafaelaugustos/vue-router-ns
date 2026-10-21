// Actual bundler -> NativeScript CLI -> native navigation/HMR acceptance. Edits are restored in finally.
import assert from 'node:assert/strict'
import { spawn, execFile } from 'node:child_process'
import { promisify, stripVTControlCharacters } from 'node:util'
import { createWriteStream } from 'node:fs'
import { access, mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import options from '../../examples/file-routing/file-routing.config.js'
import { prepareFileRouting } from '../../dist/file-routing/setup.js'

const exec = promisify(execFile)
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
async function readRuntime() {
  const command = platform === 'android' ? 'adb' : 'xcrun'
  const args =
    platform === 'android'
      ? ['-s', serial, 'logcat', '-d', '-v', 'brief', '-s', 'JS', 'AndroidRuntime']
      : [
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
          'eventMessage CONTAINS "CONVENTIONS_"',
        ]
  const result = await exec(command, args, { maxBuffer: 8 * 1024 * 1024, timeout: 20000 })
  runtime = result.stdout
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
} finally {
  if (!processExited) {
    try {
      process.kill(-child.pid, 'SIGINT')
    } catch {}
    for (let i = 0; i < 5 && !processExited; i++) await pause()
    if (!processExited)
      try {
        process.kill(-child.pid, 'SIGTERM')
      } catch {}
  }
  logFile.end()
  await writeFile(product, original)
  await writeFile(productView, originalView)
  await writeFile(audit, originalAudit)
  await rm(addedMetadata, { force: true })
  await rm(added, { force: true })
  await rm(renamed, { force: true })
  await prepareFileRouting(options(platform))
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
}
