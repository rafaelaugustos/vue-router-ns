const { resolve } = require('path')
const webpack = require('@nativescript/webpack')

module.exports = (env) => {
  webpack.init(env)

  webpack.chainWebpack((config) => {
    config.plugin('DefinePlugin').tap((args) => {
      args[0].__ROUTER_STARTUP_TRACE__ = JSON.stringify(!!env.startupTrace)
      args[0].__CONTRACT_FAULT__ = JSON.stringify(!!env.contractFault)
      return args
    })
    // Separate opt-in acceptance fixtures; the normal demo keeps explicit routes.
    const fixtures = [
      'drawer',
      'middleware',
      'layouts',
      'files',
      'state',
      'folds',
      'flows',
      'contracts',
    ].filter((name) => env[`${name}Test`])
    if (fixtures.length > 1) throw new Error('Select only one native acceptance fixture')
    if (fixtures.length) {
      const entry = config.entry('bundle')
      const paths = entry.values()
      entry
        .clear()
        .merge(
          paths.map((path) =>
            path === resolve(__dirname, 'src/app.ts')
              ? resolve(__dirname, `src/testing/${fixtures[0]}-app.ts`)
              : path,
          ),
        )
    }
    if (env.filesTest) {
      require('child_process').execFileSync(
        process.execPath,
        [
          resolve(__dirname, '../scripts/native/prepare-files.mjs'),
          env.android ? 'android' : 'ios',
        ],
        { cwd: resolve(__dirname, '..'), stdio: 'inherit' },
      )
      config.module
        .rule('page-meta')
        .test(/\.vue$/)
        .enforce('pre')
        .use('page-meta')
        .loader(resolve(__dirname, '../scripts/native/page-meta-loader.cjs'))
    }
    if (env.contractFault) {
      if (!env.contractsTest) throw new Error('contractFault requires contractsTest')
      config.module
        .rule('covered-hmr-regression')
        .include.add(resolve(__dirname, '../dist/page.js'))
        .end()
        .use('covered-hmr-regression')
        .loader(resolve(__dirname, '../scripts/native/contracts/hmr-regression.cjs'))
    }
    config.resolve.alias
      // the router from this repository: run `npm run dev` at the root
      .set('vue-router-ns$', resolve(__dirname, '../dist/index.js'))
      .set(
        'vue-router-ns/file-routing$',
        resolve(__dirname, '../dist/file-routing/index.js'),
      )
      // sharing this app's copies of Vue and NativeScript
      .set('nativescript-vue', resolve(__dirname, 'node_modules/nativescript-vue'))
      .set('@nativescript/core', resolve(__dirname, 'node_modules/@nativescript/core'))
  })

  return webpack.resolveConfig()
}
