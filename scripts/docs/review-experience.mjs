import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { recordExperience } from './record-experience.mjs'

const base = process.env.DOCS_URL ?? 'http://127.0.0.1:4174'
const out = resolve(process.env.DOCS_REVIEW_OUT ?? 'scripts/docs/out/experience')
await mkdir(out, { recursive: true })
const browser = await chromium.launch()
const errors = []
const failedRequests = []
const reports = []
try {
  if (process.argv.includes('--record')) {
    await recordExperience(browser, base, out)
  } else {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('response', (response) => {
      if (response.status() >= 400 && response.url().startsWith(base))
        failedRequests.push(response.url())
    })
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type()))
        console.log(message.type(), message.text())
    })
    const checkWidth = async (name) => {
      const sizes = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
      }))
      assert(
        sizes.document <= sizes.viewport + 1,
        `${name}: horizontal overflow ${JSON.stringify(sizes)}`,
      )
      const clipped = await page
        .locator('.proof-copy, .proof-media, .hero-title, .scene-window')
        .evaluateAll((elements) =>
          elements
            .filter((element) => {
              const bounds = element.getBoundingClientRect()
              return bounds.left < -1 || bounds.right > innerWidth + 1
            })
            .map((element) => element.className),
        )
      assert.deepEqual(clipped, [], `${name}: content is clipped`)
    }
    await page.goto(base)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${out}/initial.png`, fullPage: true })
    await page.locator('[data-motion-ready="true"]').waitFor()
    await page.waitForTimeout(1100)
    await checkWidth('desktop home')
    await page.screenshot({ path: `${out}/home-desktop.png`, fullPage: true })
    const scene = page.locator('[data-navigation-scene]')
    await scene.getByRole('textbox', { name: 'Search notes', exact: true }).fill('coast')
    await scene.locator('[data-open-note]').click()
    await scene.locator('[data-edit]').click()
    await scene.locator('textarea').fill('A note to come back to.')
    await scene.getByRole('button', { name: 'Save & return' }).click()
    assert.equal(
      await scene.locator('.scene-note-body').textContent(),
      'A note to come back to.',
    )
    await scene.locator('[data-back]').click()
    assert.equal(
      await scene
        .getByRole('textbox', { name: 'Search notes', exact: true })
        .inputValue(),
      'coast',
    )
    await scene.locator('[data-open-note]').click()
    assert.equal(
      await scene.locator('.scene-note-body').textContent(),
      'A note to come back to.',
    )
    await scene.locator('[data-edit]').click()
    await scene.locator('textarea').fill('Discard this draft')
    await page.keyboard.press('Escape')
    assert.equal(
      await scene.locator('.scene-note-body').textContent(),
      'A note to come back to.',
    )
    reports.push(
      'Push, retained search, modal result, cancellation and keyboard Escape passed.',
    )
    for (const [locale, width] of [
      ['pt-BR', 1440],
      ['es', 390],
      ['zh-CN', 390],
      ['', 320],
      ['', 768],
      ['', 1024],
    ]) {
      await page.setViewportSize({ width, height: 950 })
      await page.goto(`${base}/${locale ? `${locale}/` : ''}`)
      await page.locator('[data-motion-ready="true"]').waitFor()
      await page.waitForTimeout(900)
      await checkWidth(`${locale || 'en'} ${width}`)
      await page.screenshot({
        path: `${out}/home-${locale || 'en'}-${width}.png`,
        fullPage: true,
      })
      assert(
        await page
          .locator(`.route-button[href="/${locale ? `${locale}/` : ''}guide/first-app"]`)
          .count(),
      )
    }
    reports.push('Four localized homes and 320–1440px layouts passed.')
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(`${base}/guide/mental-model`)
    await page.locator('.stack-model button').nth(2).click()
    assert.match(
      await page.locator('.stack-model-explanation').textContent(),
      /modal Frame/,
    )
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${out}/guide-desktop.png`, fullPage: true })
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.screenshot({ path: `${out}/guide-dark.png`, fullPage: true })
    await page.goto(base)
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForTimeout(1000)
    await page.screenshot({ path: `${out}/home-dark.png`, fullPage: true })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await page.locator('[data-motion-ready="true"]').waitFor()
    await page.locator('.proof-media').scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    assert(
      await page
        .locator('video')
        .evaluateAll((videos) => videos.every((video) => video.paused)),
    )
    const moving = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => animation.playState === 'running')
        .map((animation) => ({
          target: animation.effect?.target?.className,
          duration: animation.effect?.getTiming().duration,
          time: animation.currentTime,
          frames: animation.effect?.getKeyframes(),
        })),
    )
    assert.equal(moving.length, 0)
    reports.push(
      'Reduced motion settles animation and prevents automatic video playback.',
    )
    await context.close()
    const staticContext = await browser.newContext({ javaScriptEnabled: false })
    const staticPage = await staticContext.newPage()
    await staticPage.goto(base)
    assert(await staticPage.locator('h1').isVisible())
    await staticPage.locator('.route-button').first().click()
    assert.match(staticPage.url(), /guide\/first-app/)
    reports.push('Server-rendered content and guide navigation work without JavaScript.')
    await staticContext.close()
    assert.deepEqual(errors, [], 'Browser errors')
    assert.deepEqual(failedRequests, [], 'Failed local resources')
    await writeFile(
      `${out}/report.json`,
      JSON.stringify({ base, reports, errors }, null, 2),
    )
    console.log(reports.join('\n'))
    console.log(`Browser evidence: ${out}`)
  }
} finally {
  await browser.close()
}
