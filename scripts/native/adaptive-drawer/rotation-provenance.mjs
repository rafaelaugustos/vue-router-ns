import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const hash = (data) => createHash('sha256').update(data).digest('hex')
async function tree(directory, exclude = []) {
  const files = []
  async function walk(relative = '') {
    for (const entry of await readdir(join(directory, relative), {
      withFileTypes: true,
    })) {
      const path = join(relative, entry.name)
      if (exclude.includes(path)) continue
      if (entry.isDirectory()) await walk(path)
      else files.push({ path, sha256: hash(await readFile(join(directory, path))) })
    }
  }
  await walk()
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return { count: files.length, sha256: hash(JSON.stringify(files)), files }
}

export async function recordRotationProvenance(out, simulator) {
  const run = async (command, args) =>
    (await exec(command, args, { timeout: 120000 })).stdout.trim()
  const packages = {}
  for (const name of [
    '@nativescript/core',
    'nativescript-vue',
    '@nativescript/ios',
    '@nativescript/webpack',
    'webpack',
  ])
    packages[name] = JSON.parse(
      await readFile(`demo/node_modules/${name}/package.json`, 'utf8'),
    ).version
  const sources = {}
  for (const path of [
    'demo/src/testing/adaptivedrawer-app.ts',
    'demo/src/testing/adaptive-rotation.ios.ts',
    'scripts/native/adaptive-drawer/RotationUITests.swift',
    'scripts/native/adaptive-drawer/rotation.mjs',
    'scripts/native/adaptive-drawer/bridge.mjs',
    'scripts/native/adaptive-drawer/content-back.mjs',
    'scripts/native/adaptive-drawer/programmatic-overlap.mjs',
    'scripts/native/adaptive-drawer/rotation-provenance.mjs',
  ])
    sources[path] = hash(await readFile(path))
  const infoPath = join(
    process.env.IOS_APP ?? 'demo/platforms/ios/build/Debug-iphonesimulator/demo.app',
    'Info.plist',
  )
  const info = JSON.parse(await run('plutil', ['-convert', 'json', '-o', '-', infoPath]))
  const provenance = {
    source: await run('git', ['rev-parse', 'HEAD']),
    dirty: Boolean(await run('git', ['status', '--porcelain', '--untracked-files=no'])),
    node: process.version,
    architecture: process.arch,
    simulator,
    xcode: await run('xcodebuild', ['-version']),
    packages,
    nativeApp: {
      infoPlistSha256: hash(await readFile(infoPath)),
      sdk: info.DTSDKName,
      requiresFullScreen: info.UIRequiresFullScreen,
      sceneManifest: info.UIApplicationSceneManifest,
      ipadOrientations: info['UISupportedInterfaceOrientations~ipad'],
    },
    sources,
    routerDist: await tree('dist'),
    core: await tree('demo/node_modules/@nativescript/core', ['package.json']),
    coreExclusion: 'package.json installation metadata',
    resolution:
      'Demo aliases the current checkout built dist; this is not a registry-consumer acceptance.',
  }
  await writeFile(join(out, 'provenance.json'), JSON.stringify(provenance, null, 2))
}
