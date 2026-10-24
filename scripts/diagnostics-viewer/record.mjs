import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const out = resolve(process.env.OUT ?? 'scripts/diagnostics-viewer/out/recording')
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
for (let i = 0; i < samples.length; i++)
  await writeFile(
    `${out}/example-${i + 1}.json`,
    JSON.stringify(samples[i].report, null, 2),
  )
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
  recordVideo: { dir: out, size: { width: 1440, height: 1050 } },
  reducedMotion: 'reduce',
})
const page = await context.newPage()
const pause = (ms = 1700) => page.waitForTimeout(ms)
const top = () => page.evaluate(() => scrollTo(0, 0))
try {
  await page.goto(
    pathToFileURL(resolve('docs/public/diagnostics-viewer/index.html')).href,
  )
  await pause(1200)
  await page.locator('#report-files').setInputFiles(`${out}/example-1.json`)
  await page
    .getByRole('heading', { name: 'Navigation diagnostics', exact: true })
    .waitFor()
  await pause(2300)
  await page.evaluate(() => scrollTo(0, 230))
  await pause(2200)
  await page.getByRole('button', { name: 'Timeline', exact: true }).click()
  await page.evaluate(() => scrollTo(0, 360))
  await pause(2300)
  await page.selectOption('#phase-filter', 'guard')
  await pause(2200)
  await page.selectOption('#outcome-filter', 'aborted')
  await page.getByRole('button', { name: 'guard · beforeEach', exact: true }).click()
  await pause(2200)
  await page.selectOption('#phase-filter', '')
  await page.selectOption('#outcome-filter', '')
  await page.selectOption('#navigation-filter', '4')
  await pause()
  await page.getByRole('button', { name: '← N3', exact: true }).first().click()
  await pause()
  await page.locator('#report-files').setInputFiles(`${out}/example-2.json`)
  await top()
  await pause(1900)
  await page.evaluate(() => scrollTo(0, 300))
  await pause(2300)
  await page.locator('#report-files').setInputFiles(`${out}/example-3.json`)
  await page.getByRole('button', { name: 'Stack comparison', exact: true }).click()
  await top()
  await pause(1800)
  await page.selectOption('#language', 'pt-BR')
  await pause(1800)
  await page.getByRole('button', { name: /example-1.json/ }).click()
  await pause(1800)
  await page.screenshot({ path: `${out}/poster.png` })
} finally {
  await context.close()
  await writeFile(`${out}/video-path.txt`, await page.video().path())
  await browser.close()
}
console.log(
  `Recorded actual viewer interactions in ${out}; the imported fixtures are explicitly synthetic examples.`,
)
