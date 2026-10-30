import assert from 'node:assert/strict'

export function windowNodes(xml) {
  return [...xml.matchAll(/<node\s+([^>]+)/g)].map((match) =>
    Object.fromEntries(
      [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
    ),
  )
}

// Only the named system ANR is recoverable. Never restart the fixture or retry
// a navigation assertion; a second launcher ANR makes this run unreliable.
export function createLauncherRecovery({ pid, capture, tap, pause, saveReport }) {
  let attempts = 0
  return async (xml) => {
    const system = windowNodes(xml).filter((node) => node.package === 'android')
    if (!system.some((node) => node['resource-id'] === 'android:id/aerr_wait'))
      return false
    const report = {
      attempt: ++attempts,
      at: new Date().toISOString(),
      title: system.find((node) => node['resource-id'] === 'android:id/alertTitle')?.text,
      applicationPidBefore: await pid(),
      status: 'detected',
    }
    await capture(xml, report.attempt)
    try {
      assert.equal(report.title, "Pixel Launcher isn't responding", 'Unexpected app ANR')
      assert.equal(report.attempt, 1, 'Repeated Pixel Launcher ANR: unstable emulator')
      assert.match(report.applicationPidBefore, /^\d+$/, 'Fixture process is missing')
      const close = system.find((node) => node['resource-id'] === 'android:id/aerr_close')
      assert(
        close?.enabled === 'true' && close.clickable === 'true',
        'Missing ANR Close app button',
      )
      const bounds = close.bounds?.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/)
      assert(bounds, 'Invalid ANR Close app bounds')
      const [, left, top, right, bottom] = bounds.map(Number)
      assert(right > left && bottom > top, 'Empty ANR Close app bounds')
      await tap(Math.round((left + right) / 2), Math.round((top + bottom) / 2))
      await pause(500)
      report.applicationPidAfter = await pid()
      assert.equal(
        report.applicationPidAfter,
        report.applicationPidBefore,
        'Fixture process changed during launcher recovery',
      )
      report.status = 'recovered'
      return true
    } catch (error) {
      report.status = 'failed'
      report.error = error.message
      throw error
    } finally {
      await saveReport(report)
    }
  }
}
