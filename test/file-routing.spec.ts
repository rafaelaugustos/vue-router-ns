import type { Frame } from '@nativescript/core'
import { mkdtemp, mkdir, writeFile, readFile, rm, rename, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { execPath } from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import { compileScript, parse } from '@vue/compiler-sfc'
import {
  generateFileRoutes,
  writeFileRoutes,
  watchFileRoutes,
  transformPageMeta,
  type FilePage,
} from '../src/file-routing/generator.js'
import {
  createFileRouteUpdater,
  definePageMeta,
  mergeFileRoutes,
} from '../src/file-routing/index.js'
import { createMatcher } from '../src/matcher.js'
import { START_LOCATION } from '../src/router.js'
import {
  RouterView,
  useRoute,
  useRouter,
  useNativeHost,
  type RouteRecordRaw,
} from '../src/index.js'
import { h, ref } from 'nativescript-vue'
import { mount, page, paths } from './helpers.js'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  )
})
const sfc = (meta = '', setup = '') =>
  `<script setup lang="ts">\nimport { definePageMeta } from 'vue-router-ns/file-routing'\n${meta ? `definePageMeta(${meta})` : ''}\n${setup}\n</script>\n<template><Page /></template>`
async function fixture(files: Record<string, string>) {
  const dir = await mkdtemp(join(tmpdir(), 'router-files-89-'))
  directories.push(dir)
  const pagesDir = join(dir, 'pages'),
    outFile = join(dir, 'generated', 'routes.ts')
  await mkdir(pagesDir)
  async function put(file: string, code = '<template><Page /></template>') {
    const path = join(pagesDir, file)
    await mkdir(join(path, '..'), { recursive: true })
    await writeFile(path, code)
  }
  for (const [file, source] of Object.entries(files)) await put(file, source)
  return { pagesDir, outFile, put }
}
const records = (pages: FilePage[]): RouteRecordRaw[] =>
  pages.map((p) => ({
    path: p.path,
    name: p.name,
    component: () => page(p.name),
    children: records(p.children),
  }))

