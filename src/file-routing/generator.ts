import { readdir, readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { watch } from 'node:fs'
import { compilePath, comparePatterns } from '../path.js'
import { FileRouteError, transformPageMeta, parsePageMetadataJson } from './metadata.js'
import type { PageMeta } from './index.js'

export { FileRouteError, transformPageMeta, parsePageMetadataJson } from './metadata.js'
export type { PageMetaTransform } from './metadata.js'

export interface FileRoutesOptions {
  /** Investigation only: read optional .route.json files beside pages. */
  metadataFiles?: boolean
  pagesDir: string
  outFile: string
  /** Required when the directory contains .ios.vue or .android.vue variants. */
  platform?: 'ios' | 'android'
  /** Relative files/directories to skip. Exact names/prefixes, not glob patterns. */
  exclude?: readonly string[]
  /** Opt into an unbound definePageMeta macro in page <script setup>. */
  autoImports?: boolean
}

export interface FilePage {
  /** Stable logical filename, without platform/extension; not a saved-entry key. */
  id: string
  file: string
  name: string
  path: string
  metadata: PageMeta
  children: FilePage[]
}

export interface GeneratedFileRoutes {
  metadataFiles: string[]
  code: string
  pages: FilePage[]
  /** Every considered SFC, including unselected platform variants. */
  files: string[]
  /** Builders should watch this directory for creation, removal and rename. */
  pagesDir: string
  outFile: string
}

/** Deterministic, side-effect-free generation. Call again for each filesystem change. */
export async function generateFileRoutes(
  options: FileRoutesOptions,
): Promise<GeneratedFileRoutes> {
  const pagesDir = resolve(options.pagesDir),
    outFile = resolve(options.outFile)
  if (!/\.ts$/.test(outFile) || /\.d\.ts$/.test(outFile))
    throw new FileRouteError(outFile, 'outFile must be a TypeScript module (.ts)')
  const exclusions = (options.exclude ?? []).map((p) => {
    if (
      p.startsWith('/') ||
      p.includes('\\') ||
      p.split('/').includes('..') ||
      /[*?]/.test(p)
    )
      throw new FileRouteError(
        p,
        'exclude entries must be exact relative files or directory prefixes',
      )
    return p.replace(/\/$/, '')
  })
  const files: string[] = []
  async function scan(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true })
    entries.sort((a, b) => compare(a.name, b.name))
    for (const entry of entries) {
      if (
        entry.name.startsWith('.') ||
        entry.name.startsWith('_') ||
        entry.name === 'node_modules'
      )
        continue
      const file = resolve(dir, entry.name),
        key = posix(relative(pagesDir, file))
      if (exclusions.some((p) => key === p || key.startsWith(`${p}/`))) continue
      if (entry.isSymbolicLink())
        throw new FileRouteError(
          file,
          'Symlinks inside pagesDir are unsupported; exclude this entry',
        )
      if (entry.isDirectory()) await scan(file)
      else if (entry.isFile() && entry.name.endsWith('.vue')) files.push(file)
    }
  }
  await scan(pagesDir)
  const groups = new Map<string, Map<string, string>>()
  for (const file of files) {
    const key = posix(relative(pagesDir, file)).slice(0, -4)
    const variant = key.match(/\.(ios|android)$/)?.[1]
    if (variant && !options.platform)
      throw new FileRouteError(
        file,
        'Set platform to ios or android when using platform-specific pages',
      )
    const id = variant ? key.slice(0, -variant.length - 1) : key
    const variants = groups.get(id) ?? new Map<string, string>()
    variants.set(variant ?? 'default', file)
    groups.set(id, variants)
  }
  const metadataFiles: string[] = []
  const byId = new Map<string, FilePage>()
  for (const [id, variants] of groups) {
    const file = variants.get(options.platform ?? 'default') ?? variants.get('default')
    if (!file) continue // A platform-only destination is absent from the other build.
    let metadata = transformPageMeta(await readFile(file, 'utf8'), file, options).metadata
    if (options.metadataFiles) {
      const metadataFile = file.replace(/\.vue$/, '.route.json')
      try {
        const external = parsePageMetadataJson(
          await readFile(metadataFile, 'utf8'),
          metadataFile,
        )
        if (Object.keys(metadata).length)
          throw new FileRouteError(
            metadataFile,
            'Use either the macro or external metadata for this experiment',
          )
        metadata = external
        metadataFiles.push(metadataFile)
      } catch (error) {
        if ((error as { code?: string }).code !== 'ENOENT') throw error
      }
    }
    const segments = id.split('/')
    segments.forEach((s) => segment(s, file))
    const name =
      metadata.name ??
      segments.map((s) => s.replace(/[\[\]]/g, '').replace(/^\.\.\./, '')).join('-')
    byId.set(id, { id, file, name, path: '', metadata, children: [] })
  }
  const roots: FilePage[] = []
  // Parents always have fewer segments. An index file never acts as a parent.
  const ordered = [...byId.values()].sort(
    (a, b) => a.id.split('/').length - b.id.split('/').length || compare(a.id, b.id),
  )
  const parents = new Map<FilePage, FilePage>()
  for (const page of ordered) {
    const segments = page.id.split('/')
    let parent: FilePage | undefined
    for (let i = segments.length - 1; i > 0; i--) {
      const candidate = byId.get(segments.slice(0, i).join('/'))
      if (candidate && !candidate.id.endsWith('/index') && candidate.id !== 'index') {
        parent = candidate
        break
      }
    }
    const suffix = segments.slice(parent ? parent.id.split('/').length : 0)
    if (suffix.at(-1) === 'index') suffix.pop()
    const path =
      `${parent?.path.replace(/\/$/, '') ?? ''}/${suffix.map((s) => segment(s, page.file)).join('/')}`.replace(
        /\/$/,
        '',
      ) || '/'
    page.path = page.metadata.path ?? path
    validatePath(page)
    if (parent) {
      const childKeys = compilePath(page.path).keys
      for (const key of compilePath(parent.path).keys) {
        if (
          !childKeys.some(
            (k) =>
              k.name === key.name &&
              k.repeatable === key.repeatable &&
              (key.optional || !k.optional),
          )
        )
          throw new FileRouteError(
            page.file,
            `Child path must preserve parent parameter "${key.name}" for withParents`,
          )
      }
      parent.children.push(page)
      parents.set(page, parent)
    } else roots.push(page)
  }
  const names = new Map<string, FilePage>(),
    paths = new Map<string, FilePage>()
  for (const page of ordered) {
    const named = names.get(page.name)
    if (named)
      throw new FileRouteError(
        page.file,
        `Duplicate route name "${page.name}" from ${named.file}; use a unique name in definePageMeta`,
      )
    names.set(page.name, page)
    const signature = page.path
      .replace(/:\w+/g, ':param')
      .replace(/\/$/, '')
      .toLowerCase()
    const prior = paths.get(signature)
    if (
      prior &&
      !(
        parents.get(page) === prior &&
        page.id.endsWith('/index') &&
        page.path === prior.path
      )
    )
      throw new FileRouteError(
        page.file,
        `Conflicting route pattern "${page.path}" from ${prior.file}`,
      )
    paths.set(signature, page)
  }
  const sort = (pages: FilePage[]) => {
    pages.sort(
      (a, b) =>
        comparePatterns(compilePath(a.path), compilePath(b.path)) || compare(a.id, b.id),
    )
    pages.forEach((p) => sort(p.children))
  }
  sort(roots)
  const constants: string[] = []
  let index = 0
  const emit = (page: FilePage): string => {
    const n = index++,
      { name: _name, path: _path, layout, middleware, meta, ...rest } = page.metadata
    const options = {
      ...rest,
      ...(meta || layout !== undefined || middleware !== undefined
        ? {
            meta: {
              ...meta,
              ...(layout !== undefined ? { layout } : {}),
              ...(middleware !== undefined ? { middleware } : {}),
            },
          }
        : {}),
    }
    constants.push(
      `const options${n} = ${JSON.stringify(options, null, 2)} satisfies Omit<RouteRecordRaw, 'path' | 'name' | 'component' | 'children'>`,
    )
    let component = posix(relative(dirname(outFile), page.file))
    if (!component.startsWith('.')) component = `./${component}`
    return `{ ...options${n}, path: ${JSON.stringify(page.path)}, name: ${JSON.stringify(page.name)}, component: (): Promise<RouteComponent> => import(${JSON.stringify(component)}).then(m => m.default)${page.children.length ? `, children: [${page.children.map(emit).join(',\n')}]` : ''} }`
  }
  const records = roots.map(emit).join(',\n')
  const code = `// Generated by vue-router-ns/file-routing/generator. Do not edit.\nimport type { RouteRecordRaw, RouteComponent, RouteMapFrom } from 'vue-router-ns'\n\n${constants.join('\n\n')}\n\nexport const routes = [\n${records}\n] as const satisfies readonly RouteRecordRaw[]\n\nexport type FileRouteMap = RouteMapFrom<typeof routes>\nexport type FileRouteName = keyof FileRouteMap\nexport type FileRouteParams<N extends FileRouteName> = FileRouteMap[N]['params']\n`
  return { code, pages: roots, files, metadataFiles, pagesDir, outFile }
}

