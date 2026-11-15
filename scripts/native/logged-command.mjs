import { execFile } from 'node:child_process'
import { closeSync, openSync, writeSync } from 'node:fs'

/** Keep child output on disk even when the outer CI runner is interrupted. */
export async function loggedCommand(command, args, { logFile, ...options }) {
  const log = openSync(logFile, 'w')
  try {
    await new Promise((resolve, reject) => {
      const child = execFile(command, args, options, (error) => {
        if (error) reject(error)
        else resolve()
      })
      child.stdout?.on('data', (chunk) => writeSync(log, chunk))
      child.stderr?.on('data', (chunk) => writeSync(log, chunk))
    })
  } finally {
    closeSync(log)
  }
}