describe('file route generation', () => {
  it('uses the existing matcher for index, dynamic, optional and both catch-all forms', async () => {
    const f = await fixture(
      Object.fromEntries(
        [
          'index',
          'products',
          'products/index',
          'products/new',
          'products/[id]',
          'settings/[[tab]]',
          'files/[...path]',
          'any/[[...path]]',
        ].map((p) => [`${p}.vue`, '<template><Page /></template>']),
      ),
    )
    const result = await generateFileRoutes(f)
    const matcher = createMatcher(records(result.pages))
    const match = (path: string) => matcher.resolve(path, START_LOCATION)
    expect(match('/').name).toBe('index')
    expect(match('/products').name).toBe('products-index')
    expect(match('/products/new').name).toBe('products-new')
    const product = match('/products/42')
    expect(product.params).toEqual({ id: '42' })
    expect(matcher.parents(product).map((r) => r.fullPath)).toEqual(['/products'])
    expect(match('/settings').params).toEqual({})
    expect(match('/settings/security').params).toEqual({ tab: 'security' })
    expect(match('/files/a/b').params).toEqual({ path: ['a', 'b'] })
    expect(match('/files').matched).toEqual([])
    expect(match('/files/').matched).toEqual([])
    expect(match('/any').params).toEqual({})
    expect(match('/any/a/b').params).toEqual({ path: ['a', 'b'] })
    expect(result.code).toContain('(): Promise<RouteComponent> => import(')
    expect(result.code).toContain(
      'export type FileRouteMap = RouteMapFrom<typeof routes>',
    )
    expect(result.code).toBe((await generateFileRoutes(f)).code)
    expect(result.code).not.toMatch(
      /node:|compiler-sfc|nuxt|from ['"]vue-router['"]|savedAt/,
    )
  })
  it('uses page parents only, with stable names and explicit path overrides', async () => {
    const f = await fixture({
      'products.vue': sfc(`{ path: '/catalog', name: 'catalog' }`),
      'products/[id].vue': sfc(),
      'folders/item.vue': sfc(),
      'index.vue': sfc(),
    })
    const result = await generateFileRoutes(f)
    const matcher = createMatcher(records(result.pages))
    expect(
      matcher.resolve('/catalog/9', START_LOCATION).matched.map((r) => r.name),
    ).toEqual(['catalog', 'products-id'])
    expect(matcher.resolve('/folders/item', START_LOCATION).matched).toHaveLength(1)
    await f.put('folders.vue')
    expect(
      createMatcher(records((await generateFileRoutes(f)).pages)).resolve(
        '/folders/item',
        START_LOCATION,
      ).name,
    ).toBe('folders-item')
  })
  it('typechecks the real emitted module and rejects invalid names and parameter shapes', async () => {
    const f = await fixture(
      Object.fromEntries(
        [
          'index',
          'products/[id]',
          'settings/[[tab]]',
          'files/[...path]',
          'any/[[...path]]',
        ].map((p) => [`${p}.vue`, sfc()]),
      ),
    )
    await writeFileRoutes(f)
    const root = join(f.pagesDir, '..')
    await writeFile(
      join(root, 'vue.d.ts'),
      `declare module '*.vue' { const component: import('nativescript-vue').Component; export default component }`,
    )
    await writeFile(
      join(root, 'check.ts'),
      `import { createRouter } from 'vue-router-ns'
import { routes, type FileRouteParams } from './generated/routes'
const router = createRouter({ routes })
router.push({ name: 'products-id', params: { id: 42 } })
router.push({ name: 'settings-tab' })
router.push({ name: 'files-path', params: { path: ['a', 'b'] } })
router.push({ name: 'any-path' })
const optional: FileRouteParams<'settings-tab'> = {}
// @ts-expect-error unknown route
router.push({ name: 'missing' })
// @ts-expect-error required param missing
router.push({ name: 'products-id' })
// @ts-expect-error scalar required
router.push({ name: 'products-id', params: { id: ['x'] } })
// @ts-expect-error repeatable array required
router.push({ name: 'files-path', params: { path: 'x' } })
// @ts-expect-error wrong parameter
router.push({ name: 'products-id', params: { slug: 'x' } })
// @ts-expect-error optional parameter is a string
const invalid: FileRouteParams<'settings-tab'> = { tab: [] }
`,
    )
    await writeFile(
      join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          target: 'ES2023',
          module: 'ESNext',
          moduleResolution: 'bundler',
          types: [],
          paths: {
            'vue-router-ns': [resolve('src/index.ts')],
            'nativescript-vue': [resolve('node_modules/nativescript-vue')],
          },
        },
        include: ['./**/*.ts'],
      }),
    )
    const result = await promisify(execFile)(execPath, [
      resolve('node_modules/typescript/bin/tsc'),
      '-p',
      join(root, 'tsconfig.json'),
    ]).catch((error) => {
      throw new Error(error.stdout || error.message)
    })
    expect(result.stdout).toBe('')
  })
  it('preserves named route loaders in generated metadata', async () => {
    const f = await fixture({ 'index.vue': sfc('{ meta: { loaders: ["product"] } }') })
    const generated = await generateFileRoutes(f)
    expect(generated.pages[0]!.metadata.meta!.loaders).toEqual(['product'])
    expect(generated.code).toContain('"loaders"')
    expect(generated.code).toContain('"product"')
  })
  it('selects one platform variant, falls back to common pages, and skips opposite-only pages', async () => {
    const f = await fixture({
      'index.vue': sfc(),
      'index.ios.vue': sfc('{ meta: { platform: "ios" } }'),
      'only.android.vue': sfc(),
      '_private.vue': sfc(),
      '.hidden/x.vue': sfc(),
      'parts/button.vue': sfc(),
    })
    await expect(generateFileRoutes(f)).rejects.toThrow('Set platform')
    const ios = await generateFileRoutes({ ...f, platform: 'ios', exclude: ['parts'] })
    expect(ios.pages.map((p) => p.name)).toEqual(['index'])
    expect(ios.pages[0]!.file).toMatch(/index\.ios\.vue$/)
    expect(ios.files).toHaveLength(3)
    const android = await generateFileRoutes({
      ...f,
      platform: 'android',
      exclude: ['parts'],
    })
    expect(android.pages.map((p) => p.name)).toEqual(['index', 'only'])
    expect(android.pages[0]!.file).toMatch(/index\.vue$/)
  })
  it.each([
    [['foo/[id].vue', 'foo/[slug].vue'], 'Conflicting route pattern'],
    [['foo-bar.vue', 'foo/bar.vue'], 'Duplicate route name'],
    [['[id]/[id].vue'], 'Repeated parameter'],
    [['[...path]/child.vue'], 'catch-all parameter'],
    [['product-[id].vue'], 'Unsupported page segment'],
    [['(group)/page.vue'], 'Unsupported page segment'],
  ])('reports source locations for invalid conventions %s', async (names, error) => {
    const f = await fixture(Object.fromEntries(names.map((p) => [p, sfc()])))
    await expect(generateFileRoutes(f)).rejects.toThrow(error)
    await expect(generateFileRoutes(f)).rejects.toThrow(/\.vue:\d+:\d+:/)
  })
  it('rejects invalid overrides and missing parent params before output', async () => {
    const f = await fixture({
      '[id].vue': sfc(),
      '[id]/child.vue': sfc("{ path: '/oops' }"),
    })
    await expect(generateFileRoutes(f)).rejects.toThrow('preserve parent parameter')
    await f.put('[id]/child.vue', sfc("{ path: '/:id/bad?query=yes' }"))
    await expect(generateFileRoutes(f)).rejects.toThrow('Unsupported generated path')
    const conflicting = await fixture({
      'a.vue': sfc("{ path: '/Foo' }"),
      'b.vue': sfc("{ path: '/foo' }"),
    })
    await expect(generateFileRoutes(conflicting)).rejects.toThrow(
      'Conflicting route pattern',
    )
  })
  it('regenerates creation, rename, edits and removal identically to a clean scan without touching unchanged output', async () => {
    const f = await fixture({ 'index.vue': sfc(), 'old.vue': sfc() })
    expect((await writeFileRoutes(f)).changed).toBe(true)
    const before = await stat(f.outFile)
    expect((await writeFileRoutes(f)).changed).toBe(false)
    expect((await stat(f.outFile)).mtimeMs).toBe(before.mtimeMs)
    await f.put(
      'added.vue',
      sfc(
        '{ layout: "default", middleware: ["auth"], modal: { fullscreen: true }, transition: "fade", props: true, meta: { requiresAuth: true } }',
      ),
    )
    await rename(join(f.pagesDir, 'old.vue'), join(f.pagesDir, 'renamed.vue'))
    const changed = await writeFileRoutes(f)
    expect(changed.code).toBe((await generateFileRoutes(f)).code)
    expect(changed.code).toContain('"layout": "default"')
    expect(changed.code).not.toContain('old.vue')
    await f.put('invalid.vue', sfc('{ name: variableFromSetup }'))
    await expect(writeFileRoutes(f)).rejects.toThrow('literal data')
    expect(await readFile(f.outFile, 'utf8')).toBe(changed.code)
    await rm(join(f.pagesDir, 'invalid.vue'))
    await rm(join(f.pagesDir, 'added.vue'))
    const removed = await writeFileRoutes(f)
    expect(removed.code).toBe((await generateFileRoutes(f)).code)
    expect(removed.code).not.toContain('added.vue')
  })
  it('watches actual file creation/rename/removal and recovers after an invalid edit', async () => {
    const f = await fixture({ 'index.vue': sfc() })
    const generations: string[] = [],
      errors: unknown[] = []
    const watcher = await watchFileRoutes(f, {
      onGenerated: (r) => {
        generations.push(r.code)
      },
      onError: (e) => {
        errors.push(e)
      },
    })
    const until = async (condition: () => boolean) => {
      for (let i = 0; i < 100 && !condition(); i++)
        await new Promise((r) => setTimeout(r, 20))
      expect(condition()).toBe(true)
    }
    try {
      await f.put('added.vue')
      await until(() => !!generations.at(-1)?.includes('added.vue'))
      expect(generations.at(-1)).toBe((await generateFileRoutes(f)).code)
      await rename(join(f.pagesDir, 'added.vue'), join(f.pagesDir, 'renamed.vue'))
      await until(() => !!generations.at(-1)?.includes('renamed.vue'))
      expect(generations.at(-1)).toBe((await generateFileRoutes(f)).code)
      await f.put('renamed.vue', sfc('{ name: runtimeVariable }'))
      await until(() => errors.length > 0)
      expect(await readFile(f.outFile, 'utf8')).toBe(generations.at(-1))
      await rm(join(f.pagesDir, 'renamed.vue'))
      await until(() => !generations.at(-1)?.includes('renamed.vue'))
      expect(generations.at(-1)).toBe((await generateFileRoutes(f)).code)
    } finally {
      await watcher.close()
    }
  })
})

