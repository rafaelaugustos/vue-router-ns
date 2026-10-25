// Optional browser tooling, like scripts/diagnostics-viewer/check.mjs.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const root = resolve('docs/.vitepress/dist')
const out = resolve(process.env.OUT ?? 'scripts/docs/out')
await mkdir(out, { recursive: true })
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://local').pathname)
    if (path.endsWith('/')) path += 'index.html'
    else if (!extname(path)) path += '.html'
    const file = resolve(root, '.' + path)
    assert(file.startsWith(root + '/'))
    res.setHeader(
      'Content-Type',
      {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.mp4': 'video/mp4',
        '.woff2': 'font/woff2',
      }[extname(file)] ?? 'application/octet-stream',
    )
    res.end(await readFile(file))
  } catch {
    res.writeHead(404)
    res.end()
  }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const base = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ headless: true })
const errors = [],
  missing = [],
  checks = []
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  })
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === base ? route.continue() : route.abort(),
  )
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => {
    if (response.url().startsWith(base) && response.status() >= 400)
      missing.push(response.url().slice(base.length))
  })
  for (const [locale, title, query] of [
    ['en', 'Native navigation.', 'navigation'],
    ['pt-BR', 'Navegação nativa.', 'navegação'],
    ['es', 'Navegación nativa.', 'navegación'],
    ['zh-CN', '原生导航。', '导航'],
  ]) {
    const prefix = locale === 'en' ? '' : '/' + locale
    await page.goto(base + prefix + '/')
    await page.locator('.navigation-hero h1').waitFor()
    assert((await page.locator('h1').innerText()).includes(title), `${locale} home title`)
    await page.goto(base + prefix + '/guide/first-app')
    await page.locator('.vp-doc h1').waitFor()
    for (const text of [
      'createApp(App).use(router).start()',
      'pushForResult',
      'Keep editing',
      'Save note',
    ])
      assert(
        (await page.locator('.vp-doc').innerText()).includes(text),
        `${locale} tutorial ${text}`,
      )
    assert.equal(await page.locator('div[class*="language-vue"]').count(), 4)
    await page.locator('.VPNavBarSearch button').click()
    await page.locator('#localsearch-input').fill(query)
    await page.locator('#localsearch-list .result').first().waitFor()
    const result = page.locator('#localsearch-list .result').first()
    assert(
      (await result.getAttribute('href')).startsWith(prefix + '/guide/'),
      `${locale} search stays localized`,
    )
    await result.click()
    await page.locator('.vp-doc h1').waitFor()
    assert(new URL(page.url()).pathname.startsWith(prefix + '/guide/'))
    await page.goto(base + prefix + '/guide/mental-model')
    const steps = page.locator('.stack-model-buttons button')
    await steps.nth(2).click()
    assert.equal(await steps.nth(2).getAttribute('aria-pressed'), 'true')
    assert((await page.locator('.stack-model-explanation').innerText()).includes('Edit'))
    await steps.nth(4).click()
    assert((await page.locator('.stack-model-explanation').innerText()).includes('coast'))
    await page.goto(base + prefix + '/guide/examples')
    await page.locator('.example-card').first().waitFor()
    assert.equal(await page.locator('.example-card').count(), 10)
    await page.getByRole('button', { name: 'Android', exact: true }).click()
    assert.equal(await page.locator('.example-card').count(), 4)
    await page.getByRole('searchbox').fill(locale === 'zh-CN' ? '底部面板' : 'sheet')
    assert.equal(
      await page.locator('.example-card').count(),
      1,
      `${locale} gallery search`,
    )
    for (const card of await page.locator('.example-card').all())
      assert((await card.getAttribute('href')).startsWith(prefix + '/guide/'))
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of [
        '/',
        '/guide/first-app',
        '/guide/examples',
        '/guide/mental-model',
        '/guide/stable-readiness',
      ]) {
        await page.goto(base + prefix + path)
        assert(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${locale}${path}: overflow at ${width}px`,
        )
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(base + prefix + '/')
    await page.screenshot({ path: `${out}/${locale}-home.png` })
    checks.push(
      `${locale}: home, complete tutorial, local search, gallery, interactive model, 320/390px layouts`,
    )
  }
  // The language menu must retain the current guide and its fragment.
  await page.goto(base + '/es/guide/guards#leave-guards')
  await page.locator('.VPNavBarTranslations button').click()
  await page
    .locator('.VPNavBarTranslations')
    .getByRole('link', { name: '简体中文', exact: true })
    .click()
  await page.waitForURL(base + '/zh-CN/guide/guards#leave-guards')
  await page.waitForFunction(() => document.documentElement.lang === 'zh-CN')
  checks.push('language switch keeps guide and anchor')
  await page.goto(base + '/diagnostics-viewer/index.html?lang=es')
  await page.locator('#examples').click()
  const count = await page.locator('.capture').count()
  assert(count > 0)
  await page.locator('#language').selectOption('zh-CN')
  await page.waitForFunction(() => document.documentElement.lang === 'zh-CN')
  assert.equal(await page.locator('.capture').count(), count)
  await page.screenshot({ path: `${out}/zh-CN-viewer.png` })
  checks.push('viewer loads Spanish and switches to Chinese without losing reports')
  assert.deepEqual(errors, [])
  assert.deepEqual(missing, [])
  await context.close()
  if (process.env.RECORD) {
    const recording = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      recordVideo: { dir: out, size: { width: 1440, height: 1000 } },
      reducedMotion: 'reduce',
    })
    await recording.route('**/*', (route) =>
      new URL(route.request().url()).origin === base ? route.continue() : route.abort(),
    )
    const demo = await recording.newPage()
    const pause = () => demo.waitForTimeout(1800)
    await demo.goto(base + '/es/')
    await pause()
    await demo.goto(base + '/es/guide/first-app')
    await pause()
    await demo.locator('.VPNavBarTranslations button').click()
    await pause()
    await demo
      .locator('.VPNavBarTranslations')
      .getByRole('link', { name: '简体中文', exact: true })
      .click()
    await pause()
    await demo.locator('.VPNavBarSearch button').click()
    await demo.locator('#localsearch-input').fill('导航')
    await pause()
    await demo.keyboard.press('Escape')
    await demo.goto(base + '/zh-CN/guide/mental-model')
    await demo.locator('.stack-model').scrollIntoViewIfNeeded()
    await pause()
    await demo.locator('.stack-model-buttons button').nth(2).click()
    await pause()
    await demo.locator('.stack-model-buttons button').nth(3).click()
    await pause()
    await demo.locator('.stack-model-buttons button').nth(4).click()
    await pause()
    await demo.goto(base + '/es/guide/examples')
    await pause()
    await demo.getByRole('button', { name: 'Android', exact: true }).click()
    await pause()
    await demo.goto(base + '/diagnostics-viewer/index.html?lang=es')
    await demo.locator('#examples').click()
    await pause()
    await demo.locator('#language').selectOption('zh-CN')
    await pause()
    await demo.goto(
      base + '/pt-BR/guide/stable-readiness#revisao-para-a-1-0-—-25-10-2026',
    )
    await pause()
    await recording.close()
    console.log(`Recording: ${await demo.video().path()}`)
  }
  await writeFile(
    `${out}/checks.json`,
    JSON.stringify({ checks, errors, missing }, null, 2) + '\n',
  )
  console.log(checks.join('\n'))
} finally {
  await browser.close()
  server.close()
}
