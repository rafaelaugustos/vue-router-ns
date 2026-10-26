import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
const app = process.env.IOS_APP
assert(sim && app, 'Set IOS_SIMULATOR (dedicated iPad) and IOS_APP (backedgeTest build)')
const out = resolve(process.env.OUT ?? `/tmp/router-backedge-${sim}`)
await mkdir(out, { recursive: true })
const project = await mkdtemp(join(tmpdir(), 'router-backedge-'))
await exec(process.env.RUBY ?? 'ruby', ['scripts/native/backedge/project.rb', project])
const args = [
  '-project',
  join(project, 'BackEdge.xcodeproj'),
  '-scheme',
  'BackEdgeChecks',
  '-destination',
  `platform=iOS Simulator,id=${sim}`,
  '-parallel-testing-enabled',
  'NO',
  '-derivedDataPath',
  join(project, 'build'),
]
async function build(action, extra = []) {
  try {
    const result = await exec('xcodebuild', [action, ...args, ...extra], {
      timeout: 360000,
      maxBuffer: 16 * 1024 * 1024,
    })
    await writeFile(join(out, `${action}.log`), result.stdout + result.stderr)
  } catch (error) {
    await writeFile(
      join(out, `${action}.log`),
      `${error.stdout ?? ''}\n${error.stderr ?? ''}`,
    )
    throw new Error(`Native Back control failed; see ${join(out, `${action}.log`)}`)
  }
}
await build('build-for-testing')
for (const [bundle, path] of [
  ['org.nativescript.vuerouterns', app],
  [
    'org.router168.uikit',
    join(project, 'build/Build/Products/Debug-iphonesimulator/UIKitControl.app'),
  ],
]) {
  // These controls replace the two fixture apps on the explicitly chosen simulator.
  await exec('xcrun', ['simctl', 'terminate', sim, bundle]).catch(() => {})
  await exec('xcrun', ['simctl', 'uninstall', sim, bundle])
  await exec('xcrun', ['simctl', 'install', sim, path])
}
let recording
if (process.env.RECORD_VIDEO === '1') {
  recording = spawn(
    'xcrun',
    ['simctl', 'io', sim, 'recordVideo', '--codec=h264', join(out, 'backedge.mp4')],
    { stdio: 'ignore' },
  )
  await new Promise((resolve) => setTimeout(resolve, 500))
}
try {
  await build('test-without-building', [
    '-collect-test-diagnostics',
    'never',
    '-resultBundlePath',
    join(out, 'backedge.xcresult'),
  ])
} finally {
  if (recording && recording.exitCode === null) {
    const stopped = new Promise((resolve) => recording.once('exit', resolve))
    recording.kill('SIGINT')
    await stopped
  }
}
console.log(
  `12 native Back observations matched the documented baseline. Evidence: ${out}`,
)
