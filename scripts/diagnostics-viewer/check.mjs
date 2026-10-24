import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

// Optional test tooling: no Playwright dependency is added to the runtime/package.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const out = resolve(process.env.OUT ?? 'scripts/diagnostics-viewer/out')
await mkdir(out, { recursive: true })
await build({
  entryPoints: ['tools/diagnostics-viewer/examples.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: `${out}/examples.mjs`,
})
const { examples } = await import(pathToFileURL(`${out}/examples.mjs`).href)
const samples = examples()
const html = await readFile('docs/public/diagnostics-viewer/index.html')
const server = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  response.end(html)
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const url =
  process.env.VIEWER_URL ?? `http://127.0.0.1:${server.address().port}/index.html`
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
  reducedMotion: 'reduce',
})
const page = await context.newPage()
const errors = [],
  network = []
page.on('pageerror', (error) => errors.push(String(error)))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('request', (request) => {
  if (/^https?:/.test(request.url()) && request.url() !== url) network.push(request.url())
})
const upload = async (reports) => {
  await page.locator('#report-files').setInputFiles(
    reports.map(([name, value]) => ({
      name,
      mimeType: 'application/json',
      buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)),
    })),
  )
  await page.waitForFunction(() => !document.querySelector('#open-reports').disabled)
}
const text = async (selector, pattern) =>
  assert.match(await page.locator(selector).innerText(), pattern)