describe('page metadata AST transform', () => {
  it('distinguishes macro references from object properties and locally shadowed identifiers', () => {
    const source = sfc(
      '{}',
      `const value = { definePageMeta: 1 }; value.definePageMeta; function local(definePageMeta: () => void) { definePageMeta() }`,
    )
    expect(transformPageMeta(source, 'properties.vue').code).toContain(
      'value.definePageMeta',
    )
    expect(() =>
      transformPageMeta(sfc('{}', 'const leaked = definePageMeta'), 'leaked.vue'),
    ).toThrow('top-level statement')
  })
  it('extracts static data, removes aliased macros, preserves other imports and compiles through Vue', () => {
    const source = `<script setup lang="ts">\nimport { definePageMeta as page, type PageMeta } from 'vue-router-ns/file-routing'\nimport { ref } from 'nativescript-vue'\npage({ name: 'edit', layout: false, meta: { count: -2, nested: [true, null] } } satisfies PageMeta)\nconst draft = ref('kept')\n</script><template><Page><Label :text="draft" /></Page></template>`
    const result = transformPageMeta(source, 'edit.vue')
    expect(result.metadata).toEqual({
      name: 'edit',
      layout: false,
      meta: { count: -2, nested: [true, null] },
    })
    expect(result.code).not.toContain('definePageMeta')
    expect(result.code).toContain("ref('kept')")
    expect(result.map.sourcesContent).toEqual([source])
    expect(
      compileScript(parse(result.code).descriptor, { id: 'edit' }).content,
    ).toContain('draft')
  })
  it('does not execute setup code or imported modules when scanning', () => {
    expect(
      transformPageMeta(
        sfc('{ name: "safe" }', "throw new Error('must not execute')"),
        'safe.vue',
      ).metadata.name,
    ).toBe('safe')
  })
  it.each([
    ['{ name: getName() }', 'literal data'],
    ['{ name: importedName }', 'literal data'],
    ['{ ...options }', 'literal properties'],
    ['{ meta: { getter() {} } }', 'literal properties'],
    ['{ [key]: true }', 'literal properties'],
    ['{ name: "a", name: "b" }', 'Duplicate metadata'],
    ['{ meta: { __proto__: {} } }', 'Unsupported metadata property'],
    ['{ middleware: () => true }', 'literal data'],
    ['{ middleware: 123 }', 'middleware must'],
    ['{ layout: true }', 'layout must'],
    ['{ meta: { layout: "x" } }', 'top level'],
    ['{ unknown: true }', 'Unknown page metadata'],
    ['{ name: "" }', 'nonempty string'],
  ])('rejects unsupported metadata %s', (meta, error) => {
    expect(() => transformPageMeta(sfc(meta), 'bad.vue')).toThrow(error)
    expect(() => transformPageMeta(sfc(meta), 'bad.vue')).toThrow(/bad.vue:3:/)
  })
  it('rejects nested, duplicate, unimported and non-setup calls', () => {
    expect(() => transformPageMeta(sfc('{}', 'definePageMeta({})'), 'bad.vue')).toThrow(
      'Only one',
    )
    expect(() =>
      transformPageMeta(sfc('', 'if (true) definePageMeta({})'), 'bad.vue'),
    ).toThrow('top-level')
    expect(() =>
      transformPageMeta('<script setup>definePageMeta({})</script>', 'bad.vue'),
    ).toThrow('Import definePageMeta')
    expect(() =>
      transformPageMeta(sfc('{}').replace('script setup', 'script'), 'bad.vue'),
    ).toThrow('<script setup>')
    expect(() => definePageMeta({})).toThrow('build transform')
  })
})