/** Write only on a successful changed generation; a failed edit keeps the last valid module. */
export async function writeFileRoutes(
  options: FileRoutesOptions,
): Promise<GeneratedFileRoutes & { changed: boolean }> {
  const result = await generateFileRoutes(options)
  let previous: string | undefined
  try {
    previous = await readFile(result.outFile, 'utf8')
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') throw error
  }
  if (previous === result.code) return { ...result, changed: false }
  await mkdir(dirname(result.outFile), { recursive: true })
  const temp = `${result.outFile}.${randomUUID()}.tmp`
  try {
    await writeFile(temp, result.code)
    await rename(temp, result.outFile)
  } finally {
    await rm(temp, { force: true })
  }
  return { ...result, changed: true }
}

/** Low-level Node watcher. Build-plugin/HMR installation remains the builder's responsibility. */
export async function watchFileRoutes(
  options: FileRoutesOptions,
  callbacks: {
    onGenerated(result: GeneratedFileRoutes): void | Promise<void>
    onError(error: unknown): void
  },
): Promise<{ close(): Promise<void> }> {
  let closed = false,
    dirty = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: Promise<void> = Promise.resolve()
  const run = async () => {
    while (dirty && !closed) {
      dirty = false
      try {
        const result = await writeFileRoutes(options)
        if (!closed && result.changed) await callbacks.onGenerated(result)
      } catch (error) {
        if (!closed) callbacks.onError(error)
      }
    }
  }
  const watcher = watch(
    resolve(options.pagesDir),
    { recursive: true },
    (_event, filename) => {
      // Output modules can live in pagesDir; only SFC/directory events matter.
      if (filename && /\.(?:ts|tmp)$/.test(filename)) return
      dirty = true
      clearTimeout(timer)
      timer = setTimeout(() => {
        pending = pending.then(run)
      }, 30)
    },
  )
  watcher.on('error', (error) => callbacks.onError(error))
  pending = (async () => {
    const initial = await writeFileRoutes(options)
    await callbacks.onGenerated(initial)
  })()
  try {
    await pending
  } catch (error) {
    closed = true
    clearTimeout(timer)
    watcher.close()
    throw error
  }
  return {
    async close() {
      closed = true
      clearTimeout(timer)
      watcher.close()
      await pending
    },
  }
}

