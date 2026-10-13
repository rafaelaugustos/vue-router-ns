const { resolve } = require('path')
const webpack = require('@nativescript/webpack')

module.exports = (env) => {
  webpack.init(env)

  webpack.chainWebpack((config) => {
    config.resolve.alias
      // the router from this repository: run `npm run dev` at the root
      .set('vue-router-ns', resolve(__dirname, '../dist/index.js'))
      // sharing this app's copies of Vue and NativeScript
      .set('nativescript-vue', resolve(__dirname, 'node_modules/nativescript-vue'))
      .set('@nativescript/core', resolve(__dirname, 'node_modules/@nativescript/core'))
  })

  return webpack.resolveConfig()
}