try {
  await page.goto(url)
  await upload([['investigation.json', samples[0].report]])
  await page
    .getByRole('heading', { name: 'Navigation diagnostics', exact: true })
    .waitFor()
  await text('.metrics', /350 ms/)
  await text('.metrics', /80 ms/)
  await text('.issues', /unknown-native-page/)
  assert.equal(await page.locator('.differs').count(), 1)
  await page.screenshot({ path: `${out}/desktop.png` })
  await page.getByRole('button', { name: 'Timeline', exact: true }).click()
  await page.selectOption('#phase-filter', 'guard')
  await page.selectOption('#outcome-filter', 'aborted')
  assert.equal(await page.locator('tbody tr').count(), 1)
  await text('tbody', /35 ms/)
  await page.getByRole('button', { name: 'guard · beforeEach', exact: true }).click()
  await text('.event-detail', /navigationId\s+2/)
  await page.selectOption('#phase-filter', '')
  await page.selectOption('#outcome-filter', '')
  await page.selectOption('#navigation-filter', '4')
  await page.getByRole('button', { name: '← N3', exact: true }).first().click()
  assert.equal(await page.locator('#navigation-filter').inputValue(), '3')
  await text('tbody', /redirected/)
  await page.selectOption('#navigation-filter', '')
  await page.screenshot({ path: `${out}/timeline.png` })
  await upload([
    ['truncated.json', samples[1].report],
    ['second-window.json', samples[2].report],
  ])
  await page.getByRole('button', { name: /second-window.json/ }).waitFor()
  await page.getByRole('button', { name: /truncated.json/ }).click()
  await text('.note.warning', /120 events dropped/)
  await text('tbody', /Start not retained/)
  await text('tbody', /End not retained/)
  assert.equal(await page.locator('.span-bar.point').count(), 2)
  await page.getByRole('button', { name: /second-window.json/ }).click()
  await text('main', /No retained events/)
  await page.getByRole('button', { name: 'Stack comparison', exact: true }).click()
  await text('.hosts', /window-2/)
  assert.equal(await page.locator('.differs').count(), 0)
  await page.selectOption('#language', 'pt-BR')
  await page
    .getByRole('heading', { name: 'Diagnósticos de navegação', exact: true })
    .waitFor()
  assert.equal(await page.locator('html').getAttribute('lang'), 'pt-BR')
  await page.selectOption('#language', 'en')
  await upload([
    ['unsupported.json', { ...samples[0].report, version: 99 }],
    ['malformed.json', '{broken'],
  ])
  await text('[role=alert]', /Unsupported diagnostics version/)
  await text('[role=alert]', /Invalid JSON/)
  assert.equal(
    await page.locator('.capture').count(),
    3,
    'Failed imports replaced valid captures',
  )
  const unsafe = structuredClone(samples[0].report)
  unsafe.snapshot.stacks[0].name =
    '<img src="https://invalid.test/leak" onerror="globalThis.injected=true">'
  unsafe.snapshot.stacks[0].logical[0].route = '<script>globalThis.injected=true</script>'
  unsafe.events[0].secret = 'DO_NOT_RENDER'
  await upload([['untrusted.json', unsafe]])
  await text('.stack-card', /<img/)
  assert.equal(await page.locator('img').count(), 0)
  assert.equal(await page.evaluate(() => globalThis.injected), undefined)
  assert(!(await page.locator('body').innerText()).includes('DO_NOT_RENDER'))
  assert.deepEqual(network, [], 'The viewer sent a report or loaded an external asset')
  await page.getByRole('button', { name: 'Clear reports', exact: true }).click()
  const large = structuredClone(samples[0].report)
  large.snapshot.time = 10000
  large.events = Array.from({ length: 10_000 }, (_, index) => ({
    id: index + 1,
    routerId: large.routerId,
    time: index,
    phase: 'native',
    status: 'event',
    detail: `Event ${index + 1}`,
  }))
  await upload([['large.json', large]])
  await page.getByRole('button', { name: 'Timeline', exact: true }).click()
  assert.equal(await page.locator('tbody tr').count(), 100)
  await page.locator('#timeline-next').click()
  await text('tbody tr:first-child', /Event 101/)
  await page.locator('#timeline-previous').click()
  await text('tbody tr:first-child', /Event 1\b/)
  await page.getByRole('button', { name: 'Clear reports', exact: true }).click()
  await page.reload()
  assert.equal(
    await page.locator('.capture').count(),
    0,
    'Reports persisted after reload',
  )
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download offline viewer', exact: true }).click()
  const download = await downloadPromise
  const offlineFile = `${out}/offline-viewer.html`
  await download.saveAs(offlineFile)
  await context.setOffline(true)
  await page.goto(pathToFileURL(offlineFile).href)
  await upload([['offline.json', samples[0].report]])
  await text('.metrics', /350 ms/)
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Clear reports', exact: true }).click()
  await page.evaluate(() => {
    const original = File.prototype.text
    File.prototype.text = async function () {
      await new Promise((done) => setTimeout(done, 500))
      return original.call(this)
    }
  })
  await page.locator('#report-files').setInputFiles({
    name: 'delayed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(samples[0].report)),
  })
  // Changing to the examples invalidates the pending import generation.
  await page
    .getByRole('button', { name: 'Explore example reports', exact: true })
    .first()
    .click()
  await page.waitForTimeout(650)
  assert.equal(await page.getByRole('button', { name: /delayed.json/ }).count(), 0)
  await page.reload()
  await page
    .getByRole('button', { name: 'Explore example reports', exact: true })
    .first()
    .click()
  await page.setViewportSize({ width: 390, height: 844 })
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    'Mobile document overflows',
  )
  await page.screenshot({ path: `${out}/mobile.png`, fullPage: true })
  await page.getByRole('button', { name: 'Timeline', exact: true }).click()
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    'Mobile timeline escapes its scroll container',
  )
  await page.locator('#phase-filter').focus()
  await page.keyboard.press('g')
  await page.keyboard.press('Tab')
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'outcome-filter')
  assert.deepEqual(errors, [])
  await writeFile(
    `${out}/checks.json`,
    JSON.stringify(
      {
        result: 'passed',
        browser: await browser.version(),
        network,
        errors,
        cases: [
          'offline JSON import',
          'guard/mount durations',
          'logical/native mismatch',
          'outcome/phase/request filters',
          'redirect parent',
          'truncation',
          'independent capture/window',
          'Portuguese',
          'malformed/version errors',
          'untrusted strings',
          '10000-event pagination',
          'no persistence',
          'downloaded HTML offline',
          'pending import invalidation',
          'mobile overflow',
          'keyboard filters',
        ],
      },
      null,
      2,
    ),
  )
  console.log(
    'Viewer browser acceptance passed: local import, correlation, truncation, isolation, privacy, pagination, mobile and keyboard',
  )
} finally {
  await browser.close()
  server.close()
}
