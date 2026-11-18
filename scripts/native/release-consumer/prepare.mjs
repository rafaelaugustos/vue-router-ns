// Build a fresh native consumer of the exact candidate tarball. Historical
// rc.3 fixtures stay pinned; only their displayed version and test title change.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, writeFile, lstat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const tarball = resolve(process.argv[2] ?? '')
assert(tarball.endsWith('.tgz'), 'Pass the candidate tarball')
const out = resolve(process.env.OUT ?? 'scripts/native/out/release-consumer')
const app = join(out, 'consumer')
await mkdir(out, { recursive: true })
await mkdir(app) // Never erase an existing consumer.
const packed = JSON.parse(execFileSync('tar', ['-xOf', tarball, 'package/package.json']))
const title = `Router ${packed.version} · consumer acceptance`
const fixture = join(root, 'examples/rc3-consumer')
for (const name of [
  'src',
  'types',
  'scripts',
  'package.json',
  'tsconfig.json',
  'nativescript.config.ts',
  'webpack.config.js',
])
  await cp(join(fixture, name), join(app, name), { recursive: true })
const manifest = JSON.parse(await readFile(join(app, 'package.json'), 'utf8'))
manifest.name = 'router-stable-consumer'
manifest.dependencies = {
  '@nativescript/core': '9.1.4',
  'nativescript-vue': '3.1.3',
  'vue-router-ns': tarball,
}
delete manifest.scripts['verify:package'] // Historical registry-only rc.3 check.
await writeFile(join(app, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
const replace = async (path, from, to) => {
  const source = await readFile(path, 'utf8')
  assert(source.includes(from), `Missing version marker in ${path}`)
  await writeFile(path, source.replaceAll(from, to))
}
await replace(
  join(app, 'src/pages/Home.vue'),
  'Published rc.3 · consumer acceptance',
  title,
)
await replace(
  join(app, 'src/environment.ts'),
  'vue-router-ns@0.1.0-rc.3',
  `vue-router-ns@${packed.version}`,
)
const runner = join(out, 'runner/rc3-consumer')
await mkdir(runner, { recursive: true })
for (const name of ['project.rb', 'ConsumerUITests.swift', 'android.mjs'])
  await cp(join(root, 'scripts/native/rc3-consumer', name), join(runner, name))
await mkdir(join(out, 'runner/contracts'))
for (const name of ['ContractTouch.m', 'ContractTouch.h'])
  await cp(
    join(root, 'scripts/native/contracts', name),
    join(out, 'runner/contracts', name),
  )
for (const name of ['ConsumerUITests.swift', 'android.mjs'])
  await replace(join(runner, name), 'Published rc.3 · consumer acceptance', title)
await replace(
  join(runner, 'android.mjs'),
  'Android rc.3 consumer:',
  `Android ${packed.version} consumer:`,
)
for (const args of [
  ['install', '--no-audit', '--no-fund'],
  ['ci', '--no-audit', '--no-fund'],
  ['run', 'resources'],
  ['run', 'typecheck'],
])
  execFileSync('npm', args, { cwd: app, stdio: 'inherit', timeout: 300000 })
assert(!(await lstat(join(app, 'node_modules/vue-router-ns'))).isSymbolicLink())
const installed = JSON.parse(
  await readFile(join(app, 'node_modules/vue-router-ns/package.json'), 'utf8'),
)
assert.equal(installed.version, packed.version)
const lock = JSON.parse(await readFile(join(app, 'package-lock.json'), 'utf8'))
const bytes = await readFile(tarball)
const integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64')
assert.equal(lock.packages['node_modules/vue-router-ns'].integrity, integrity)
assert.equal(lock.packages['node_modules/@nativescript/core'].version, '9.1.4')
assert.equal(lock.packages['node_modules/nativescript-vue'].version, '3.1.3')
await writeFile(
  join(out, 'package-proof.json'),
  JSON.stringify(
    {
      version: packed.version,
      tarball: tarball.split('/').at(-1),
      integrity,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      core: '9.1.4',
      vue: '3.1.3',
      title,
      linked: false,
      fixture: 'examples/rc3-consumer',
      fixtureChanges: ['version label', 'package metadata'],
    },
    null,
    2,
  ) + '\n',
)
console.log(`Prepared ${packed.version} native consumer at ${app}`)
