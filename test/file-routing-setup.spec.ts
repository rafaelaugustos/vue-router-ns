import { mkdtemp, mkdir, writeFile, readFile, rm, rename } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import webpack, { type Stats } from 'webpack'
import { afterEach, beforeAll, expect, it } from 'vitest'
import { prepareFileRouting } from '../src/file-routing/setup.js'
import { transformPageMeta } from '../src/file-routing/generator.js'

const directories: string[] = []
const require = createRequire(import.meta.url)
beforeAll(() =>
  execFileSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json'],
    { stdio: 'pipe' },
  ),
)
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  )
})
const sfc = (name = 'home') =>
  `<script setup lang="ts">definePageMeta({name: '${name}', layout: 'default', middleware: ['auth']})</script><template><Page/></template>`
async function fixture() {
  const rootDir = await mkdtemp(join(tmpdir(), 'router-setup-92-'))
  directories.push(rootDir)
  const put = async (file: string, value: string) => {
    const path = join(rootDir, file)
    await mkdir(join(path, '..'), { recursive: true })
    await writeFile(path, value)
  }
  await put('src/pages/index.vue', sfc())
  return { rootDir, put }
}

it.each([undefined, { version: '4.47.0' }, { version: '6.0.0' }])(
  'reports an unsupported webpack host before registering hooks',
  (host) => {
    const { NativeFileRoutesPlugin } = require('../dist/file-routing/webpack.cjs')
    const plugin = new NativeFileRoutesPlugin({ platform: 'android' })
    expect(() => plugin.apply({ webpack: host })).toThrow(
      'NativeFileRoutesPlugin requires webpack 5',
    )
  },
)

it('prepares deterministic platform modules, opt-in discovery, declarations and explicit registration', async () => {
  const { rootDir, put } = await fixture()
  await put('src/layouts/default.vue', '<template><Page><slot/></Page></template>')
  await put('src/layouts/default.ios.vue', '<template><Page><slot/></Page></template>')
  await put('src/middleware/auth.ts', 'export default () => false')
  await put('src/middleware/01.audit.global.ts', 'export default () => {}')
  // File names deliberately reject dots except .global and the platform suffix.
  await expect(
    prepareFileRouting({
      rootDir,
      platform: 'ios',
      autoImports: true,
      layoutsDir: 'src/layouts',
      middlewareDir: 'src/middleware',
    }),
  ).rejects.toThrow('Discovered names')
  await rename(
    join(rootDir, 'src/middleware/01.audit.global.ts'),
    join(rootDir, 'src/middleware/01-audit.global.ts'),
  )
  const options = {
    rootDir,
    platform: 'ios' as const,
    autoImports: true,
    layoutsDir: 'src/layouts',
    middlewareDir: 'src/middleware',
  }
  const result = await prepareFileRouting(options)
  expect(result.changed).toHaveLength(5)
  expect((await prepareFileRouting(options)).changed).toEqual([])
  const registry = await readFile(join(result.outDir, 'registrations.ios.ts'), 'utf8')
  expect(registry).toContain('default.ios.vue')
  expect(registry).toContain('name: "01-audit", global: true')
  expect(registry.indexOf('01-audit.global')).toBeLessThan(registry.indexOf('auth'))
  const index = await readFile(join(result.outDir, 'index.ios.ts'), 'utf8')
  expect(index).toContain("module.hot.accept('./routes.ios'")
  expect(index).not.toContain('createRouter(')
  expect(await readFile(join(result.outDir, 'auto-imports.d.ts'), 'utf8')).toContain(
    'declare global',
  )
  await expect(prepareFileRouting({ ...options, autoImports: false })).rejects.toThrow(
    'Import definePageMeta',
  )
  await put(
    'src/pages/index.vue',
    sfc().replace(
      'definePageMeta(',
      "import {definePageMeta} from 'vue-router-ns/file-routing'; definePageMeta(",
    ),
  )
  await prepareFileRouting({ ...options, autoImports: false })
  expect(await readFile(join(result.outDir, 'auto-imports.d.ts'), 'utf8')).toBe(
    'export {}\n',
  )
})

it('keeps all previous generated files after invalid discovery or metadata', async () => {
  const { rootDir, put } = await fixture()
  const options = { rootDir, platform: 'android' as const, autoImports: true }
  const result = await prepareFileRouting(options)
  const before = await Promise.all(result.files.map((f) => readFile(f, 'utf8')))
  await put('src/pages/other.vue', sfc())
  await expect(prepareFileRouting(options)).rejects.toThrow('Duplicate route name')
  expect(await Promise.all(result.files.map((f) => readFile(f, 'utf8')))).toEqual(before)
  await expect(
    prepareFileRouting({ ...options, outDir: 'src/pages/generated' }),
  ).rejects.toThrow('outDir must be outside')
})

