import assert from 'node:assert/strict'
import test from 'node:test'
import { readSystemUi } from './system-ui.mjs'

const interrupted = () =>
  Object.assign(new Error('ADB read interrupted'), {
    code: 255,
    killed: false,
    signal: null,
    stderr: '',
    stdout:
      'SERVICE com.android.systemui/.SystemUIService abc pid=912 user=0\n  Client:\npartial',
  })
function fixture(options = {}) {
  const calls = [],
    events = []
  let dumps = 0,
    clock = 0
  const args = {
    bootId: 'boot-A',
    appPid: '1234',
    now: () => clock,
    record: async (event) => events.push(event),
    run: async (command, limits) => {
      calls.push({ command, timeout: limits.timeout })
      clock += options.elapsedPerRead ?? 1
      if (command.includes('dumpsys')) {
        dumps++
        if (dumps === 1 && options.firstSuccess) return 'original dump'
        if (dumps === 1 || options.repeatFailure) throw options.error ?? interrupted()
        return 'complete replacement dump'
      }
      if (command[0] === 'wait-for-device') {
        if (options.waitFailure) throw new Error('device unavailable')
        return ''
      }
      if (command.includes('cat')) return options.bootId ?? 'boot-A'
      if (command.includes('com.android.systemui')) return options.systemPid ?? '912'
      if (command.includes('org.nativescript.vuerouterns'))
        return options.changedAfterRetry && dumps === 2
          ? '9999'
          : (options.appPid ?? '1234')
      throw new Error('Unexpected command')
    },
  }
  return { args, calls, events, dumps: () => dumps }
}
test('successful diagnostics run exactly once without identity overhead', async () => {
  const f = fixture({ firstSuccess: true })
  assert.equal(await readSystemUi(f.args), 'original dump')
  assert.equal(f.calls.length, 1)
  assert.deepEqual(f.events, [])
})
test('repeats only the interrupted read and verifies identities before and after', async () => {
  const f = fixture()
  assert.equal(await readSystemUi(f.args), 'complete replacement dump')
  assert.equal(f.dumps(), 2)
  assert.deepEqual(
    f.events.map((event) => event.stage),
    ['failed-read', 'identity-confirmed', 'identity-confirmed', 'read-recovered'],
  )
  assert.equal(f.events[0].stdout, interrupted().stdout)
  assert.deepEqual(
    f.events
      .filter((event) => event.stage === 'identity-confirmed')
      .map((event) => event.phase),
    ['before-retry', 'after-retry'],
  )
  assert(
    f.calls.every(
      ({ command }) =>
        command.includes('dumpsys') ||
        command.includes('cat') ||
        command.includes('pidof') ||
        command[0] === 'wait-for-device',
    ),
  )
  assert(f.calls.every(({ timeout }, i) => timeout === 15000 - i))
})
test('launcher probe can recover before an app has started', async () => {
  const f = fixture()
  f.args.appPid = undefined
  await readSystemUi(f.args)
  assert(!f.calls.some(({ command }) => command.includes('org.nativescript.vuerouterns')))
})
for (const [name, options, message] of [
  ['device reboot', { bootId: 'boot-B' }, /Device rebooted/],
  ['SystemUI restart', { systemPid: '9999' }, /SystemUI restarted/],
  ['fixture restart', { appPid: '9999' }, /Fixture restarted/],
  ['fixture death', { appPid: '' }, /Fixture restarted/],
  ['restart during repeated read', { changedAfterRetry: true }, /Fixture restarted/],
  ['unavailable device', { waitFailure: true }, /device unavailable/],
  ['repeated interrupted read', { repeatFailure: true }, /ADB read interrupted/],
  ['exhausted total deadline', { elapsedPerRead: 5000 }, /exceeded 15 seconds/],
])
  test(`fails closed on ${name}`, async () => {
    const f = fixture(options)
    await assert.rejects(readSystemUi(f.args), message)
    assert(f.dumps() <= 2)
    assert.equal(f.events.at(-1).stage, 'recovery-failed')
  })
for (const [name, error] of [
  ['unrelated exit code', Object.assign(interrupted(), { code: 1 })],
  ['killed command', Object.assign(interrupted(), { killed: true })],
  ['signal', Object.assign(interrupted(), { signal: 'SIGTERM' })],
  [
    'missing service identity',
    Object.assign(interrupted(), { stdout: 'permission denied' }),
  ],
])
  test(`does not repeat ${name}`, async () => {
    const f = fixture({ error })
    await assert.rejects(readSystemUi(f.args), (actual) => actual === error)
    assert.equal(f.calls.length, 1)
  })
