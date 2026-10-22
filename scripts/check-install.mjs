// Exercise npm's actual resolver against a packed or published router package.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'

const exec = promisify(execFile)
const input = process.argv[2]
assert(input, 'Pass a router .tgz path or published package spec')
const spec = input.endsWith('.tgz') ? resolve(input) : input
const npm = process.env.NPM_CLI ? process.execPath : 'npm'
const prefix = process.env.NPM_CLI ? [process.env.NPM_CLI] : []
const env = {
  ...process.env,
  npm_config_legacy_peer_deps: 'false',
  npm_config_force: 'false',
}
const version = (await exec(npm, [...prefix, '--version'], { env })).stdout.trim()
const reports =
  process.env.INSTALL_REPORTS ??
  (await mkdtemp(join(tmpdir(), 'router-install-reports-')))
await mkdir(reports, { recursive: true })
console.log(`Node ${process.version}, npm ${version}; reports: ${reports}`)

for (const bundler of ['none', 'webpack', 'vite']) {
  const project = await mkdtemp(join(tmpdir(), `router-install-${bundler}-`))
  let log = ''
  const run = async (command, args) => {
    log += `$ ${command} ${args.join(' ')}\n`
    try {
      const result = await exec(command, args, {
        cwd: project,
        env,
        timeout: 240000,
        maxBuffer: 8 * 1024 * 1024,
      })
      log += result.stdout + result.stderr
      return result
    } catch (error) {
      log += (error.stdout ?? '') + (error.stderr ?? '') + String(error)
      throw error
    }
  }
  try {
    const devDependencies =
      bundler === 'webpack'
        ? { '@nativescript/webpack': '5.0.38', webpack: '5.112.0' }
        : bundler === 'vite'
          ? {
              '@nativescript/vite': '8.0.20',
              vite: '8.3.4',
              '@vitejs/plugin-vue': '6.0.10',
              '@vitejs/plugin-vue-jsx': '5.1.6',
              '@vue/compiler-sfc': '3.5.44',
              typescript: '6.0.3',
              'vue-tsc': '3.3.13',
            }
          : {}
    await writeFile(
      join(project, 'package.json'),
      JSON.stringify(
        {
          name: 'native-router-install-check',
          version: '1.0.0',
          private: true,
          type: 'module',
          dependencies: { '@nativescript/core': '9.1.3', 'nativescript-vue': '3.1.2' },
          devDependencies,
        },
        null,
        2,
      ),
    )
    if (bundler === 'vite' && version.startsWith('10.')) {
      // npm 10 also crashes resolving NativeScript Vite's optional Angular peers
      // without any router installed. Exercise adding the router to the locked
      // NativeScript example; npm 11 additionally covers lockfile-free setup.
      await writeFile(
        join(project, 'package-lock.json'),
        await readFile(
          new URL('../examples/file-routing/package-lock.json', import.meta.url),
        ),
      )
      console.log('vite/npm 10: starting from the NativeScript example lockfile')
    }
    await run(npm, [...prefix, 'install', spec, '--no-audit', '--no-fund'])
    await run(npm, [...prefix, 'ci', '--no-audit', '--no-fund'])
    await run(npm, [...prefix, 'ls', '--depth=0'])
    const installed = JSON.parse(
      await readFile(join(project, 'node_modules/vue-router-ns/package.json'), 'utf8'),
    )
    // Check the published layout, including optional tooling entrypoints and types.
    const targets = (value) =>
      typeof value === 'string' ? [value] : Object.values(value).flatMap(targets)
    for (const target of targets(installed.exports)) {
      assert(target.startsWith('./'), `Invalid package export ${target}`)
      await readFile(join(project, 'node_modules/vue-router-ns', target))
    }
    assert(!installed.peerDependencies?.vite, 'Router must not impose a Vite peer')
    assert(!installed.peerDependencies?.webpack, 'Router must not impose a webpack peer')
    if (bundler === 'none') {
      const lock = JSON.parse(await readFile(join(project, 'package-lock.json'), 'utf8'))
      // NativeScript-Vue's vue-loader may bring webpack through its own peer.
      assert(
        !lock.packages['node_modules/vite'],
        'Unexpected automatic Vite installation',
      )
    } else {
      await mkdir(join(project, 'src/pages'), { recursive: true })
      await writeFile(
        join(project, 'src/pages/index.vue'),
        '<script setup>const title = "Home"</script><template><Page/></template>',
      )
      await writeFile(join(project, 'index.js'), 'export const ready = true')
      const probe =
        bundler === 'vite'
          ? `
          import { resolveConfig } from 'vite'
          import { nativeFileRoutes } from 'vue-router-ns/file-routing/vite'
          await resolveConfig({ configFile: false, root: process.cwd(), plugins: [nativeFileRoutes({ platform: 'android' })] }, 'build')
        `
          : `
          import webpack from 'webpack'
          import integration from 'vue-router-ns/file-routing/webpack'
          const compiler = webpack({ mode: 'development', entry: './index.js', plugins: [new integration.NativeFileRoutesPlugin({ platform: 'android' })] })
          try {
            await new Promise((resolve, reject) => compiler.run((error, stats) => error || stats.hasErrors() ? reject(error ?? new Error(stats.toString())) : resolve()))
          } finally { await new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve())) }
        `
      await run(process.execPath, ['--input-type=module', '--eval', probe])
      await readFile(join(project, 'src/generated/router/index.android.ts'))
    }
    console.log(
      `${bundler}: install, clean reinstall and package checks passed (${installed.version})`,
    )
  } finally {
    await writeFile(join(reports, `${bundler}.log`), log)
    await rm(project, { recursive: true, force: true })
  }
}