it('only treats unbound top-level definePageMeta as an automatic macro', () => {
  expect(transformPageMeta(sfc(), 'index.vue', { autoImports: true }).metadata.name).toBe(
    'home',
  )
  expect(() => transformPageMeta(sfc(), 'index.vue')).toThrow('Import definePageMeta')
  for (const declaration of [
    'const definePageMeta = () => {};',
    'import { definePageMeta } from "other";',
  ]) {
    const source = `<script setup>${declaration} definePageMeta({name:'local'})</script><template><Page/></template>`
    expect(transformPageMeta(source, 'local.vue', { autoImports: true }).code).toBe(
      source,
    )
    const shared = `<script>${declaration}</script><script setup>definePageMeta({name:'local'})</script><template><Page/></template>`
    expect(transformPageMeta(shared, 'shared.vue', { autoImports: true }).code).toBe(
      shared,
    )
  }
  const shadowed =
    '<script setup>function local(definePageMeta) { definePageMeta() }</script><template><Page/></template>'
  expect(transformPageMeta(shadowed, 'local.vue', { autoImports: true }).code).toBe(
    shadowed,
  )
  expect(() =>
    transformPageMeta(
      '<script setup>function f(){definePageMeta({name:"nested"})}</script><template><Page/></template>',
      'nested.vue',
      { autoImports: true },
    ),
  ).toThrow('Import definePageMeta')
})

it('uses real webpack watch for add, metadata edit, rename, remove and error recovery', async () => {
  const { rootDir, put } = await fixture()
  const { NativeFileRoutesPlugin } =
    require('../dist/file-routing/webpack.cjs') as typeof import('../src/file-routing/webpack.cjs')
  await put(
    'entry.cjs',
    `module.exports = { table: require('./src/generated/router/routes.android.ts'), page: require('./src/pages/index.vue?vue&type=script&lang=ts'), partial: require('./src/pages/_partial.vue') }`,
  )
  // This is an ordinary excluded component, not a file-routed page.
  await put(
    'src/pages/_partial.vue',
    '<script src="./external.ts"></script><template><Label/></template>',
  )
  await put('src/pages/invalid.vue', sfc())
  const compiler = webpack({
    mode: 'development',
    target: 'node',
    context: rootDir,
    entry: './entry.cjs',
    devtool: false,
    output: {
      path: join(rootDir, 'out'),
      filename: 'bundle.cjs',
      library: { type: 'commonjs2' },
    },
    module: { rules: [{ test: /\.(ts|vue)$/, type: 'asset/source' }] },
    plugins: [
      new NativeFileRoutesPlugin({ platform: 'android', autoImports: true }),
      new webpack.HotModuleReplacementPlugin(),
    ],
  })!
  const results: Stats[] = []
  const bundles = new WeakMap<Stats, string>()
  let failure: Error | undefined
  const watcher = compiler.watch({ aggregateTimeout: 30 }, (error, stats) => {
    if (error) failure = error
    if (stats) {
      if (!stats.hasErrors())
        bundles.set(stats, readFileSync(join(rootDir, 'out/bundle.cjs'), 'utf8'))
      results.push(stats)
    }
  })
  async function next(predicate: (stats: Stats) => boolean) {
    for (let i = 0; i < 300; i++) {
      if (failure) throw failure
      const found = results.find(predicate)
      if (found) {
        results.splice(0, results.indexOf(found) + 1)
        return found
      }
      await new Promise((resolve) => setTimeout(resolve, 30))
    }
    throw new Error(
      'Timed out waiting for webpack watch: ' +
        results.map((r) => r.toString({ all: false, errors: true })).join('\n'),
    )
  }
  const table = (stats: Stats): string => {
    const sandbox = {
      module: { exports: {} as { table: string; page: string; partial: string } },
    }
    runInNewContext(bundles.get(stats)!, sandbox)
    expect(sandbox.module.exports.page).not.toContain('definePageMeta(')
    expect(sandbox.module.exports.partial).toContain('script src=')
    return sandbox.module.exports.table
  }
  try {
    expect(
      (await next((s) => s.hasErrors())).toString({ all: false, errors: true }),
    ).toContain('Duplicate route name')
    await rm(join(rootDir, 'src/pages/invalid.vue'))
    expect(table(await next((s) => !s.hasErrors()))).toContain('"home"')
    await put('src/pages/added.vue', sfc('added'))
    await next((s) => !s.hasErrors() && table(s).includes('"added"'))
    await put('src/pages/added.vue', sfc('edited'))
    await next((s) => !s.hasErrors() && table(s).includes('"edited"'))
    await rename(
      join(rootDir, 'src/pages/added.vue'),
      join(rootDir, 'src/pages/renamed.vue'),
    )
    const beforeError = await next(
      (s) => !s.hasErrors() && table(s).includes('"/renamed"'),
    )
    await put('src/pages/duplicate.vue', sfc('edited'))
    expect(
      (await next((s) => s.hasErrors())).toString({ all: false, errors: true }),
    ).toContain('Duplicate route name')
    await put('src/pages/duplicate.vue', sfc('recovered'))
    const recovered = await next(
      (s) => !s.hasErrors() && table(s).includes('"recovered"'),
    )
    expect(
      Object.keys(recovered.compilation.assets).some((name) =>
        name.includes(`.${beforeError.hash}.hot-update.json`),
      ),
    ).toBe(true)
    await rm(join(rootDir, 'src/pages/renamed.vue'))
    await next((s) => !s.hasErrors() && !table(s).includes('"edited"'))
    // Directory discovery updates agree with a clean generation.
    expect(
      (await prepareFileRouting({ rootDir, platform: 'android', autoImports: true }))
        .changed,
    ).toEqual([])
  } finally {
    await new Promise<void>((resolve, reject) =>
      watcher!.close((e) => (e ? reject(e) : resolve())),
    )
    await new Promise<void>((resolve, reject) =>
      compiler.close((e) => (e ? reject(e) : resolve())),
    )
  }
}, 20000)
