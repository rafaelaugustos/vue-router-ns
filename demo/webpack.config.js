const { resolve } = require('path')
const webpack = require('@nativescript/webpack')

module.exports = (env) => {
  webpack.init(env)

  webpack.chainWebpack((config) => {
    // Separate opt-in acceptance fixtures; the normal demo keeps explicit routes.
    if (env.drawerTest && env.middlewareTest)
      throw new Error('Select only one native acceptance fixture')
    if (env.drawerTest || env.middlewareTest) {
      const entry = config.entry('bundle')
      const paths = entry.values()
      entry
        .clear()
        .merge(
          paths.map((path) =>
            path === resolve(__dirname, 'src/app.ts')
              ? resolve(
                  __dirname,
                  env.middlewareTest
                    ? 'src/testing/middleware-app.ts'
                    : 'src/testing/drawer-app.ts',
                )
              : path,
          ),
        )
    }
    config.resolve.alias
      // the router from this repository: run `npm run dev` at the root
      .set('vue-router-ns', resolve(__dirname, '../dist/index.js'))
      // sharing this app's copies of Vue and NativeScript
      .set('nativescript-vue', resolve(__dirname, 'node_modules/nativescript-vue'))
      .set('@nativescript/core', resolve(__dirname, 'node_modules/@nativescript/core'))
  })

  return webpack.resolveConfig()
}
