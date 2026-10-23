import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
assert(sim, 'Set IOS_SIMULATOR to a dedicated iPad simulator')
const out = resolve(process.env.OUT ?? 'scripts/native/out/windows-ios')
const project = resolve(process.env.XCTEST_PROJECT ?? '/tmp/router-window-tests')
const pkg = 'org.nativescript.vuerouterns'
const restoreScenes = process.env.RESTORE_SCENES === '1'
const reconnectScenes = process.env.RECONNECT_SCENES === '1'
assert(!(restoreScenes && reconnectScenes), 'Choose one scene lifecycle scenario')
const run = (cmd, args, options = {}) =>
  exec(cmd, args, { maxBuffer: 32 * 1024 * 1024, ...options })
await mkdir(out, { recursive: true })
await run('ruby', ['scripts/native/windows/project.rb', project])
await run('xcrun', ['simctl', 'uninstall', sim, pkg]).catch(() => {})
let app = resolve('demo/platforms/ios/build/Debug-iphonesimulator/demo.app')
if (reconnectScenes) {
  const staged = `${out}/fixture.app`
  await cp(app, staged, { recursive: true })
  app = staged
  const bundle = `${app}/RouterSceneProbe.bundle`
  await mkdir(bundle)
  const sdk = (
    await run('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-path'])
  ).stdout.trim()
  assert(['arm64', 'x64'].includes(process.arch), 'Supported simulator host architecture')
  await run('xcrun', [
    '--sdk',
    'iphonesimulator',
    'clang',
    '-dynamiclib',
    '-fobjc-arc',
    '-Werror',
    '-target',
    `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-ios18.0-simulator`,
    '-isysroot',
    sdk,
    '-framework',
    'Foundation',
    '-framework',
    'UIKit',
    'scripts/native/windows/SceneDriver.m',
    '-o',
    `${bundle}/RouterSceneProbe`,
  ])
  await writeFile(
    `${bundle}/Info.plist`,
    `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict><key>CFBundleExecutable</key><string>RouterSceneProbe</string>
<key>CFBundleIdentifier</key><string>org.nativescript.scenecheck</string>
<key>CFBundlePackageType</key><string>BNDL</string></dict></plist>`,
  )
}
await run('xcrun', ['simctl', 'install', sim, app])
if (reconnectScenes) await rm(app, { recursive: true })
let failure
async function test(method, label) {
  const result = await run(
    'xcodebuild',
    [
      'test',
      '-project',
      `${project}/WindowChecks.xcodeproj`,
      '-scheme',
      'WindowChecks',
      `-only-testing:WindowChecks/WindowUITests/${method}`,
      '-destination',
      `platform=iOS Simulator,id=${sim}`,
      '-derivedDataPath',
      `${project}/build`,
      '-collect-test-diagnostics',
      'never',
      '-resultBundlePath',
      `${out}/${label}.xcresult`,
    ],
    { timeout: 600000 },
  )
  await writeFile(`${out}/${label}.log`, result.stdout + result.stderr)
}
try {
  if (restoreScenes) {
    await test('testPrepareOnly', 'prepare')
    const data = (
      await run('xcrun', ['simctl', 'get_app_container', sim, pkg, 'data'])
    ).stdout.trim()
    const prepared = JSON.parse(
      await readFile(`${data}/Documents/windows-prepare.json`, 'utf8'),
    )
    // A simulator app is a host process. Verify the PID against this specific
    // simulator's launch service before killing only our fixture. Unlike a
    // graceful termination, SIGKILL preserves OS scene-session records.
    const jobs = (
      await run('xcrun', ['simctl', 'spawn', sim, 'launchctl', 'list'])
    ).stdout.split('\n')
    assert(
      jobs.some((line) => {
        const [pid, , label] = line.trim().split(/\s+/)
        return (
          pid === String(prepared.pid) && label?.startsWith(`UIKitApplication:${pkg}[`)
        )
      }),
      'Prepared PID belongs to the fixture in the dedicated simulator',
    )
    process.kill(prepared.pid, 'SIGKILL')
    await test('testResumeOnly', 'restore')
  } else if (reconnectScenes) {
    await test('testReconnectPrepare', 'detach')
    const data = (
      await run('xcrun', ['simctl', 'get_app_container', sim, pkg, 'data'])
    ).stdout.trim()
    const deadline = Date.now() + 25000
    while (true) {
      const report = await readFile(
        `${data}/Documents/windows-detached.json`,
        'utf8',
      ).catch(() => undefined)
      if (report) {
        assert(JSON.parse(report).ok)
        break
      }
      assert(Date.now() < deadline, 'UIKit must detach B before resuming the app')
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    await test('testReconnectResume', 'Reconnect')
  } else await test('testWindows', 'Windows')
} catch (error) {
  failure = error
  await writeFile(
    `${out}/xcodebuild.log`,
    `${String(error)}\n${error.stdout ?? ''}${error.stderr ?? ''}`,
  )
}
const container = (
  await run('xcrun', ['simctl', 'get_app_container', sim, pkg, 'data'])
).stdout.trim()
const reports = []
const commands = [
  'prepare',
  ...(reconnectScenes
    ? ['detached', 'reconnect']
    : [restoreScenes ? 'restore-scenes' : 'resume']),
  'hmr',
  'close',
]
for (const command of commands) {
  const source = await readFile(
    `${container}/Documents/windows-${command}.json`,
    'utf8',
  ).catch(() => undefined)
  if (!source) continue
  await writeFile(`${out}/${command}.json`, source)
  reports.push(JSON.parse(source))
}
await run('xcrun', ['simctl', 'io', sim, 'screenshot', `${out}/final.png`]).catch(
  () => {},
)
assert(!failure, `Native window scenario failed: ${out}/xcodebuild.log`)
assert.equal(reports.length, commands.length)
for (const report of reports) assert(report.ok, report.error)
// Foreground/background alone does not prove OS-driven scene reconnection.
const resume = reports.find(
  (report) =>
    report.command ===
    (reconnectScenes ? 'reconnect' : restoreScenes ? 'restore-scenes' : 'resume'),
)
if (restoreScenes || reconnectScenes) {
  const prepared = reports.find((report) => report.command === 'prepare')
  if (restoreScenes)
    assert.notEqual(
      resume.pid,
      prepared.pid,
      'UIKit reconstructed sessions in a new app process',
    )
  else {
    const detached = reports.find((report) => report.command === 'detached')
    assert.equal(detached.pid, prepared.pid)
    assert.equal(resume.pid, prepared.pid, 'Scene reconnect retains the app process')
    const original = prepared.sessions.find((item) => item.key === 'b')
    const gone = detached.sessions.find((item) => item.key === 'b')
    assert.equal(gone.window, original.window)
    assert.equal(gone.state, 'detached')
    assert(
      detached.sceneEvents.some(
        (event) =>
          event.event === 'sceneDidDisconnect' && event.window === original.window,
      ),
    )
    assert(
      resume.sceneEvents.filter(
        (event) => event.event === 'sceneWillConnect' && event.window === original.window,
      ).length >= 2,
    )
  }
  assert.equal(resume.sessions.length, 2)
  for (const session of resume.sessions) {
    const original = prepared.sessions.find((item) => item.key === session.key)
    assert(original)
    assert.equal(
      session.window,
      original.window,
      'Document stays in its original UIKit session',
    )
    assert.deepEqual(session.entryKeys, original.entryKeys.slice(0, 2))
  }
}
await writeFile(
  `${out}/scene-coverage.json`,
  JSON.stringify(
    {
      backgroundResume: !restoreScenes && !reconnectScenes,
      processRestoration: restoreScenes,
      sameProcessReconnect: reconnectScenes,
      disconnectedBeforeResume: resume.sceneEvents.filter(
        (event) => event.event === 'sceneDidDisconnect',
      ),
    },
    null,
    2,
  ),
)
console.log(
  reconnectScenes
    ? 'iPad same-process scene reconnect, retained native pages/results, HMR and closure passed'
    : restoreScenes
      ? 'iPad OS scene-session restoration, document identity, HMR and closure passed'
      : 'iPad window isolation, modal results, background resume and closure passed',
)
