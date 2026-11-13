import { copyFile } from 'node:fs/promises'

/** Capture the actual production site, including its live controls and native clips. */
export async function recordExperience(browser, base, out) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    recordVideo: { dir: out, size: { width: 1280, height: 850 } },
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${base}/pt-BR/`)
  await page.locator('[data-motion-ready="true"]').waitFor()
  await page.waitForTimeout(1700)
  await page.screenshot({ path: `${out}/poster.png` })
  const scene = page.locator('[data-navigation-scene]')
  await scene
    .getByRole('textbox', { name: 'Buscar notas', exact: true })
    .pressSequentially('costa', { delay: 100 })
  await page.waitForTimeout(700)
  await scene.locator('[data-open-note]').click()
  await page.waitForTimeout(1000)
  await scene.locator('[data-edit]').click()
  await page.waitForTimeout(700)
  await scene
    .locator('textarea')
    .pressSequentially('Uma boa história tem caminho de volta.', { delay: 45 })
  await scene.getByRole('button', { name: 'Salvar e voltar' }).click()
  await page.waitForTimeout(1300)
  await scene.locator('[data-back]').click()
  await page.waitForTimeout(1400)
  await page.locator('.proof-media').scrollIntoViewIfNeeded()
  await page.waitForTimeout(3000)
  await page.locator('.route-capabilities').scrollIntoViewIfNeeded()
  await page.waitForTimeout(1600)
  await page.locator('.route-feature').first().click()
  await page.locator('.stack-model').scrollIntoViewIfNeeded()
  for (const step of [1, 2, 3, 4]) {
    await page.locator('.stack-model button').nth(step).click()
    await page.waitForTimeout(1000)
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await page.waitForTimeout(1000)
  await page.locator('.VPSwitchAppearance:visible').click()
  await page.waitForTimeout(1500)
  await page.goto(`${base}/pt-BR/`)
  await page.locator('[data-motion-ready="true"]').waitFor()
  await page.waitForTimeout(1900)
  const video = page.video()
  await context.close()
  if (errors.length) throw new Error(`Recording browser errors: ${errors.join('; ')}`)
  await copyFile(await video.path(), `${out}/docs-experience.webm`)
  console.log(`Actual browser recording: ${out}/docs-experience.webm`)
}
