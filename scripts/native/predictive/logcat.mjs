import { spawn } from 'node:child_process'
import { open } from 'node:fs/promises'

// Fresh emulator boots and native lifecycle traces can exceed execFile's buffer.
export async function captureLogcat(serial, path) {
  const file = await open(path, 'w')
  try {
    await new Promise((resolve, reject) => {
      const child = spawn('adb', ['-s', serial, 'logcat', '-d', '-v', 'threadtime'], {
        stdio: ['ignore', file.fd, 'inherit'],
        timeout: 60000,
      })
      child.once('error', reject)
      child.once('close', (code, signal) => {
        if (code === 0) resolve()
        else
          reject(new Error(`logcat exited with ${code ?? signal}; partial log: ${path}`))
      })
    })
  } finally {
    await file.close()
  }
}
