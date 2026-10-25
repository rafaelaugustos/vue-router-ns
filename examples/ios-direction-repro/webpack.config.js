const { resolve } = require('path')
const webpack = require('@nativescript/webpack')
module.exports = (env) => {
  webpack.init(env)
  if (env.router || env.vue)
    webpack.chainWebpack((config) => {
      const entry = config.entry('bundle')
      entry.values().forEach((path) => {
        if (path === resolve(__dirname, 'src/app.js'))
          entry
            .delete(path)
            .add(resolve(__dirname, env.vue ? 'src/vue.js' : 'src/router.js'))
      })
    })
  return webpack.resolveConfig()
}
