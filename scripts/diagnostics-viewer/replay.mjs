import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const out = resolve(process.env.OUT ?? 'scripts/diagnostics-viewer/out/replay')
const record = process.argv.includes('--record')
await mkdir(out, { recursive: true })
await build({
  entryPoints: ['tools/diagnostics-viewer/recording.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: `${out}/model.mjs`,
})
const { importReport, replay } = await import(pathToFileURL(`${out}/model.mjs`).href)
const native = async (name) =>
  readFile(`test/evidence/diagnostic-recording-stage1/${name}.json`, 'utf8')
const recovery = await native('recovery')
const model = replay(importReport(recovery))
const corrupted = JSON.parse(recovery)
corrupted.records[3].sequence = corrupted.records[2].sequence
corrupted.retainedBytes = Buffer.byteLength(JSON.stringify(corrupted.records))
const missing = JSON.parse(recovery)
missing.records.splice(8, 3)
missing.retainedBytes = Buffer.byteLength(JSON.stringify(missing.records))
const hostile = JSON.parse(await native('success'))
hostile.records.find(
  (r) => r.kind === 'checkpoint' && r.snapshot.stacks.length,
).snapshot.stacks[0].name = '<img src=x onerror="window.injected=true">'
hostile.retainedBytes = Buffer.byteLength(JSON.stringify(hostile.records))
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  reducedMotion: 'reduce',
  ...(record ? { recordVideo: { dir: out, size: { width: 1440, height: 1100 } } } : {}),
})
await context.setOffline(true)
const page = await context.newPage()
const errors = [],
  network = [],
  cases = []
page.on('pageerror', (error) => errors.push(String(error)))
page.on('request', (request) => {
  if (/^https?:/.test(request.url())) network.push(request.url())
})
const pause = async (ms = 1400) => {
  if (record) await page.waitForTimeout(ms)
}
const upload = async (name, text) => {
  await page.locator('#report-files').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(typeof text === 'string' ? text : JSON.stringify(text)),
  })
  await page.waitForFunction(() => !document.querySelector('#open-reports').disabled)
}
const text = async (selector, expression) =>
  assert.match(await page.locator(selector).innerText(), expression)
