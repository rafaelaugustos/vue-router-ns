import { Button, Frame, Label, Page, StackLayout, Utils } from '@nativescript/core'
import type { Router, RouterDiagnostics } from 'vue-router-ns'

/** Deliberately slow/faulty scenarios are registered only in the debug demo. */
export function installDiagnosticsDemo(
  router: Pick<Router, 'addRoute' | 'onLink' | 'diagnostics'>,
) {
  // `vuerouterns://diagnostics/export` prints a timing summary for the native smoke suite
  router.onLink((result) => {
    if (result.link.path !== '/diagnostics/export' || !router.diagnostics) return
    console.log(
      `[vue-router-ns:baseline] ${JSON.stringify(summarize(router.diagnostics))}`,
    )
  })
  router.addRoute({
    path: '/diagnostics',
    component: () => import('./pages/Diagnostics.vue'),
  })
  router.addRoute({
    path: '/diagnostics/slow',
    component: () => import('./pages/DiagnosticDestination.vue'),
    beforeEnter: () => new Promise<void>((resolve) => setTimeout(resolve, 350)),
  })
  router.addRoute({
    path: '/diagnostics/heavy',
    component: () => import('./pages/DiagnosticDestination.vue'),
  })
}

/** Count and percentiles of the completed spans of each phase, plus open issues. */
function summarize(diagnostics: RouterDiagnostics) {
  const durations: Record<string, number[]> = {}
  for (const event of diagnostics.events) {
    if (event.status !== 'end' || event.duration === undefined) continue
    ;(durations[event.phase] ??= []).push(event.duration)
  }
  const percentile = (values: number[], share: number) =>
    values.length
      ? values[Math.min(values.length - 1, Math.floor(values.length * share))]!
      : null
  const phases: Record<
    string,
    { count: number; p50: number | null; p95: number | null; max: number | null }
  > = {}
  for (const [phase, values] of Object.entries(durations)) {
    const sorted = [...values].sort((a, b) => a - b)
    phases[phase] = {
      count: sorted.length,
      p50: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95),
      max: sorted.at(-1) ?? null,
    }
  }
  return {
    phases,
    issues: diagnostics.snapshot().issues,
    dropped: diagnostics.droppedEvents,
  }
}

/** A real unmanaged native Page, to prove the inspector sees host divergence. */
export function showNativeMismatch(frame: Frame, diagnostics: RouterDiagnostics) {
  const page = new Page()
  page.actionBar.title = 'Unmanaged native Page'
  const content = new StackLayout()
  content.padding = 24
  const description = new Label()
  description.textWrap = true
  description.text =
    'This Page was added directly to the native Frame. The inspector should report unknown-native-page and stack-mismatch. Return to the inspector to see recovery.'
  const copy = new Button()
  copy.text = 'Copy report with mismatch'
  copy.on('tap', () => Utils.copyToClipboard(diagnostics.export()))
  const back = new Button()
  back.text = 'Return to inspector'
  back.on('tap', () => frame.goBack())
  content.addChild(description)
  content.addChild(copy)
  content.addChild(back)
  page.content = content
  frame.navigate({ create: () => page, animated: false })
}
