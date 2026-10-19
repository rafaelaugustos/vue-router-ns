const { resolve } = require('node:path')
const webpack = require('@nativescript/webpack')
const { NativeFileRoutesPlugin } = require('vue-router-ns/file-routing/webpack')
const options = require('./file-routing.config')

module.exports = (env) => {
  webpack.init(env)
  webpack.chainWebpack((config) => {
    config
      .plugin('native-file-routes')
      .use(NativeFileRoutesPlugin, [options(env.android ? 'android' : 'ios')])
    config.plugin('DefinePlugin').tap((args) => {
      Object.assign(args[0], {
        __FILE_ROUTING_TEST__: !!env.conventionsTest,
        __FILE_ROUTING_WATCH__: !!env.conventionsWatch,
        __FILE_ROUTING_RUN__: JSON.stringify(String(env.conventionsRun ?? 'manual')),
      })
      return args
    })
    // The repository dependency is a symlink. Use this application's native peers.
    config.resolve.alias
      .set('nativescript-vue', resolve(__dirname, 'node_modules/nativescript-vue'))
      .set('@nativescript/core', resolve(__dirname, 'node_modules/@nativescript/core'))
  })
  return webpack.resolveConfig()
}
