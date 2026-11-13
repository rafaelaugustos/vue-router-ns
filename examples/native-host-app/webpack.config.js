const webpack = require('@nativescript/webpack')
module.exports = (env) => {
  webpack.init(env)
  // Both packages are installed tarballs. No repository-source aliases.
  return webpack.resolveConfig()
}
