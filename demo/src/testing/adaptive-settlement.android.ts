// Fixture-only observation. Never drive the native drawer or retry an action.
declare const androidx: {
  drawerlayout: {
    widget: {
      DrawerLayout: { DrawerListener: new (methods: object) => object }
    }
  }
}

export function observeDrawerSettlement(host: any) {
  const native = host.nativeViewProtected
  let state = 0
  const events: { event: string; at: number; state: number }[] = []
  const record = (event: string) => {
    events.push({ event, at: Date.now(), state })
    if (events.length > 128) events.shift()
  }
  const listener = new androidx.drawerlayout.widget.DrawerLayout.DrawerListener({
    onDrawerStateChanged(value: number) {
      state = value
      record('state')
    },
    onDrawerOpened() {
      record('opened')
    },
    onDrawerClosed() {
      record('closed')
    },
    onDrawerSlide() {},
  })
  native.addDrawerListener(listener)
  return {
    async wait() {
      const started = Date.now()
      let idleSamples = 0
      while (Date.now() - started < 3000) {
        // STATE_IDLE is reported after DrawerLayout dispatches its endpoint
        // callback. A requested layout must also finish before reading bounds.
        const idle = state === 0 && native.isLaidOut() && !native.isLayoutRequested()
        idleSamples = idle ? idleSamples + 1 : 0
        if (idleSamples === 2)
          return {
            elapsedMs: Date.now() - started,
            state,
            events: [...events],
          }
        await new Promise((resolve) => setTimeout(resolve, 16))
      }
      throw new Error(
        `Drawer did not settle within 3000ms: ${JSON.stringify({
          state,
          layoutRequested: native.isLayoutRequested(),
          events,
        })}`,
      )
    },
    dispose() {
      native.removeDrawerListener(listener)
    },
  }
}
