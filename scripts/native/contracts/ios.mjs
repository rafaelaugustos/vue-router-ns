import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, readdir, copyFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
assert(sim, 'Select a dedicated simulator with IOS_SIMULATOR')
const out = resolve(process.env.OUT ?? 'scripts/native/out/contracts-ios')
const project = resolve(process.env.XCTEST_PROJECT ?? '/tmp/router-contract-tests')
const pkg = 'org.nativescript.vuerouterns'
const negative = process.env.EXPECT_HMR_FAILURE === '1'
const run = (command, args, options = {}) =>
  exec(command, args, { maxBuffer: 32 * 1024 * 1024, ...options })
await mkdir(out, { recursive: true })
await run('ruby', ['scripts/native/contracts/project.rb', project])
await run('xcrun', ['simctl', 'uninstall', sim, pkg]).catch(() => {})
await run('xcrun', [
  'simctl',
  'install',
  sim,
  'demo/platforms/ios/build/Debug-iphonesimulator/demo.app',
])
let failure
try {
  const result = await run(
    'xcodebuild',
    [
      'test',
      '-project',
      `${project}/ContractChecks.xcodeproj`,
      '-scheme',
      'ContractChecks',
      '-destination',
      `platform=iOS Simulator,id=${sim}`,
      '-derivedDataPath',
      `${project}/build`,
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      `${out}/Contracts.xcresult`,
      `-only-testing:ContractChecks/ContractUITests/${negative ? 'testCoveredHmrNegativeControl' : 'testNativeContracts'}`,
    ],
    { timeout: 600000 },
  )
  await writeFile(`${out}/xcodebuild.log`, result.stdout + result.stderr)
} catch (error) {
  failure = error
  await writeFile(`${out}/xcodebuild.log`, String(error.stdout) + String(error.stderr))
} finally {
  const logs = await run('xcrun', [
    'simctl',
    'spawn',
    sim,
    'log',
    'show',
    '--last',
    '15m',
    '--style',
    'compact',
    '--predicate',
    'process == "demo" OR process == "ContractChecks-Runner"',
  ]).catch((error) => ({ stdout: String(error) }))
  await writeFile(`${out}/runtime.log`, logs.stdout)
  const { stdout: container } = await run('xcrun', [
    'simctl',
    'get_app_container',
    sim,
    pkg,
    'data',
  ])
  const documents = `${container.trim()}/Documents`
  const reports = []
  for (const name of await readdir(documents)) {
    if (!/^contract-\d+-\d+-.*\.json$/.test(name)) continue
    await copyFile(`${documents}/${name}`, `${out}/${name}`)
    reports.push(JSON.parse(await readFile(`${documents}/${name}`, 'utf8')))
  }
  reports.sort((a, b) => a.pid - b.pid || a.sequence - b.sequence)
  await writeFile(`${out}/results.json`, JSON.stringify(reports, null, 2))
  await run('xcrun', ['simctl', 'io', sim, 'screenshot', `${out}/final.png`]).catch(
    () => {},
  )
  await run('xcrun', ['simctl', 'terminate', sim, pkg]).catch(() => {})
}
assert(!failure, `Native XCTest failed; see ${out}/xcodebuild.log`)
console.log(`Native iOS ${negative ? 'negative control' : 'contracts'} passed: ${out}`)
