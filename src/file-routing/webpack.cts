import type { Compiler } from 'webpack'
import type { FileRoutingOptions, PreparedFileRouting } from './setup.js'

class NativeFileRoutesPlugin {
  constructor(readonly options: FileRoutingOptions) {}

  apply(compiler: Compiler) {
    if (compiler.webpack?.version?.split('.')[0] !== '5')
      throw new Error('NativeFileRoutesPlugin requires webpack 5')
    const { resolve } = require('node:path') as typeof import('node:path')
    const { existsSync, realpathSync } = require('node:fs') as typeof import('node:fs')
    const options = {
      ...this.options,
      rootDir: realpathSync(this.options.rootDir ?? compiler.context),
    }
    const pagesDir = resolve(options.rootDir, options.pagesDir ?? 'src/pages')
    let prepared: PreparedFileRouting | undefined
    let failure: Error | undefined
    const name = 'NativeFileRoutesPlugin'
    const directories = [
      pagesDir,
      ...[options.layoutsDir, options.middlewareDir]
        .filter((p): p is string => typeof p === 'string')
        .map((p) => resolve(options.rootDir, p)),
    ]

    compiler.options.module.rules.unshift({
      test: /\.vue$/,
      // Do not impose page-script restrictions on excluded/hidden components
      // that an actual route may import from inside its directory.
      include: (file: string) => prepared?.pageFiles.includes(file) ?? false,
      enforce: 'pre',
      use: [
        {
          loader: resolve(__dirname, 'page-loader.cjs'),
          options: { autoImports: !!options.autoImports },
        },
      ],
    })
    const generate = async () => {
      try {
        const { prepareFileRouting } = await import('./setup.js')
        prepared = await prepareFileRouting(options)
        failure = undefined
        for (const file of prepared.changed) {
          compiler.inputFileSystem?.purge?.(file)
          compiler.modifiedFiles = new Set([...(compiler.modifiedFiles ?? []), file])
          compiler.fileTimestamps?.delete(file)
        }
      } catch (error) {
        failure = error instanceof Error ? error : new Error(String(error))
      }
    }
    compiler.hooks.beforeRun.tapPromise(name, generate)
    compiler.hooks.watchRun.tapPromise(name, generate)
    compiler.hooks.thisCompilation.tap(name, (compilation) => {
      for (const directory of directories) {
        if (existsSync(directory)) compilation.contextDependencies.add(directory)
        else compilation.missingDependencies.add(directory)
      }
      for (const file of prepared?.dependencies ?? [])
        compilation.fileDependencies.add(file)
      if (failure)
        compilation.errors.push(new compiler.webpack.WebpackError(failure.message))
      // A failed generation emits nothing. Keep the previous HMR hash as well,
      // so the next valid build can update the modules actually on the device.
      compilation.hooks.shouldRecord.tap(name, () => (failure ? false : undefined))
      // Regenerated modules must not reuse a snapshot from before watchRun.
      compiler.webpack.NormalModule.getCompilationHooks(compilation).needBuild.tapAsync(
        name,
        (module, _context, done) => {
          const resource = module.resource
          done(null, resource && prepared?.files.includes(resource) ? true : undefined)
        },
      )
    })
    compiler.hooks.shouldEmit.tap(name, () => (failure ? false : undefined))
  }
}

export = { NativeFileRoutesPlugin }
