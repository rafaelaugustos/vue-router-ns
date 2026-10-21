import {
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { FileRouteError, generateFileRoutes } from './generator.js'

export interface FileRoutingOptions {
  /** Investigation only; not a released API. */
  metadataFiles?: boolean
  platform: 'ios' | 'android'
  /** Generated HMR dialect. Defaults to webpack for existing integrations. */
  bundler?: 'webpack' | 'vite'
  /** Paths are relative to rootDir (the bundler root or current directory). */
  rootDir?: string
  pagesDir?: string
  outDir?: string
  exclude?: readonly string[]
  /** Discovery is opt-in; explicit router registration remains available. */
  layoutsDir?: string | false
  middlewareDir?: string | false
  /** Only definePageMeta in page script setup; runtime helpers use explicit imports. */
  autoImports?: boolean
}

export interface PreparedFileRouting {
  files: string[]
  changed: string[]
  pageFiles: string[]
  dependencies: string[]
  directories: string[]
  pagesDir: string
  outDir: string
}

/** Prepare types without launching a native build; both plugins use this function. */
export async function prepareFileRouting(
  options: FileRoutingOptions,
): Promise<PreparedFileRouting> {
  if (!['ios', 'android'].includes(options.platform))
    throw new Error('File routing requires platform: ios or android')
  if (options.bundler && !['webpack', 'vite'].includes(options.bundler))
    throw new Error('File routing requires bundler: webpack or vite')
  const vite = options.bundler === 'vite'
  const root = await realpath(resolve(options.rootDir ?? '.')),
    pagesDir = resolve(root, options.pagesDir ?? 'src/pages'),
    outDir = resolve(root, options.outDir ?? 'src/generated/router'),
    platform = options.platform
  const directories = [
    pagesDir,
    ...[options.layoutsDir, options.middlewareDir]
      .filter((p): p is string => typeof p === 'string')
      .map((p) => resolve(root, p)),
  ]
  for (const directory of directories) {
    if (outDir === directory || outDir.startsWith(directory + sep))
      throw new Error(
        'File-routing outDir must be outside pages/layouts/middleware directories',
      )
  }
  const routeFile = resolve(outDir, `routes.${platform}.ts`)
  const generated = await generateFileRoutes({ ...options, pagesDir, outFile: routeFile })
  const layouts = options.layoutsDir
    ? await discover(resolve(root, options.layoutsDir), 'vue', platform)
    : []
  const middleware = options.middlewareDir
    ? await discover(resolve(root, options.middlewareDir), 'ts', platform)
    : []
  const specifier = (file: string) => {
    let path = relative(outDir, file).split(sep).join('/')
    if (!path.startsWith('.')) path = './' + path
    return JSON.stringify(path.replace(/\.ts$/, ''))
  }
  const registrations = vite
    ? `// Generated native registrations. Adding/removing registrations requires an app restart.
import type { RouteComponent, RouteMiddleware } from 'vue-router-ns'
${middleware.map((m, i) => `import middleware${i} from ${specifier(m.file)}\nlet guard${i}: RouteMiddleware = middleware${i}`).join('\n')}
export const layouts = {
${layouts.map((l) => `${JSON.stringify(l.name)}: (): Promise<RouteComponent> => import(${specifier(l.file)}).then(m => m.default)`).join(',\n')}
}
export const middleware: readonly { name: string; guard: RouteMiddleware; global: boolean }[] = [
${middleware.map((m, i) => `{name: ${JSON.stringify(m.name)}, global: ${m.global}, guard: (...args) => guard${i}(...args)}`).join(',\n')}
]
if (import.meta.hot) {
${middleware.map((m, i) => `  import.meta.hot.accept(${specifier(m.file)}, (next) => { if (next) guard${i} = next.default })`).join('\n')}
}
`
    : `// Generated native registrations. Adding/removing registrations requires an app restart.
import type { RouteComponent, RouteMiddleware } from 'vue-router-ns'
${middleware.map((m, i) => `import type middleware${i} from ${specifier(m.file)}`).join('\n')}
export const layouts = {
${layouts.map((l) => `${JSON.stringify(l.name)}: (): Promise<RouteComponent> => import(${specifier(l.file)}).then(m => m.default)`).join(',\n')}
}
export const middleware: readonly { name: string; guard: RouteMiddleware; global: boolean }[] = [
${middleware.map((m, i) => `{name: ${JSON.stringify(m.name)}, global: ${m.global}, guard: (...args) => callMiddleware(require(${specifier(m.file)}).default as typeof middleware${i}, ...args)}`).join(',\n')}
]
function callMiddleware(guard: RouteMiddleware, ...args: Parameters<RouteMiddleware>) { return guard(...args) }
declare const require: (id: string) => { default: unknown }
declare const module: { hot?: { decline(): void; accept(dependencies: string[], callback: () => void): void } }
if (module.hot) {
  module.hot.decline()
  ${middleware.length ? `module.hot.accept([${middleware.map((m) => specifier(m.file)).join(',')}], () => {})` : ''}
}
`
  const entry = `// Generated native integration. Create the router once, then installFileRouting(router).
import type { Router } from 'vue-router-ns'
import { createFileRouteUpdater } from 'vue-router-ns/file-routing'
import { routes${vite ? ' as initialRoutes, subscribeFileRoutes' : ''} } from './routes.${platform}'
import { middleware } from './registrations.${platform}'
${vite ? 'export let routes = initialRoutes' : `export { routes } from './routes.${platform}'`}
export type { FileRouteMap, FileRouteName, FileRouteParams } from './routes.${platform}'
export { layouts } from './registrations.${platform}'
const updates = new Set<ReturnType<typeof createFileRouteUpdater>>()
const installed = new WeakSet<object>()
/** Call once after createRouter, before app.use/router startup. Dispose with the app/window. */
export function installFileRouting(router: Router<any>): () => void {
  if (installed.has(router)) throw new Error('File routing is already installed on this router')
  const updater = createFileRouteUpdater(router, routes)
  const stops: (() => void)[] = []
  try {
    for (const m of middleware) stops.push(router.addRouteMiddleware(m.name, m.guard, {global: m.global}))
  } catch (error) { stops.reverse().forEach(stop => stop()); throw error }
  installed.add(router)
  updates.add(updater)
  return () => { updates.delete(updater); installed.delete(router); stops.splice(0).reverse().forEach(stop => stop()) }
}
${
  vite
    ? `const stopRouteUpdates = subscribeFileRoutes((next) => {
  routes = next
  for (const updater of updates) updater.update(routes)
})
if (import.meta.hot) import.meta.hot.dispose(stopRouteUpdates)`
    : `declare const module: { hot?: { accept(dependency: string, callback: () => void): void } }
if (module.hot) module.hot.accept('./routes.${platform}', () => {
  for (const updater of updates) updater.update(routes)
})`
}
`
  const outputs = new Map([
    [
      routeFile,
      generated.code +
        (vite
          ? `
// Some native HMR hosts reevaluate modules without dispatching accept callbacks.
// Preserve subscribers in Vite's hot data and publish once per evaluation.
type RouteListener = (next: typeof routes) => void
const listeners: Set<RouteListener> = import.meta.hot
  ? (import.meta.hot.data.nativeFileRouteListeners ??= new Set<RouteListener>())
  : new Set<RouteListener>()
export function subscribeFileRoutes(listener: RouteListener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
if (import.meta.hot) {
  import.meta.hot.accept()
  for (const listener of listeners) listener(routes)
}
`
          : '\n// module.hot: the generated index accepts route-table updates.\n'),
    ],
    [resolve(outDir, `registrations.${platform}.ts`), registrations],
    [resolve(outDir, `index.${platform}.ts`), entry],
    // NativeScript resolves index.<platform>.ts; TypeScript follows the last prepared platform.
    [resolve(outDir, 'index.d.ts'), `export * from './index.${platform}'\n`],
    [
      resolve(outDir, 'auto-imports.d.ts'),
      options.autoImports
        ? `export {}\ndeclare global { const definePageMeta: typeof import('vue-router-ns/file-routing').definePageMeta }\n`
        : 'export {}\n',
    ],
  ])
  const changed: string[] = []
  for (const [file, code] of outputs)
    if (await writeChanged(file, code)) changed.push(file)
  return {
    files: [...outputs.keys()],
    changed,
    pageFiles: generated.files,
    dependencies: [
      ...generated.files,
      ...generated.metadataFiles,
      ...layouts.map((l) => l.file),
      ...middleware.map((m) => m.file),
    ],
    directories,
    pagesDir,
    outDir,
  }
}

interface Registration {
  name: string
  file: string
  global: boolean
}
async function discover(
  directory: string,
  extension: string,
  platform: string,
): Promise<Registration[]> {
  const groups = new Map<string, Map<string, string>>()
  async function visit(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true })
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for (const entry of entries) {
      if (/^[._]/.test(entry.name) || entry.name === 'node_modules') continue
      const file = resolve(dir, entry.name)
      if (entry.isSymbolicLink())
        throw new FileRouteError(file, 'Discovery does not follow symlinks')
      if (entry.isDirectory()) {
        await visit(file)
        continue
      }
      if (
        !entry.isFile() ||
        !entry.name.endsWith('.' + extension) ||
        entry.name.endsWith('.d.ts')
      )
        continue
      let id = relative(directory, file)
        .split(sep)
        .join('/')
        .slice(0, -extension.length - 1)
      const variant = id.match(/\.(ios|android)$/)?.[1]
      if (variant) id = id.slice(0, -variant.length - 1)
      const variants = groups.get(id) ?? new Map<string, string>()
      variants.set(variant ?? 'default', file)
      groups.set(id, variants)
    }
  }
  await visit(directory)
  const found = new Map<string, Registration>()
  for (let [id, variants] of groups) {
    const file = variants.get(platform) ?? variants.get('default')
    if (!file) continue
    const global = extension === 'ts' && id.endsWith('.global')
    if (global) id = id.slice(0, -7)
    if (!id.split('/').every((s) => /^[A-Za-z0-9_-]+$/.test(s)))
      throw new FileRouteError(
        file,
        'Discovered names allow letters, numbers, underscores and hyphens',
      )
    const name = id.replaceAll('/', '-')
    if (found.has(name))
      throw new FileRouteError(file, `Duplicate discovered name "${name}"`)
    found.set(name, { name, file, global })
  }
  return [...found.values()]
}

async function writeChanged(file: string, code: string): Promise<boolean> {
  try {
    if ((await readFile(file, 'utf8')) === code) return false
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, code)
    await rename(temporary, file)
  } finally {
    await rm(temporary, { force: true })
  }
  return true
}
