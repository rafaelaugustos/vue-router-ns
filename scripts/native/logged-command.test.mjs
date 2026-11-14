import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { loggedCommand } from './logged-command.mjs'

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'native-command-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return {
    logFile: join(directory, 'child.log'),
    release: join(directory, 'release'),
    pidFile: join(directory, 'child.pid'),
  }
}
async function waitForOutput(logFile, predicate) {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const output = await readFile(logFile, 'utf8').catch(() => '')
    if (predicate(output)) return output
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  assert.fail('Child output was not persisted while the command was running')
}

test('stdout and stderr are readable before the command exits', async (t) => {
  const { logFile, release } = await fixture(t)
  let completed = false
  const pending = loggedCommand(
    process.execPath,
    [
      '-e',
      `console.log('stdout ready'); console.error('stderr ready');
       setInterval(() => { if (require('fs').existsSync(process.argv[1])) process.exit(0) }, 10)`,
      release,
    ],
    { logFile, timeout: 10000 },
  ).finally(() => {
    completed = true
  })
  try {
    await waitForOutput(
      logFile,
      (text) => text.includes('stdout ready') && text.includes('stderr ready'),
    )
    assert.equal(completed, false)
  } finally {
    await writeFile(release, '')
    await pending
  }
})

test('a nonzero exit keeps its log and remains a failure', async (t) => {
  const { logFile } = await fixture(t)
  await assert.rejects(
    loggedCommand(
      process.execPath,
      ['-e', "console.error('native assertion failed'); process.exit(7)"],
      { logFile, timeout: 5000 },
    ),
    (error) => error.code === 7,
  )
  assert.match(await readFile(logFile, 'utf8'), /native assertion failed/)
})

test('the command deadline still rejects and preserves partial output', async (t) => {
  const { logFile } = await fixture(t)
  await assert.rejects(
    loggedCommand(
      process.execPath,
      ['-e', "console.log('before deadline'); setInterval(() => {}, 1000)"],
      { logFile, timeout: 1000 },
    ),
    (error) => error.killed && error.signal === 'SIGTERM',
  )
  assert.match(await readFile(logFile, 'utf8'), /before deadline/)
})

test('interrupting the runner retains output from its unfinished command', async (t) => {
  const { logFile, pidFile } = await fixture(t)
  const helper = new URL('./logged-command.mjs', import.meta.url).href
  const childSource =
    "require('fs').writeFileSync(process.argv[1], String(process.pid)); console.log('child PID ' + process.pid); console.error('unfinished XCTest output'); setTimeout(() => process.exit(0), 10000)"
  const parent = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { loggedCommand } from ${JSON.stringify(helper)};
     await loggedCommand(process.execPath, ['-e', ${JSON.stringify(childSource)}, ${JSON.stringify(pidFile)}], { logFile: ${JSON.stringify(logFile)}, timeout: 10000 });`,
    ],
    { stdio: 'ignore' },
  )
  const closed = once(parent, 'close')
  let childPid
  try {
    const output = await waitForOutput(
      logFile,
      (text) => /child PID \d+/.test(text) && text.includes('unfinished XCTest output'),
    )
    childPid = Number(/child PID (\d+)/.exec(output)[1])
    parent.kill('SIGTERM')
    const [code, signal] = await closed
    assert.equal(code, null)
    assert.equal(signal, 'SIGTERM')
    assert.match(await readFile(logFile, 'utf8'), /unfinished XCTest output/)
  } finally {
    parent.kill('SIGTERM')
    await closed
    childPid ??= Number(await readFile(pidFile, 'utf8').catch(() => ''))
    // This PID came from the child launched by this test, never a shared app.
    if (childPid) {
      try {
        process.kill(childPid, 'SIGKILL')
      } catch (error) {
        if (error.code !== 'ESRCH') throw error
      }
    }
  }
})