function segment(part: string, file: string): string {
  let match
  if ((match = /^\[\[\.\.\.(\w+)\]\]$/.exec(part))) return `:${match[1]}*`
  if ((match = /^\[\.\.\.(\w+)\]$/.exec(part))) return `:${match[1]}+`
  if ((match = /^\[\[(\w+)\]\]$/.exec(part))) return `:${match[1]}?`
  if ((match = /^\[(\w+)\]$/.exec(part))) return `:${match[1]}`
  if (/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(part)) return part
  throw new FileRouteError(
    file,
    `Unsupported page segment "${part}". Use static names, [id], [[id]], [...path] or [[...path]]; mixed segments and route groups are unsupported`,
  )
}
function validatePath(page: FilePage) {
  if (
    !page.path.startsWith('/') ||
    page.path.includes('//') ||
    page.path.includes('#') ||
    page.path.includes('\\') ||
    (page.path.endsWith('/') && page.path !== '/')
  )
    throw new FileRouteError(
      page.file,
      'path must be an absolute route pattern without query, hash or trailing slash',
    )
  // Keep generated type inference and matching aligned; arbitrary custom regex is an explicit-route feature.
  for (const part of page.path.slice(1).split('/'))
    if (part && !/^(?:[a-zA-Z0-9][a-zA-Z0-9_-]*|:\w+[?+*]?)$/.test(part))
      throw new FileRouteError(
        page.file,
        `Unsupported generated path segment "${part}"; use complete static/parameter segments`,
      )
  const keys = compilePath(page.path).keys
  if (new Set(keys.map((k) => k.name)).size !== keys.length)
    throw new FileRouteError(page.file, 'Repeated parameter names are unsupported')
  if (
    page.path
      .slice(1)
      .split('/')
      .slice(0, -1)
      .some((part) => /[+*]$/.test(part))
  )
    throw new FileRouteError(page.file, 'A catch-all parameter must be the last segment')
}
function posix(path: string) {
  return path.split(sep).join('/')
}
function compare(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}
