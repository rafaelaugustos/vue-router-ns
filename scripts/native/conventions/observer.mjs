import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export function errorRecord(error) {
  return {
    message: String(error),
    code: error?.code,
    signal: error?.signal,
    killed: error?.killed,
    stdout: error?.stdout,
    stderr: error?.stderr,
  }
}

/** Persist the attempted command even if it times out or the runner is interrupted. */
export function commandLog(directory, execute = promisify(execFile)) {
  let sequence = 0
  return async (command, args, options = {}) => {
    await mkdir(directory, { recursive: true })
    const path = join(directory, `${++sequence}.json`)
    const start = performance.now()
    const record = {
      command,
      args,
      startedAt: new Date().toISOString(),
      timeoutMs: options.timeout ?? 20000,
      status: 'running',
    }
    await writeFile(path, JSON.stringify(record, null, 2) + '\n')
    try {
      const result = await execute(command, args, {
        maxBuffer: 16 * 1024 * 1024,
        timeout: record.timeoutMs,
        killSignal: 'SIGKILL',
        ...options,
      })
      Object.assign(record, { status: 'passed', ...result })
      return result
    } catch (error) {
      Object.assign(record, { status: 'failed', error: errorRecord(error) })
      throw error
    } finally {
      record.durationMs = Math.round(performance.now() - start)
      await writeFile(path, JSON.stringify(record, null, 2) + '\n')
    }
  }
}

/** Observe CLI launch ownership; a temporarily absent PID is not permission to launch. */
export function iosRuntimeReader({ serial, id, run }) {
  let logUnavailable = false
  return async (output) => {
    if (
      output.includes(`CONVENTIONS_PHASE ${id} `) ||
      output.includes(`CONVENTIONS_RESULT {"id":"${id}"`) ||
      logUnavailable ||
      !output.includes(
        `Successfully synced application org.nativescript.routerfiles on device ${serial}`,
      )
    )
      return output
    // Only after the CLI acknowledges launch/sync. Never compete with its stop/start.
    try {
      const result = await run(
        'xcrun',
        [
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
        ],
        { timeout: 20000 },
      )
      return result.stdout
    } catch (error) {
      if (!error.killed) throw error
      logUnavailable = true
      return output
    }
  }
}

/** A failed diagnostic must not skip restoring fixtures or stopping owned processes. */
export async function cleanupAll(steps) {
  const failures = []
  for (const [name, run] of steps) {
    try {
      await run()
    } catch (error) {
      failures.push({ name, error: errorRecord(error) })
    }
  }
  return failures
}
