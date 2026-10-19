// Acceptance snapshots from real add/edit/rename/remove operations. Not an installation plugin.
import { cp, mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { writeFileRoutes } from '../../dist/file-routing/generator.js'

const source = resolve('demo/src/testing/file-pages')
const output = resolve('demo/src/testing/file-generated')
const platform = process.argv[2]
if (!['ios', 'android'].includes(platform)) throw new Error('Pass ios or android')
await mkdir(output, { recursive: true })
let previous = source
for (const phase of ['initial', 'added', 'renamed', 'removed']) {
  const pagesDir = resolve(output, phase)
  await rm(pagesDir, { recursive: true, force: true })
  await cp(previous, pagesDir, { recursive: true })
  if (phase === 'added') {
    await writeFile(
      resolve(pagesDir, 'added.vue'),
      await readFile(resolve(source, 'index.vue'), 'utf8'),
    )
    const product = resolve(pagesDir, 'products/[id].vue')
    await writeFile(
      product,
      (await readFile(product, 'utf8')).replace('revision: 1', 'revision: 2'),
    )
  }
  if (phase === 'renamed')
    await rename(resolve(pagesDir, 'added.vue'), resolve(pagesDir, 'renamed.vue'))
  if (phase === 'removed') await rm(resolve(pagesDir, 'products/[id].vue'))
  await writeFileRoutes({
    pagesDir,
    outFile: resolve(output, `${phase}.${platform}.ts`),
    platform,
  })
  await writeFile(
    resolve(output, `${phase}.d.ts`),
    `export * from './${phase}.${platform}.js'\n`,
  )
  previous = pagesDir
}
console.log(`Generated ${platform} native file-route acceptance snapshots`)
