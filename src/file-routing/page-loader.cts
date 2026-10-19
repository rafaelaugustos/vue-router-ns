import type { LoaderContext } from 'webpack'

function loader(this: LoaderContext<{ autoImports?: boolean }>, source: string) {
  // Script/template subrequests read the SFC again. Transform them too, before
  // vue-loader selects the block, or its script request can execute the macro.
  const done = this.async()
  import('./metadata.js').then(({ transformPageMeta }) => {
    try {
      const result = transformPageMeta(source, this.resourcePath, this.getOptions())
      done(null, result.code, JSON.stringify(result.map))
    } catch (error) {
      done(error as Error)
    }
  }, done)
}
export = loader
