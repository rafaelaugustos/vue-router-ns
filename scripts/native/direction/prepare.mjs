import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, readdir, lstat, writeFile } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const out = resolve(process.env.OUT ?? 'scripts/native/out/direction')
const app = join(out, 'app')
await mkdir(out, { recursive: true })
await mkdir(app) // Require a fresh consumer; never erase an existing installation.
const commands = []
async function run(command, args, cwd = root) {
  const entry = { command, args, cwd, startedAt: new Date().toISOString() }
  commands.push(entry)
  try {
    const result = await exec(command, args, {
      cwd,
      timeout: 600000,
      killSignal: 'SIGKILL',
      maxBuffer: 32 * 1024 * 1024,
    })
    entry.ok = true
    return result.stdout
  } catch (error) {
    entry.ok = false
    entry.error = String(error)
    throw error
  } finally {
    entry.finishedAt = new Date().toISOString()
    await writeFile(
      join(out, 'preparation-commands.json'),
      JSON.stringify(commands, null, 2),
    )
  }
}
await run('npm', ['run', 'build'])
const [packed] = JSON.parse(
  await run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', out]),
)
const tarball = join(out, packed.filename)
const fixture = join(root, 'examples/ios-direction-repro')
for (const name of [
  'src',
  'package.json',
  'package-lock.json',
  'nativescript.config.ts',
  'webpack.config.js',
])
  await cp(join(fixture, name), join(app, name), { recursive: true })
await mkdir(join(app, 'scripts'))
await cp(join(fixture, 'scripts/resources.mjs'), join(app, 'scripts/resources.mjs'))
const manifest = JSON.parse(await readFile(join(app, 'package.json'), 'utf8'))
manifest.dependencies['@nativescript/core'] = '9.1.4'
manifest.dependencies['nativescript-vue'] = '3.1.3'
manifest.dependencies['vue-router-ns'] = tarball
await writeFile(join(app, 'package.json'), JSON.stringify(manifest, null, 2))
const routerEntry = join(app, 'src/router.js')
const source = await readFile(routerEntry, 'utf8')
assert(source.includes('Router rc.3:'))
await writeFile(routerEntry, source.replace('Router rc.3:', `Router ${packed.version}:`))
await run('npm', ['install', '--no-audit', '--no-fund'], app)
await run('node', ['scripts/resources.mjs'], app)

// Compare the installed Core source with the registry package, not an assumed version.
const [core] = JSON.parse(
  await run('npm', [
    'pack',
    '@nativescript/core@9.1.4',
    '--ignore-scripts',
    '--json',
    '--pack-destination',
    out,
  ]),
)
const extracted = join(out, 'published-core')
await mkdir(extracted)
await run('tar', ['-xzf', join(out, core.filename), '-C', extracted])
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const files = []
async function compare(relative = '') {
  for (const entry of await readdir(join(extracted, 'package', relative), {
    withFileTypes: true,
  })) {
    const name = join(relative, entry.name)
    if (entry.isDirectory()) await compare(name)
    else if (name !== 'package.json') {
      const expected = hash(await readFile(join(extracted, 'package', name)))
      assert.equal(
        hash(await readFile(join(app, 'node_modules/@nativescript/core', name))),
        expected,
        name,
      )
      files.push({ path: name, sha256: expected })
    }
  }
}
await compare()
assert(!(await lstat(join(app, 'node_modules/vue-router-ns'))).isSymbolicLink())
const packages = {}
for (const name of [
  '@nativescript/core',
  'nativescript-vue',
  'vue-router-ns',
  '@nativescript/ios',
  '@nativescript/webpack',
  'webpack',
])
  packages[name] = JSON.parse(
    await readFile(join(app, 'node_modules', name, 'package.json'), 'utf8'),
  ).version
assert.equal(packages['vue-router-ns'], packed.version)
const provenance = {
  commit: (await run('git', ['rev-parse', 'HEAD'])).trim(),
  dirty: Boolean(
    (await run('git', ['status', '--porcelain', '--untracked-files=no'])).trim(),
  ),
  node: process.version,
  host: { platform: process.platform, arch: process.arch },
  packages,
  router: {
    filename: packed.filename,
    integrity: packed.integrity,
    sha256: hash(await readFile(tarball)),
  },
  core: {
    filename: core.filename,
    integrity: core.integrity,
    comparedSourceFiles: files.length,
    excluded: ['package.json installation metadata'],
    files,
  },
  fixtureChanges: [
    'Core 9.1.4',
    'Vue 3.1.3',
    'current router tarball',
    'router version display label',
  ],
}
await writeFile(join(out, 'provenance.json'), JSON.stringify(provenance, null, 2))
console.log(JSON.stringify({ app, packages, comparedCoreFiles: files.length }))
