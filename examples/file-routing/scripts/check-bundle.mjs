import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const platform = process.argv[2]
assert(['android', 'ios'].includes(platform), 'Pass android or ios')
process.chdir(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const bundler = process.env.ROUTER_BUNDLER ?? 'webpack'
const output =
  bundler === 'vite'
    ? resolve('.ns-vite-build')
    : require('../webpack.config.js')({ [platform]: true, sourceMap: true }).output.path
const sources = new Set()
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      if (bundler !== 'vite' || !['android', 'ios'].includes(entry.name))
        await visit(path)
    } else if (/\.m?js\.map$/.test(entry.name) && !entry.name.includes('.hot-update.')) {
      const map = JSON.parse(await readFile(path, 'utf8'))
      for (const source of map.sources)
        sources.add(
          bundler === 'vite'
            ? resolve(dirname(path), map.sourceRoot ?? '', source)
            : source,
        )
    }
  }
}
await visit(output)
assert(sources.size > 0, 'Build with --env sourceMap before inspecting the bundle')
const forbidden = [...sources].filter(
  (source) =>
    /file-routing\/(setup|generator|metadata|webpack|vite|page-loader)\./.test(source) ||
    /node_modules\/(vue-router\/|nuxt\/|@nuxt\/|vue\/|@vue\/(compiler|runtime-dom))/.test(
      source,
    ) ||
    /(?:^|[ /])node:(fs|path|crypto)/.test(source),
)
assert.deepEqual(
  forbidden,
  [],
  'Build tooling or a web router/renderer entered the native bundle',
)
assert(
  [...sources].some((source) => source.includes('/file-routing/runtime.js')),
  'Missing native file-route updater',
)
for (const name of ['nativescript-vue', '@nativescript/core', '@vue/runtime-core']) {
  const roots = new Set(
    [...sources].flatMap((source) => {
      const marker = `/node_modules/${name}/`
      const index = source.lastIndexOf(marker)
      return index < 0 ? [] : [source.slice(0, index + marker.length)]
    }),
  )
  assert.equal(roots.size, 1, `Expected one ${name} instance: ${[...roots].join(', ')}`)
}
console.log(
  `${platform}: inspected ${sources.size} sources; one native renderer/Core, no build tooling or web router`,
)