const position = async (index) => {
  const slider = page.locator('#replay-position')
  await slider.focus()
  await slider.press('Home')
  for (let i = 0; i < index; i++) await slider.press('ArrowRight')
}
try {
  await page.goto(
    pathToFileURL(resolve('docs/public/diagnostics-viewer/index.html')).href,
  )
  await pause()
  await upload('NATIVE-iOS18-recovery-v2.json', recovery)
  await text('.replay-current', /Earlier records were not retained/)
  assert.equal(await page.locator('.stack-card').count(), 0)
  await page.locator('#replay').scrollIntoViewIfNeeded()
  await pause()
  await page.locator('#replay-divergence').click()
  await text(
    '.replay-current',
    new RegExp(`#${model.steps[model.divergence.step].sequence}`),
  )
  assert((await page.locator('.differs').count()) > 0)
  if (!record) {
    await page.locator('.observation summary').first().click()
    await text('.observation', /Host-local visible entries: Unmanaged native page/)
    await page.locator('.observation summary').first().click()
  }
  await page.screenshot({ path: `${out}/divergence.png`, fullPage: true })
  await page.locator('.stack-table').first().scrollIntoViewIfNeeded()
  await pause(2400)
  await page.locator('#replay-position').focus()
  await page.locator('#replay-position').press('End')
  assert.equal(await page.locator('.differs').count(), 0)
  await text('.issues', /No issues reported/)
  await page.locator('.stack-table').first().scrollIntoViewIfNeeded()
  await pause(2000)
  cases.push('native mismatch, uncertain prior bound and recovered stacks')

  await page.locator('#tab-timeline').click()
  await page.selectOption('#phase-filter', 'guard')
  await page.selectOption('#outcome-filter', 'aborted')
  const aborted = page.locator('.timeline-table .row-button').first()
  assert(await aborted.count())
  await aborted.click()
  await text('.replay-current', /guard · end/)
  await text('.event-detail', /aborted/)
  await pause(1800)
  await page.selectOption('#phase-filter', 'navigation')
  await page.selectOption('#outcome-filter', 'cancelled')
  await page.locator('.timeline-table .row-button').first().click()
  await text('.replay-current', /navigation · end/)
  await text('.event-detail', /cancelled/)
  await pause(1800)
  cases.push('aborted and overlapping cancelled event selection synchronizes checkpoint')

  await page.locator('#tab-snapshot').click()
  const modal = model.steps.findIndex((s) =>
    s.checkpoint?.snapshot.stacks.some(
      (stack) => stack.modal && stack.logical.some((e) => e.awaitingResult),
    ),
  )
  await position(modal)
  assert((await page.locator('.stack-card').count()) > 1)
  await page.locator('.stack-card').last().scrollIntoViewIfNeeded()
  await pause(2000)
  const before = model.steps.findIndex(
    (s) => s.checkpoint?.boundary === 'reconcile-before',
  )
  await position(before)
  assert.equal(await page.locator('.differs').count(), 0)
  await text('main', /Before reconciliation: comparison deferred/)
  await pause(1500)
  cases.push('modal lifetime and pre-reconciliation comparison deferred')

  await position(1)
  await page.locator('#replay-play').click()
  await page.waitForTimeout(2300)
  assert(Number(await page.locator('#replay-position').inputValue()) >= 3)
  await page.locator('#replay-play').click()
  const paused = await page.locator('#replay-position').inputValue()
  await page.waitForTimeout(1150)
  assert.equal(await page.locator('#replay-position').inputValue(), paused)
  await page.locator('#replay-next').focus()
  await page.keyboard.press('Enter')
  assert.equal(
    Number(await page.locator('#replay-position').inputValue()),
    Number(paused) + 1,
  )
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'replay-next')
  await page.locator('#replay-play').click()
  await upload('NATIVE-iOS18-clear-v2.json', await native('clear'))
  assert.equal(await page.locator('#replay-play').getAttribute('aria-pressed'), 'false')
  await page.locator('#replay-next').click()
  await text('.replay-current', /collector was cleared/)
  assert.equal(await page.locator('.stack-card').count(), 0)
  await pause(1800)
  await page.locator('#replay-next').click()
  assert((await page.locator('.stack-card').count()) > 0)
  await pause(1600)
  cases.push(
    'play/pause/keyboard stepping; imports cancel playback; clear gap has no invented state',
  )

  await upload('NATIVE-iOS18-truncated-v2.json', await native('truncate'))
  await text('.replay-current', /Earlier records/)
  await page.locator('#replay-next').click()
  assert((await page.locator('.stack-card').count()) > 0)
  await pause(1600)
  await upload('SYNTHETIC-damaged-order-v2.json', corrupted)
  await page.locator('#replay-position').focus()
  await page.locator('#replay-position').press('End')
  await text('.replay-current', /ambiguous/)
  assert.equal(await page.locator('.stack-card').count(), 0)
  if (!record) {
    await page.locator('#tab-timeline').click()
    await text('.timeline-table', /Conflicting boundaries/)
    const ids = await page
      .locator('.timeline-table .row-button')
      .evaluateAll((elements) => elements.map((element) => element.id))
    assert.equal(new Set(ids).size, ids.length)
    await page.locator('#tab-snapshot').click()
  }
  await pause(2000)
  cases.push(
    'truncated native capture remains independent; synthetic ambiguous order disables state replay',
  )

  await upload('NATIVE-iOS18-legacy-v1.json', await native('v1'))
  assert.equal(await page.locator('#replay').count(), 0)
  assert.equal(await page.locator('.differs').count(), 0)
  await pause(1500)
  cases.push('native v1 compatibility')
  await page
    .locator('.capture')
    .filter({ hasText: 'NATIVE-iOS18-recovery-v2.json' })
    .click()
  await page.locator('#replay-divergence').click()
  await page.locator('.stack-table').first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${out}/poster.png` })
  if (record) await pause(2000)

  if (!record) {
    await upload('SYNTHETIC-missing-records.json', missing)
    const missingModel = replay(importReport(JSON.stringify(missing)))
    await position(missingModel.steps.findIndex((s) => s.gap === 'missing-records'))
    await text('.replay-current', /Records are missing/)
    assert.equal(await page.locator('.stack-card').count(), 0)
    await upload('SYNTHETIC-untrusted-strings.json', hostile)
    const hostileModel = replay(importReport(JSON.stringify(hostile)))
    await position(
      hostileModel.steps.findIndex((s) =>
        s.checkpoint?.snapshot.stacks.some((stack) => stack.name.startsWith('<img')),
      ),
    )
    await text('.stack-card', /<img src=x/)
    assert.equal(await page.evaluate(() => window.injected), undefined)
    cases.push('missing interior records and untrusted text')
    const count = await page.locator('.capture').count()
    await upload('malformed.json', { version: 2, records: 'private-payload' })
    await text('[role=alert]', /expected/)
    assert.equal(await page.locator('.capture').count(), count)
    assert(!(await page.locator('[role=alert]').innerText()).includes('private-payload'))
    await page
      .locator('.capture')
      .filter({ hasText: 'NATIVE-iOS18-recovery-v2.json' })
      .click()
    await page.setViewportSize({ width: 390, height: 844 })
    for (const locale of ['en', 'pt-BR', 'es', 'zh-CN']) {
      await page.selectOption('#language', locale)
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${locale}: mobile overflow`,
      )
      assert.equal(
        await page.locator('#replay-play').getAttribute('aria-pressed'),
        'false',
      )
      await page.locator('#replay-next').focus()
      await page.keyboard.press('Enter')
      await page.screenshot({ path: `${out}/mobile-${locale}.png` })
    }
    cases.push('four locales, mobile width, reduced motion and keyboard focus')
    await page.selectOption('#language', 'en')
    await page.locator('#clear-reports').click()
    const redirected = JSON.parse(await native('success'))
    const events = redirected.records
      .filter((r) => r.kind === 'event')
      .map((r) => r.event)
    const parent = events.find((e) => e.phase === 'navigation' && e.status === 'end')
    const child = events.find(
      (e) =>
        e.phase === 'navigation' &&
        e.status === 'start' &&
        e.navigationId !== parent.navigationId,
    )
    parent.outcome = 'redirected'
    for (const event of events)
      if (event.navigationId === child.navigationId)
        event.parentNavigationId = parent.navigationId
    redirected.retainedBytes = Buffer.byteLength(JSON.stringify(redirected.records))
    await upload('SYNTHETIC-redirect-correlation-v2.json', redirected)
    await page.locator('#tab-timeline').click()
    await page.selectOption('#phase-filter', 'navigation')
    await page.selectOption('#navigation-filter', String(child.navigationId))
    await page.locator('.parent-link').first().click()
    assert.equal(
      await page.locator('#navigation-filter').inputValue(),
      String(parent.navigationId),
    )
    await page.locator('.timeline-table .row-button').first().click()
    await text('.event-detail', /redirected/)
    const many = JSON.parse(await native('success'))
    const initial = many.records[0]
    many.records = Array.from({ length: 10000 }, (_, index) => ({
      ...initial,
      boundary: 'manual',
      sequence: index + 1,
      time: index,
      snapshot: { ...initial.snapshot, time: index },
    }))
    many.limits = { maxRecords: 10000, maxBytes: 8388608 }
    many.retainedBytes = Buffer.byteLength(JSON.stringify(many.records))
    await upload('SYNTHETIC-10000-checkpoints-v2.json', many)
    assert.equal(await page.locator('#replay-position').getAttribute('max'), '9999')
    await page.locator('#replay-position').focus()
    await page.locator('#replay-position').press('End')
    await text('.replay-current', /#10000/)
    assert.equal(await page.locator('.stack-card').count(), 0)
    assert(
      (await page.locator('body *').count()) < 350,
      'Replay rendered the entire checkpoint history',
    )
    cases.push('v2 redirect parent selection and 10000-checkpoint bounded DOM')
    assert.equal(
      await page.evaluate(() => localStorage.length + sessionStorage.length),
      0,
    )
    await page.locator('#replay-play').click()
    await page.locator('#clear-reports').click()
    await page.waitForTimeout(1100)
    assert.equal(await page.locator('#replay').count(), 0)
    assert.equal(await page.locator('.capture').count(), 0)
    await page.reload()
    assert.equal(await page.locator('.capture').count(), 0)
    cases.push('clear/reload discards data and cancels playback; offline, no persistence')
  }
  assert.deepEqual(network, [])
  assert.deepEqual(errors, [])
  await writeFile(
    `${out}/checks.json`,
    JSON.stringify(
      {
        result: 'passed',
        browser: await browser.version(),
        nativeEvidence:
          'Committed iOS18.6 captures from PR196; not rerun natively for this browser-only stage',
        cases,
        network,
        errors,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(
    `Replay browser acceptance passed (${cases.length} groups); actual native captures and explicitly synthetic damage, offline`,
  )
} finally {
  await context.close()
  if (record) await writeFile(`${out}/video-path.txt`, await page.video().path())
  await browser.close()
}
