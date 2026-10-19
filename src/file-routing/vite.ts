import { resolve, sep } from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import { transformPageMeta } from './metadata.js'
import {
  prepareFileRouting,
  type FileRoutingOptions,
  type PreparedFileRouting,
} from './setup.js'

export type NativeFileRoutesOptions = Omit<FileRoutingOptions, 'bundler'>

/** Optional build plugin for @nativescript/vite/vue. Never import it in the app. */
export function nativeFileRoutes(options: NativeFileRoutesOptions): Plugin {
  let prepared: PreparedFileRouting | undefined
  let config: FileRoutingOptions
  let server: ViteDevServer | undefined
  let failure: Error | undefined
  let pending = Promise.resolve()
  let directories: string[] = []
  const inside = (file: string) =>
    directories.some((dir) => file === dir || file.startsWith(dir + sep))
  // Serialize watcher callbacks: atomic renames can arrive while another build
  // is still reading pages. A failed generation leaves the last good files intact.
  const generate = () => {
    const run = async () => {
      try {
        prepared = await prepareFileRouting(config)
        failure = undefined
        server?.watcher.add([...directories, ...prepared.dependencies])
      } catch (error) {
        failure = error instanceof Error ? error : new Error(String(error))
        throw failure
      }
    }
    const result = pending.then(run, run)
    pending = result.catch(() => {})
    return result
  }
  return {
    name: 'native-file-routes',
    enforce: 'pre',
    config() {
      // Keep NativeScript's dependency transformer on the package's native ESM
      // exports; browser prebundles can hide its native peer dependencies.
      return {
        optimizeDeps: { exclude: ['vue-router-ns', 'vue-router-ns/file-routing'] },
      }
    },
    async configResolved(resolved) {
      config = {
        ...options,
        bundler: 'vite',
        rootDir: resolve(options.rootDir ?? resolved.root),
      }
      directories = [
        options.pagesDir ?? 'src/pages',
        options.layoutsDir,
        options.middlewareDir,
      ]
        .filter((dir): dir is string => typeof dir === 'string')
        .map((dir) => resolve(config.rootDir!, dir))
      await generate()
    },
    async buildStart() {
      await generate()
      for (const file of [...directories, ...prepared!.dependencies])
        this.addWatchFile(file)
    },
    async watchChange(file) {
      if (!server && inside(file)) await generate()
    },
    configureServer(devServer) {
      server = devServer
      server.watcher.add(directories)
      const structural = (file: string) => {
        if (!inside(file)) return
        void generate().catch((error: Error) => {
          server!.config.logger.error(error.message)
          server!.ws.send({
            type: 'error',
            err: { message: error.message, stack: error.stack ?? '' },
          })
        })
      }
      server.watcher.on('add', structural).on('unlink', structural)
      server.httpServer?.once('close', () => {
        devServer.watcher.off('add', structural).off('unlink', structural)
      })
    },
    async handleHotUpdate(context) {
      if (!inside(context.file)) return
      await generate()
      // Vue's HMR parser reads the SFC independently of transform(). Supply the
      // same macro-free source so metadata-only changes do not reload the Page.
      if (prepared!.pageFiles.includes(context.file)) {
        const read = context.read
        context.read = async () =>
          transformPageMeta(await read(), context.file, options).code
      }
    },
    async transform(source, id) {
      const file = id.split('?')[0]!
      if (failure && prepared?.files.includes(file)) throw failure
      // Vue script/template subrequests are already compiled by plugin-vue.
      if (id.includes('?') || !prepared?.pageFiles.includes(file)) return
      const result = transformPageMeta(source, file, options)
      return { code: result.code, map: result.map }
    },
  }
}
