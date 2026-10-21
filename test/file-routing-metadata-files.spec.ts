import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { prepareFileRouting } from '../src/file-routing/setup.js'
import { parsePageMetadataJson } from '../src/file-routing/metadata.js'

const roots: string[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})
it('generates native metadata and tracks external input without altering the page', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'router-macro-free-')))
  roots.push(root)
  const pages = join(root, 'src/pages')
  await mkdir(pages, { recursive: true })
  const source = '<template><Label text="hello" /></template>'
  await writeFile(join(pages, 'index.vue'), source)
  const metadata = join(pages, 'index.route.json')
  await writeFile(
    metadata,
    JSON.stringify({ name: 'home', modal: true, meta: { title: 'Hello' } }),
  )
  const config = {
    rootDir: root,
    platform: 'android' as const,
    bundler: 'vite' as const,
    metadataFiles: true,
  }
  const first = await prepareFileRouting(config)
  expect(first.dependencies).toContain(metadata)
  const output = join(root, 'src/generated/router/routes.android.ts')
  const good = await readFile(output, 'utf8')
  expect(good).toContain('"modal": true')
  expect(good).toContain('name: "home"')
  expect(await readFile(join(pages, 'index.vue'), 'utf8')).toBe(source)
  await writeFile(metadata, '{ broken')
  await expect(prepareFileRouting(config)).rejects.toThrow('Invalid page metadata JSON')
  expect(await readFile(output, 'utf8')).toBe(good)
  await writeFile(metadata, JSON.stringify({ name: 'recovered' }))
  await prepareFileRouting(config)
  expect(await readFile(output, 'utf8')).toContain('name: "recovered"')
  await rm(metadata)
  await prepareFileRouting(config)
  expect(await readFile(output, 'utf8')).toContain('name: "index"')
})
it.each([
  '[]',
  '{"unknown":true}',
  '{"meta":{"__proto__":{}}}',
  '{"meta":{"value":1e400}}',
])('rejects invalid external metadata: %s', (source) => {
  expect(() => parsePageMetadataJson(source, 'page.route.json')).toThrow()
})
