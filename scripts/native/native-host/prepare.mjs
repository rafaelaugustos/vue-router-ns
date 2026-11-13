import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const root = process.cwd()
const out = resolve(
  process.env.HOST_PACK_OUT ?? mkdtempSync(`${tmpdir()}/native-host-pack-`),
)
mkdirSync(out, { recursive: true })
const run = (args, cwd = root) =>
  execFileSync('npm', args, {
    cwd,
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
  })
const pack = (cwd) => {
  const raw = run(['pack', '--json', '--pack-destination', out], cwd)
  const metadata = JSON.parse(raw.slice(raw.indexOf('[\n')))[0]
  return { path: resolve(out, metadata.filename), metadata }
}
const router = pack(root)
assert(router.metadata.files.some((file) => file.path === 'dist/testing/native-host.js'))
const adapterDir = resolve('examples/native-host-adapter')
const install = [
  'install',
  '--no-save',
  '--package-lock=false',
  '--ignore-scripts',
  '--prefer-offline',
  '--no-audit',
  '--no-fund',
]
run([...install, router.path], adapterDir)
const adapter = pack(adapterDir)
assert(
  adapter.metadata.files.every((file) => !file.path.startsWith('src/')),
  'Adapter installs built output',
)
const appDir = resolve('examples/native-host-app')
run([...install, router.path, adapter.path], appDir)
run(['run', 'typecheck'], appDir)
const resources = resolve(appDir, 'App_Resources')
if (process.env.HOST_SKIP_RESOURCES !== '1' && !existsSync(resources)) {
  if (process.env.HOST_RESOURCES)
    cpSync(process.env.HOST_RESOURCES, resources, { recursive: true })
  else {
    const scaffold = mkdtempSync(`${tmpdir()}/host-scaffold-`)
    execFileSync(
      'ns',
      [
        'create',
        'host-fixture',
        '--template',
        '@nativescript/template-blank-ts',
        '--path',
        scaffold,
      ],
      { timeout: 120000, stdio: 'pipe' },
    )
    cpSync(resolve(scaffold, 'host-fixture/App_Resources'), resources, {
      recursive: true,
    })
  }
}
const plist = resolve(resources, 'iOS/Info.plist')
if (process.env.HOST_SKIP_RESOURCES !== '1') {
  writeFileSync(
    plist,
    readFileSync(plist, 'utf8').replace(
      /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/,
      '$1NativeHost Contract$2',
    ),
  )
}
const summary = (entry) => ({
  filename: entry.metadata.filename,
  shasum: entry.metadata.shasum,
  integrity: entry.metadata.integrity,
  size: entry.metadata.size,
})
writeFileSync(
  resolve(out, 'packages.json'),
  JSON.stringify({ router: summary(router), adapter: summary(adapter) }, null, 2) + '\n',
)
console.log(
  `Independent packed adapter and consumer typecheck passed; package evidence: ${out}`,
)
