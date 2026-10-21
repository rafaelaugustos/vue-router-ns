import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'

export async function recordEnvironment(out, device) {
  const packages = {}
  for (const name of [
    '@nativescript/core',
    'nativescript-vue',
    '@nativescript/android',
    '@nativescript/ios',
  ]) {
    try {
      packages[name] = JSON.parse(
        await readFile(`demo/node_modules/${name}/package.json`, 'utf8'),
      ).version
    } catch {
      // Only the platform being built is necessarily installed.
    }
  }
  const report = {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
    host: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpus: os.cpus().length,
      cpu: os.cpus()[0]?.model,
    },
    node: process.version,
    runner: process.env.RUNNER_OS ?? 'local',
    runnerImage: process.env.ImageVersion,
    run: process.env.GITHUB_RUN_ID,
    attempt: process.env.GITHUB_RUN_ATTEMPT,
    packages,
    device,
  }
  await writeFile(`${out}/environment.json`, JSON.stringify(report, null, 2))
}
