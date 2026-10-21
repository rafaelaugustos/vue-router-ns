// Real UI capture for the iPhone 17 / iOS 26 demo, using idb and simctl.
// Build/install/launch the demo on a dedicated simulator and close any modal first.
import assert from 'node:assert/strict'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const exec = promisify(execFile)
const sim = process.env.IOS_SIMULATOR
assert(sim, 'Set IOS_SIMULATOR to your dedicated iPhone 17 simulator')
const idb = process.env.IDB ?? 'idb'
const out = resolve(process.env.OUT ?? '/tmp/router-docs-media')
const name = process.argv[2]
assert(
  [
    'ios-zoom',
    'ios-document-picker',
    'ios-modal-result',
    'ios-deep-link',
    'ios-shortcuts',
  ].includes(name),
  'Choose a documented recording name',
)
const run = async (bin, args) =>
  (await exec(bin, args.map(String), { maxBuffer: 8e6, timeout: 30000 })).stdout
const ui = (...args) => run(idb, ['ui', ...args, '--udid', sim])
const native = (...args) => run('xcrun', ['simctl', ...args])
const wait = (ms = 1400) => new Promise((resolve) => setTimeout(resolve, ms))
const nodes = async () => JSON.parse(await ui('describe-all', '--json'))
const tap = async (x, y, duration = 0.12) => {
  await ui('tap', '--duration', duration, Math.round(x), Math.round(y))
  await wait()
}
const label = async (text, duration) => {
  const node = (await nodes()).find((n) => n.AXLabel === text || n.AXValue === text)
  assert(node, `Missing native label: ${text}`)
  const f = node.frame
  await tap(f.x + f.width / 2, f.y + f.height / 2, duration)
}
const screen = (await nodes()).find((n) => n.type === 'Application')?.frame
assert(
  screen?.width === 402 && screen?.height === 874,
  'Coordinates require a portrait iPhone 17 (402 × 874 points)',
)
await mkdir(out, { recursive: true })
await native(
  'status_bar',
  sim,
  'override',
  '--time',
  '9:41',
  '--batteryState',
  'charged',
  '--batteryLevel',
  '100',
)
// Set the initial scene before starting the recording. Coordinates are for native
// toolbar/tab controls that idb does not consistently expose as accessibility nodes.
if (name === 'ios-zoom') {
  await tap(250, 824)
  await tap(250, 824)
  await label('Zoom from a card')
} else {
  await tap(150, 824)
  await tap(150, 824)
  if (name === 'ios-document-picker') await tap(360, 86)
  if (name === 'ios-modal-result') await label('Ana: Lunch on Friday?')
  if (name === 'ios-shortcuts') {
    await ui('button', 'HOME')
    await wait(1500)
  }
}
const child = spawn('xcrun', [
  'simctl',
  'io',
  sim,
  'recordVideo',
  '--codec=h264',
  '--force',
  `${out}/${name}.mov`,
])
const finished = new Promise((resolve, reject) => {
  child.on('error', reject)
  child.on('exit', (code) =>
    code === 0 ? resolve() : reject(new Error(`Recorder exited ${code}`)),
  )
})
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Recorder did not start')), 12000)
    child.stderr.on('data', (data) => {
      if (String(data).includes('Recording started')) {
        clearTimeout(timeout)
        resolve()
      }
    })
    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })
  await wait(1000)
  if (name === 'ios-zoom') {
    await label('Lunch on Friday?')
    await wait(1600)
    await tap(32, 86)
    await wait(1200)
  } else if (name === 'ios-document-picker') {
    await tap(280, 450)
    await wait(1800)
    await tap(362, 110)
    await wait(1000)
  } else if (name === 'ios-modal-result') {
    await label('Reply')
    await tap(180, 250)
    await ui('text', 'See you at 12:30!')
    await wait()
    await tap(350, 100)
    await wait(1600)
    assert(
      (await nodes()).some((n) => n.AXLabel === 'See you at 12:30!'),
      'Modal did not return the reply',
    )
  } else if (name === 'ios-deep-link') {
    await native('openurl', sim, 'vuerouterns://settings/account')
    await wait(1200)
    if ((await nodes()).some((n) => n.AXLabel === 'Open')) await label('Open')
    await wait(2300)
  } else {
    await label('demo', 1.2)
    await wait(900)
    await label('New message')
    await wait(1800)
  }
  await wait(1000)
} finally {
  child.kill('SIGINT')
  await finished
}
await native('io', sim, 'screenshot', `${out}/${name}-end.png`)
await writeFile(`${out}/${name}-end.json`, JSON.stringify(await nodes(), null, 2))
console.log(`Recorded ${name}; review the complete video before encoding`)
