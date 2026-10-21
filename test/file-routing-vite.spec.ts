import { mkdtemp, mkdir, writeFile, readFile, rm, rename } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { transformSync } from 'esbuild'
import { build, createServer, type Plugin } from 'vite'
import { afterEach, expect, it, vi } from 'vitest'
import { nativeFileRoutes } from '../src/file-routing/vite.js'
import { prepareFileRouting } from '../src/file-routing/setup.js'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  )
})
const sfc = (name: string) =>
  `<script setup>definePageMeta({ name: '${name}' })</script><template><Page/></template>`
async function fixture() {
  const rootDir = await mkdtemp(join(tmpdir(), 'router-vite-'))
  directories.push(rootDir)
  const put = async (file: string, source: string) => {
    const path = join(rootDir, file)
    await mkdir(join(path, '..'), { recursive: true })
    await writeFile(path, source)
  }
  await put('src/pages/index.vue', sfc('home'))
  await put('src/pages/platform.android.vue', sfc('android'))
  await put('src/pages/platform.ios.vue', sfc('ios'))
  await put('src/middleware/auth.ts', 'export default () => false')
  await put('runtime.ts', 'export const createFileRouteUpdater = () => ({update() {}})')
  const options = {
    rootDir,
    platform: 'android' as const,
    autoImports: true,
    middlewareDir: 'src/middleware',
    bundler: 'vite' as const,
  }
  return { rootDir, put, options, output: join(rootDir, 'src/generated/router') }
}
// Unit builds compile SFCs to plain components; the native example uses the
// real @nativescript/vite/vue compiler on both platforms.
const components: Plugin = {
  name: 'fixture-components',
  transform(code, id) {
    if (id.endsWith('.vue')) {
      expect(code).not.toContain('definePageMeta(')
      return `export default {name: ${JSON.stringify(id)}}`
    }
  },
}

