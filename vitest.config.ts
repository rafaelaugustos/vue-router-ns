import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const shim = (name: string) =>
  fileURLToPath(new URL(`./test/shims/${name}.ts`, import.meta.url))

export default defineConfig({
  define: {
    __DEV__: 'true',
  },
  resolve: {
    alias: [
      // Copyable examples import the public entry even before the package is built.
      {
        find: /^vue-router-ns$/,
        replacement: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      },
      { find: 'nativescript-vue', replacement: shim('nativescript-vue') },
      { find: '@nativescript/core', replacement: shim('core') },
    ],
  },
  test: {
    include: ['test/**/*.spec.ts'],
    typecheck: {
      enabled: true,
      include: ['test/**/*.test-d.ts'],
    },
  },
})
