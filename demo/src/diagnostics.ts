import { Button, Frame, Label, Page, StackLayout, Utils } from '@nativescript/core'
import type { Router, RouterDiagnostics } from 'vue-router-ns'

/** Deliberately slow/faulty scenarios are registered only in the debug demo. */
export function installDiagnosticsDemo(router: Pick<Router, 'addRoute'>) {
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
