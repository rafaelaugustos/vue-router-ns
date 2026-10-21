import { spawnSync } from 'node:child_process'

const [timeout, command, ...args] = process.argv.slice(2)
const result = spawnSync(command, args, {
  timeout: Number(timeout),
  killSignal: 'SIGKILL',
  stdio: 'inherit',
})
if (result.error) console.error(result.error.message)
process.exit(result.error?.code === 'ETIMEDOUT' ? 124 : (result.status ?? 1))
