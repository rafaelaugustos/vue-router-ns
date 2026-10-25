// Check structural parity without requiring translated prose to match English.
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { createMarkdownRenderer } from 'vitepress'
import { transform } from 'esbuild'

const root = resolve(import.meta.dirname, '../docs')
const guides = (await readdir(resolve(root, 'guide')))
  .filter((p) => p.endsWith('.md'))
  .sort()
const md = await createMarkdownRenderer(root)
const pages = new Map()
for (const locale of ['', 'pt-BR/', 'es/', 'zh-CN/']) {
  const actual = (await readdir(resolve(root, locale, 'guide')))
    .filter((p) => p.endsWith('.md'))
    .sort()
  assert.deepEqual(actual, guides, `${locale}: guide coverage differs from English`)
  for (const file of ['index.md', ...guides.map((p) => `guide/${p}`)]) {
    const path = resolve(root, locale, file)
    const source = await readFile(path, 'utf8')
    assert(
      !/ZXQ\d+QXZ|\[\]\(/.test(source),
      `${path}: unfinished translation or empty link`,
    )
    const snippets = [...source.matchAll(/^<<<\s+(\S+)/gm)].map((m) =>
      resolve(dirname(path), m[1]),
    )
    for (const snippet of snippets) await readFile(snippet)
    if (locale === 'es/' || locale === 'zh-CN/') {
      const originalPath = resolve(root, file)
      const originalSource = await readFile(originalPath, 'utf8')
      const originalSnippets = [...originalSource.matchAll(/^<<<\s+(\S+)/gm)].map((m) =>
        resolve(dirname(originalPath), m[1]),
      )
      assert.deepEqual(snippets, originalSnippets, `${path}: imported examples differ`)
    }
    const tokens = md.parse(source, { path, relativePath: locale + file })
    const ids = new Set(
      tokens.filter((t) => t.type === 'heading_open').map((t) => t.attrGet('id')),
    )
    for (const match of source.matchAll(/\bid=["']([^"']+)["']/g)) ids.add(match[1])
    const links = tokens.flatMap((t) =>
      (t.children ?? [])
        .filter((c) => c.type === 'link_open')
        .map((c) => c.attrGet('href')),
    )
    pages.set(path, { source, tokens, ids, links })
    // Existing Portuguese examples intentionally translate comments and strings.
    // New locales share executable examples and API spellings with English.
    if (locale === 'es/' || locale === 'zh-CN/') {
      const original = pages.get(resolve(root, file))
      const tables = (p) =>
        p.tokens
          .filter((t) => /^(?:table|tr|th|td)_(?:open|close)$/.test(t.type))
          .map((t) => t.type)
      assert.deepEqual(
        tables(pages.get(path)),
        tables(original),
        `${path}: table structure changed`,
      )
      const fences = (p) =>
        p.tokens.filter((t) => t.type === 'fence').map((t) => [t.info, t.content])
      assert.deepEqual(
        fences(pages.get(path)),
        fences(original),
        `${path}: code examples changed`,
      )
      const code = (p) =>
        p.tokens
          .flatMap((t) =>
            (t.children ?? [])
              .filter((c) => c.type === 'code_inline')
              .map((c) => c.content),
          )
          .sort()
      assert.deepEqual(
        code(pages.get(path)),
        code(original),
        `${path}: inline API/code changed`,
      )
      for (const id of original.ids)
        assert(ids.has(id), `${path}: missing source anchor #${id}`)
    }
  }
}
for (const [path, page] of pages) {
  for (const href of page.links) {
    if (/^(?:[a-z]+:|\/\/)/i.test(href)) continue
    const [target, fragment] = href.split('#')
    let dest = target?.split('?')[0]
    if (!dest) dest = path
    else {
      dest = resolve(dest.startsWith('/') ? root : dirname(path), dest.replace(/^\//, ''))
      if (dest.endsWith('/guide') || dest === root || /\/(?:es|zh-CN|pt-BR)$/.test(dest))
        dest += '/index.md'
      else if (!/\.[a-z\d]+$/i.test(dest)) dest += '.md'
    }
    // Static assets and the standalone viewer are checked by the site build/browser.
    if (!dest.endsWith('.md')) continue
    const linked = pages.get(dest)
    assert(linked, `${path}: missing local page ${href}`)
    if (fragment)
      assert(
        linked.ids.has(decodeURIComponent(fragment)),
        `${path}: missing anchor ${href}`,
      )
  }
}
const dictionaries = []
for (const locale of ['es', 'zh-CN']) {
  const source = await readFile(
    resolve(root, `.vitepress/locales/${locale}-ui.ts`),
    'utf8',
  )
  const { code } = await transform(source, { loader: 'ts', format: 'esm' })
  const dictionary = (
    await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  ).default
  assert(
    Object.values(dictionary).every((value) => typeof value === 'string' && value.trim()),
    `${locale}: empty UI translation`,
  )
  dictionaries.push(dictionary)
}
assert.deepEqual(
  Object.keys(dictionaries[0]).sort(),
  Object.keys(dictionaries[1]).sort(),
  'UI locale keys differ',
)
console.log(
  `Documentation: ${guides.length + 1} pages × 4 languages; links, anchors, shared code and UI keys passed`,
)
