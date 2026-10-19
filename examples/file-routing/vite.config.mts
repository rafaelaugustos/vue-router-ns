import { createRequire } from 'node:module'
import { defineConfig, mergeConfig } from 'vite'
import { getCliFlags } from '@nativescript/vite'
import { vueConfig } from '@nativescript/vite/vue'
import { nativeFileRoutes } from 'vue-router-ns/file-routing/vite'
import options from './file-routing.config.js'

const require = createRequire(import.meta.url)

export default defineConfig(({ mode }) => {
  const flags = {
    ...getCliFlags(),
    ...JSON.parse(process.env.NATIVESCRIPT_BUNDLER_ENV ?? '{}'),
  }
  if (!flags.android && !flags.ios) throw new Error('Pass -- --env.android or --env.ios')
  return mergeConfig(vueConfig({ mode }, { typeCheck: 'error' }), {
    plugins: [nativeFileRoutes(options(flags.android ? 'android' : 'ios'))],
    define: {
      __FILE_ROUTING_TEST__: !!flags.conventionsTest,
      __FILE_ROUTING_WATCH__: !!flags.conventionsWatch,
      __FILE_ROUTING_RUN__: JSON.stringify(String(flags.conventionsRun ?? 'manual')),
    },
    resolve: {
      // Keep all app imports on the same native peer instances.
      dedupe: ['nativescript-vue', '@nativescript/core'],
      alias: [
        { find: /^vue$/, replacement: require.resolve('nativescript-vue') },
        { find: /^nativescript-vue$/, replacement: require.resolve('nativescript-vue') },
        {
          find: /^@nativescript\/core$/,
          replacement: require.resolve('@nativescript/core'),
        },
      ],
    },
  })
})