describe('generated route updates', () => {
  it('does not reset another stack or its page while replacing the generated matcher records', async () => {
    let otherRouter: ReturnType<typeof useRouter>
    let otherHost: ReturnType<typeof useNativeHost<Frame>>
    const initial = [
      { name: 'index', path: '/', component: page('Home') },
      {
        name: 'secondary',
        path: '/secondary',
        component: page('Secondary', () => {
          otherRouter = useRouter()
          otherHost = useNativeHost<Frame>()
        }),
      },
    ] as const
    const { router, app } = await mount(initial, {
      render: () =>
        h('GridLayout', [
          h(RouterView),
          h(RouterView, { name: 'other', initial: '/secondary' }),
        ]),
    })
    await router.push('/secondary', { frame: 'other', props: { instance: 'second' } })
    const other = otherRouter!.stack.value
    const native = otherHost!.native!.currentPage
    const updater = createFileRouteUpdater(router, initial)
    updater.update([initial[0], { name: 'new', path: '/new', component: page('New') }])
    expect(otherRouter!.stack.value).toEqual(other)
    expect(otherHost!.native!.currentPage).toBe(native)
    await router.push('/new', { frame: 'other' })
    await router.back({ frame: 'other' })
    expect(otherRouter!.stack.value).toEqual(other)
    expect(otherHost!.native!.currentPage).toBe(native)
    app.unmount()
  })
  it.each(['ios', 'android'] as const)(
    'keeps retained entries, drafts and native history across route removal/rename (%s)',
    async (platform) => {
      let capture:
        | { route: ReturnType<typeof useRoute>; draft: ReturnType<typeof ref<string>> }
        | undefined
      const old = page('Old', () => {
        capture = { route: useRoute(), draft: ref('original') }
      })
      const initial = [
        { name: 'index', path: '/', component: page('Home') },
        { name: 'old', path: '/old', component: old },
      ] as const
      const { router, frame, app } = await mount(initial, { platform })
      const updater = createFileRouteUpdater(router, initial)
      await router.push('/old')
      capture!.draft.value = 'retained draft'
      const native = frame().currentPage,
        route = capture!.route
      updater.update([
        { ...initial[0] },
        { name: 'new', path: '/new', component: page('New') },
      ])
      expect(frame().currentPage).toBe(native)
      expect(capture!.route).toBe(route)
      expect(capture!.route.path).toBe('/old')
      expect(capture!.draft.value).toBe('retained draft')
      expect(router.hasRoute('old')).toBe(false)
      expect(() => router.resolve('/old')).toThrow('No route matches')
      await router.push('/new')
      await router.back()
      expect(frame().currentPage).toBe(native)
      expect(paths(router.stack.value)).toEqual(['/', '/old'])
      await router.back()
      expect(paths(router.stack.value)).toEqual(['/'])
      app.unmount()
    },
  )
  it('rejects explicit conflicts and externally edited ownership before mutating the matcher', async () => {
    const initial = [{ name: 'index', path: '/', component: page('Home') }] as const
    const explicit = [
      { name: 'manual', path: '/manual', component: page('Manual') },
    ] as const
    expect(() => mergeFileRoutes(initial, [{ ...explicit[0], path: '/' }])).toThrow(
      'Conflicting route pattern',
    )
    expect(() => mergeFileRoutes(initial, [{ ...explicit[0], name: 'index' }])).toThrow(
      'Duplicate route name',
    )
    const { router, app } = await mount(mergeFileRoutes(initial, explicit))
    const updater = createFileRouteUpdater(router, initial)
    const before = router.getRoutes()
    expect(() => updater.update([{ ...initial[0], path: '/manual' }])).toThrow(
      'conflicts with explicit',
    )
    expect(router.getRoutes()).toEqual(before)
    const remove = router.addRoute('index', {
      name: 'manual-child',
      path: '/child',
      component: page('Child'),
    })
    expect(() => updater.update(initial)).toThrow('externally added child')
    remove()
    router.addRoute({ ...initial[0], component: page('Replacement') })
    expect(() => updater.update(initial)).toThrow('changed through addRoute/removeRoute')
    expect(router.resolve('/manual').name).toBe('manual')
    app.unmount()
  })
})