it('builds ESM integration with Vite, selected platform and no webpack runtime', async () => {
  const { rootDir, options, output } = await fixture()
  const built = await build({
    configFile: false,
    root: rootDir,
    logLevel: 'silent',
    plugins: [nativeFileRoutes(options), components],
    resolve: { alias: { 'vue-router-ns/file-routing': join(rootDir, 'runtime.ts') } },
    build: {
      write: false,
      minify: false,
      lib: {
        entry: join(output, 'index.android.ts'),
        formats: ['es'],
        fileName: 'routes',
      },
    },
  })
  const outputs = (Array.isArray(built) ? built : [built]).flatMap((result) =>
    'output' in result ? result.output : [],
  )
  const code = outputs
    .filter((output) => output.type === 'chunk')
    .map((chunk) => chunk.code)
    .join('\n')
  expect(code).toContain('"android"')
  expect(code).not.toContain('"ios"')
  expect(code).not.toMatch(
    /definePageMeta|module\.hot|\brequire\(|node:fs|@vue\/compiler-sfc/,
  )
  const registry = await readFile(join(output, 'registrations.android.ts'), 'utf8')
  expect(registry).toContain('import.meta.hot.accept(')
  expect(registry).not.toContain('require(')
})

it('updates installed routers on module reevaluation even when dependency callbacks are not dispatched', async () => {
  const { options, output, put } = await fixture()
  await prepareFileRouting(options)
  const callbacks = new Map<string, (module: any) => void>()
  const hot = {
    data: {} as Record<string, any>,
    dispose: vi.fn<(callback: () => void) => void>(),
    accept: (path: string, callback: (module: any) => void) =>
      callbacks.set(path, callback),
  }
  const table = evaluate(await readFile(join(output, 'routes.android.ts'), 'utf8'), {})
  const routes = table.routes
  const changes: unknown[][] = []
  const stop = vi.fn()
  function evaluate(source: string, dependencies: Record<string, unknown>) {
    const module = { exports: {} as Record<string, any> }
    const code = transformSync(source.replaceAll('import.meta.hot', 'globalThis.hot'), {
      loader: 'ts',
      format: 'cjs',
      target: 'es2022',
    }).code
    runInNewContext(code, {
      module,
      globalThis: { hot },
      require: (id: string) => {
        if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`)
        return { __esModule: true, ...(dependencies[id] as object) }
      },
    })
    return module.exports
  }
  const registry = evaluate(
    await readFile(join(output, 'registrations.android.ts'), 'utf8'),
    {
      '../../middleware/auth': { default: () => false },
    },
  )
  expect(registry.middleware[0].guard()).toBe(false)
  callbacks.get('../../middleware/auth')!({ default: () => '/login' })
  expect(registry.middleware[0].guard()).toBe('/login')
  callbacks.get('../../middleware/auth')!(undefined)
  expect(registry.middleware[0].guard()).toBe('/login')
  const entry = evaluate(await readFile(join(output, 'index.android.ts'), 'utf8'), {
    './routes.android': table,
    './registrations.android': registry,
    'vue-router-ns/file-routing': {
      createFileRouteUpdater: (router: unknown) => ({
        update: (next: unknown) => changes.push([router, next]),
      }),
    },
  })
  const a = { addRouteMiddleware: vi.fn(() => stop) },
    b = { addRouteMiddleware: vi.fn(() => stop) }
  const dispose = entry.installFileRouting(a)
  entry.installFileRouting(b)
  expect(() => entry.installFileRouting(a)).toThrow('already installed')
  await put('src/pages/next.vue', sfc('next'))
  await prepareFileRouting(options)
  const nextTable = evaluate(
    await readFile(join(output, 'routes.android.ts'), 'utf8'),
    {},
  )
  const next = nextTable.routes
  expect(entry.routes).toBe(next)
  expect(changes).toEqual([
    [a, next],
    [b, next],
  ])
  dispose()
  changes.length = 0
  await rm(join(options.rootDir, 'src/pages/next.vue'))
  await prepareFileRouting(options)
  const reverted = evaluate(await readFile(join(output, 'routes.android.ts'), 'utf8'), {})
  expect(changes).toEqual([[b, reverted.routes]])
  const stopUpdates = hot.dispose.mock.calls[0]![0]
  stopUpdates()
  changes.length = 0
  evaluate(await readFile(join(output, 'routes.android.ts'), 'utf8'), {})
  expect(changes).toEqual([])
  expect(stop).toHaveBeenCalledTimes(1)
})

it('regenerates with the real Vite watcher and recovers after invalid metadata', async () => {
  const { rootDir, put, options, output } = await fixture()
  const server = await createServer({
    configFile: false,
    root: rootDir,
    logLevel: 'silent',
    plugins: [nativeFileRoutes(options), components],
    resolve: { alias: { 'vue-router-ns/file-routing': join(rootDir, 'runtime.ts') } },
    server: {
      host: '127.0.0.1',
      port: 0,
      watch: { awaitWriteFinish: { stabilityThreshold: 30, pollInterval: 10 } },
    },
    optimizeDeps: { noDiscovery: true },
  })
  try {
    await server.listen()
    const messages: unknown[] = []
    const send = server.ws.send.bind(server.ws)
    vi.spyOn(server.ws, 'send').mockImplementation((...args: any[]) => {
      messages.push(args[0])
      return (send as any)(...args)
    })
    const index = await server.transformRequest('/src/generated/router/index.android.ts')
    expect(index!.code).toContain('subscribeFileRoutes(')
    await server.transformRequest('/src/generated/router/routes.android.ts')
    await server.transformRequest('/src/generated/router/registrations.android.ts')
    await server.transformRequest('/src/pages/index.vue')
    const table = () => readFile(join(output, 'routes.android.ts'), 'utf8')
    async function until(test: () => boolean | Promise<boolean>) {
      for (let i = 0; i < 200; i++) {
        if (await test()) return
        await new Promise((done) => setTimeout(done, 25))
      }
      throw new Error('Timed out waiting for Vite watcher')
    }
    await put('src/pages/added.vue', sfc('added'))
    await until(async () => (await table()).includes('"added"'))
    await until(() =>
      messages.some(
        (message: any) =>
          message.type === 'update' &&
          message.updates.some((update: any) =>
            update.acceptedPath.includes('routes.android'),
          ),
      ),
    )
    await server.transformRequest('/src/pages/added.vue')
    await put('src/pages/added.vue', sfc('edited'))
    await until(async () => (await table()).includes('"edited"'))
    await rename(
      join(rootDir, 'src/pages/added.vue'),
      join(rootDir, 'src/pages/renamed.vue'),
    )
    await until(
      async () =>
        (await table()).includes('"/renamed"') && !(await table()).includes('"/added"'),
    )
    const before = await table()
    await put('src/pages/invalid.vue', sfc('edited'))
    await until(() =>
      messages.some(
        (message: any) =>
          message.type === 'error' &&
          message.err.message.includes('Duplicate route name'),
      ),
    )
    expect(await table()).toBe(before)
    await server.transformRequest('/src/pages/invalid.vue').catch(() => {})
    await put('src/pages/invalid.vue', sfc('recovered'))
    await until(async () => (await table()).includes('"recovered"'))
    await rm(join(rootDir, 'src/pages/renamed.vue'))
    await until(async () => !(await table()).includes('"edited"'))
    expect((await prepareFileRouting(options)).changed).toEqual([])
  } finally {
    await server.close()
  }
}, 20000)
