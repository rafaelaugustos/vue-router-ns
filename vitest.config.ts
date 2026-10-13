import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const shim = (name: string) =>
  fileURLToPath(new URL(`./test/shims/${name}.ts`, import.meta.url))

export default defineConfig({
  define: {
    __DEV__: 'true',
  },
  resolve: {
    alias: {
      'nativescript-vue': shim('nativescript-vue'),
      '@nativescript/core': shim('core'),
    },
  },
  test: {
    include: ['test/**/*.spec.ts'],
    typecheck: {
      enabled: true,
      include: ['test/**/*.test-d.ts'],
    },
  },
})
