import { Frame, Page, isIOS } from '@nativescript/core'
import { getViewMeta, registerElement, renderer } from 'nativescript-vue'

export const counts = {
  pages: 0,
  frames: 0,
  controllers: 0,
  vueApps: 0,
  detailSetups: 0,
  detailUnmounts: 0,
  factories: 0,
  factorySettlements: 0,
  data: 0,
  guards: 0,
}
const controllers = new WeakSet<object>()
function observe(controller: object | undefined) {
  if (controller && !controllers.has(controller)) {
    controllers.add(controller)
    counts.controllers++
  }
}
class CountedPage extends Page {
  constructor() {
    super()
    counts.pages++
    if (isIOS) observe(this.ios)
  }
  override createNativeView() {
    const view = super.createNativeView()
    if (isIOS) observe(this.ios)
    return view
  }
}
class CountedFrame extends Frame {
  constructor() {
    super()
    counts.frames++
    if (isIOS) observe(this.ios?.controller)
  }
  override createNativeView() {
    const view = super.createNativeView()
    if (isIOS) observe(this.ios?.controller)
    return view
  }
}
// Fixture-only counters around public construction APIs; no native delegate changes.
registerElement('Page', () => CountedPage, {
  ...getViewMeta('Page'),
  overwriteExisting: true,
})
registerElement('Frame', () => CountedFrame, {
  ...getViewMeta('Frame'),
  overwriteExisting: true,
})
const create = renderer.createApp
renderer.createApp = (...args) => {
  counts.vueApps++
  return create(...args)
}
export const snapshot = () => ({ ...counts })
export const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))
