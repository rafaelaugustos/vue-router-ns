import type { NativeScriptConfig } from '@nativescript/core'
export default {
  id: 'org.nativescript.routerfiles',
  appPath: 'src',
  appResourcesPath: 'App_Resources',
  bundler: process.env.ROUTER_BUNDLER === 'vite' ? 'vite' : 'webpack',
  bundlerConfigPath:
    process.env.ROUTER_BUNDLER === 'vite' ? 'vite.config.mts' : 'webpack.config.js',
} satisfies NativeScriptConfig
