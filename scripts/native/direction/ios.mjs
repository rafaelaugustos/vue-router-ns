import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile, copyFile } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const out = resolve(process.env.OUT ?? 'scripts/native/out/direction')
const app = join(out, 'app')
const simulator = process.env.IOS_SIMULATOR
assert(simulator, 'Set IOS_SIMULATOR to a dedicated test simulator')
const suite = process.env.ENTRY ?? 'all'
const cases = {
  core: ['testPrebuiltControl', 'testPrebuiltLTR', 'testPrebuiltRequestLayout'],
  vue: ['testControl', 'testInheritedLTR'],
  router: ['testControl', 'testInheritedLTR', 'testTabsLTR'],
}
assert(suite === 'all' || Object.hasOwn(cases, suite))
const selected = suite === 'all' ? Object.keys(cases) : [suite]
const commands = []
async function run(label, command, args, cwd = root) {
  const entry = { label, command, args, startedAt: new Date().toISOString() }
  commands.push(entry)
  let stdout = '',
    stderr = ''
  try {
    const result = await exec(command, args, {
      cwd,
      timeout: 600000,
      killSignal: 'SIGKILL',
      maxBuffer: 64 * 1024 * 1024,
    })
    stdout = result.stdout
    stderr = result.stderr
    entry.ok = true
    return stdout
  } catch (error) {
    stdout = error.stdout ?? ''
    stderr = error.stderr ?? ''
    entry.ok = false
    entry.error = String(error)
    throw error
  } finally {
    entry.finishedAt = new Date().toISOString()
    await writeFile(join(out, `${label}.log`), stdout + stderr)
    await writeFile(join(out, 'commands.json'), JSON.stringify(commands, null, 2))
  }
}
const devices = JSON.parse(
  await run('devices', 'xcrun', ['simctl', 'list', 'devices', '-j']),
)
const match = Object.entries(devices.devices)
  .flatMap(([runtime, rows]) => rows.map((device) => ({ runtime, ...device })))
  .find((device) => device.udid === simulator)
assert(match?.state === 'Booted', 'Dedicated simulator must be booted')
const environment = {
  driverCommit: (await run('driver-source', 'git', ['rev-parse', 'HEAD'])).trim(),
  simulator: match,
  xcode: (await run('xcode-version', 'xcodebuild', ['-version'])).trim(),
  runtimes: JSON.parse(
    await run('runtime-info', 'xcrun', ['simctl', 'list', 'runtimes', '-j']),
  ).runtimes.filter((r) => r.identifier === match.runtime),
  cli: (await run('cli-version', 'ns', ['--version'])).trim(),
}
await writeFile(join(out, 'environment.json'), JSON.stringify(environment, null, 2))
const project = join(out, 'xctest')
await run('project', 'ruby', [join(root, 'scripts/native/direction/project.rb'), project])
const results = []
for (const entry of selected) {
  const target = join(out, entry)
  await mkdir(target)
  await run(
    `${entry}/build`,
    'ns',
    [
      'build',
      'ios',
      '--for-device',
      'false',
      '--no-hmr',
      ...(entry === 'core' ? [] : [`--env.${entry}`]),
    ],
    app,
  )
  const products = join(app, 'platforms/ios/build/Debug-iphonesimulator')
  const bundles = (await readdir(products)).filter((name) => name.endsWith('.app'))
  assert.equal(bundles.length, 1)
  await run(`${entry}/uninstall`, 'xcrun', [
    'simctl',
    'uninstall',
    simulator,
    'org.nativescript.directionrepro',
  ]).catch(() => {})
  await run(`${entry}/install`, 'xcrun', [
    'simctl',
    'install',
    simulator,
    join(products, bundles[0]),
  ])
  let recording
  let stopped
  if (process.env.RECORD_VIDEO === '1' && entry === 'router') {
    recording = spawn(
      'xcrun',
      ['simctl', 'io', simulator, 'recordVideo', '--codec=h264', join(target, 'app.mov')],
      { stdio: 'ignore' },
    )
    stopped = new Promise((resolve) => {
      recording.once('exit', (code, signal) => resolve({ code, signal }))
      recording.once('error', (error) => resolve({ error }))
    })
  }
  try {
    await run(`${entry}/xcodebuild`, 'xcodebuild', [
      'test',
      '-project',
      join(project, 'DirectionChecks.xcodeproj'),
      '-scheme',
      'DirectionChecks',
      '-destination',
      `platform=iOS Simulator,id=${simulator}`,
      '-derivedDataPath',
      join(project, 'build'),
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      join(target, 'checks.xcresult'),
      ...cases[entry].map(
        (name) => `-only-testing:DirectionChecks/DirectionUITests/${name}`,
      ),
    ])
  } finally {
    if (recording) {
      recording.kill('SIGINT')
      const timer = setTimeout(() => recording.kill('SIGKILL'), 10000)
      try {
        const result = await stopped
        assert(!result.error, String(result.error))
        assert(
          result.code === 0 || result.signal === 'SIGINT',
          `Video failed: ${JSON.stringify(result)}`,
        )
      } finally {
        clearTimeout(timer)
      }
    }
    const container = (
      await run(`${entry}/container`, 'xcrun', [
        'simctl',
        'get_app_container',
        simulator,
        'org.nativescript.directionrepro',
        'data',
      ])
    ).trim()
    if (entry === 'core')
      await copyFile(
        join(container, 'Documents/direction.json'),
        join(target, 'direction.json'),
      ).catch(() => {})
  }
  const summary = JSON.parse(
    await run(`${entry}/summary`, 'xcrun', [
      'xcresulttool',
      'get',
      'test-results',
      'summary',
      '--path',
      join(target, 'checks.xcresult'),
    ]),
  )
  await writeFile(join(target, 'summary.json'), JSON.stringify(summary, null, 2))
  assert.equal(summary.passedTests, cases[entry].length)
  assert.equal(summary.failedTests, 0)
  assert.equal(summary.skippedTests, 0)
  results.push({ entry, cases: cases[entry], passed: summary.passedTests })
  await writeFile(join(out, 'results.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results.at(-1)))
}
