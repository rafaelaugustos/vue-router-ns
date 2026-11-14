import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { commandLog, iosRuntimeReader, cleanupAll } from './observer.mjs'

const synced =
  'Successfully synced application org.nativescript.routerfiles on device test'
test('delayed CLI launch owns startup; observing restart never starts a competing process', async () => {
  const calls = []
  const read = iosRuntimeReader({
    serial: 'test',
    id: '42',
    run: async (...args) => {
      calls.push(args)
      return { stdout: '' }
    },
  })
  for (const output of [
    '',
    'Building project...',
    'Restarting application on device test...',
    'Restarting application on device test...\nnot ready',
  ])
    assert.equal(await read(output), output)
  assert.deepEqual(calls, [])
  const ready = 'CONVENTIONS_PHASE 42 ready'
  assert.equal(await read(ready), ready)
  assert.deepEqual(calls, [])
})
test('current failure before ready wins; a stale marker does not authorize success', async () => {
  let calls = 0
  const read = iosRuntimeReader({
    serial: 'test',
    id: '42',
    run: async () => {
      calls++
      return { stdout: 'CONVENTIONS_PHASE 42 ready' }
    },
  })
  const failure = 'CONVENTIONS_RESULT {"id":"42","ok":false}'
  assert.equal(await read(`${synced}\n${failure}`), `${synced}\n${failure}`)
  assert.equal(calls, 0)
  assert.equal(
    await read(`${synced}\nCONVENTIONS_PHASE 41 ready`),
    'CONVENTIONS_PHASE 42 ready',
  )
  assert.equal(calls, 1)
})
test('post-sync fallback only reads logs; a timed-out log service is not retried or relaunched', async () => {
  const calls = []
  const read = iosRuntimeReader({
    serial: 'test',
    id: '42',
    run: async (...args) => {
      calls.push(args)
      throw Object.assign(new Error('timeout'), { killed: true })
    },
  })
  assert.equal(await read(synced), synced)
  assert.equal(await read(synced), synced)
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0][1].slice(0, 5), ['simctl', 'spawn', 'test', 'log', 'show'])
  assert.equal(await read('CONVENTIONS_PHASE 42 ready'), 'CONVENTIONS_PHASE 42 ready')
})
test('a non-timeout diagnostic failure propagates', async () => {
  const error = new Error('device unavailable')
  const read = iosRuntimeReader({
    serial: 'test',
    id: '42',
    run: async () => {
      throw error
    },
  })
  await assert.rejects(read(synced), (value) => value === error)
})
test('real failed and hung commands retain output, exit/signal, timeout and duration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'conventions-commands-'))
  try {
    const run = commandLog(dir)
    await assert.rejects(
      run(process.execPath, [
        '-e',
        'process.stdout.write("before failure"); process.stderr.write("cause"); process.exit(7)',
      ]),
    )
    const failed = JSON.parse(await readFile(join(dir, '1.json'), 'utf8'))
    assert.equal(failed.error.code, 7)
    assert.equal(failed.error.stdout, 'before failure')
    assert.equal(failed.error.stderr, 'cause')
    await assert.rejects(
      run(
        process.execPath,
        [
          '-e',
          'process.stdout.write("waiting"); process.on("SIGTERM",()=>{}); setInterval(()=>{},100)',
        ],
        { timeout: 500 },
      ),
    )
    const hung = JSON.parse(await readFile(join(dir, '2.json'), 'utf8'))
    assert.equal(hung.status, 'failed')
    assert.equal(hung.error.killed, true)
    assert.equal(hung.error.signal, 'SIGKILL')
    assert.equal(hung.error.stdout, 'waiting')
    assert.equal(hung.timeoutMs, 500)
    assert(hung.durationMs >= 500 && hung.durationMs < 5000)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
test('failed diagnostics cannot skip source restoration and process cleanup', async () => {
  const calls = []
  const failures = await cleanupAll([
    [
      'diagnostics',
      async () => {
        calls.push('diagnostics')
        throw new Error('simulator unavailable')
      },
    ],
    [
      'restore',
      async () => {
        calls.push('restore')
      },
    ],
    [
      'stop',
      async () => {
        calls.push('stop')
        throw new Error('already exited')
      },
    ],
    [
      'release',
      async () => {
        calls.push('release')
      },
    ],
  ])
  assert.deepEqual(calls, ['diagnostics', 'restore', 'stop', 'release'])
  assert.deepEqual(
    failures.map((f) => f.name),
    ['diagnostics', 'stop'],
  )
})
