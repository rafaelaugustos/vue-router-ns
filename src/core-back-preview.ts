import type { Frame, Page } from '@nativescript/core'
import type { BackGestureEdge } from './android.js'
import type { BackPreview } from './back-preview.js'

/** Experimental Core proposal, feature-detected without requiring an unpublished dependency. */
interface CorePreview {
  readonly version: number
  readonly active: boolean
  update(progress: number, edge: BackGestureEdge): void
  cancel(): void
  finish(): Promise<boolean>
  dispose(): void
}

type PreviewFrame = Frame & {
  beginBackPreview?: (options: { onDispose: () => void }) => CorePreview | undefined
}

export function coreBackPreview(
  frame: Frame,
  top: Page,
  below: Page,
  goBack: () => Promise<unknown>,
  onDispose: () => void,
): BackPreview | undefined {
  if (frame.currentPage !== top || frame.backStack.at(-1)?.resolvedPage !== below)
    return undefined
  const session = (frame as PreviewFrame).beginBackPreview?.({ onDispose })
  if (!session) return undefined
  if (session.version !== 1) {
    session.dispose()
    return undefined
  }
  let committed = false
  return {
    get active() {
      return session.active
    },
    progress: (progress, edge) => session.update(progress, edge),
    cancel: () => session.cancel(),
    dispose: () => session.dispose(),
    commit() {
      if (committed || !session.active) return
      committed = true
      void session.finish().then(
        async (finished) => {
          if (!finished || !session.active) return
          if (
            frame.currentPage !== top ||
            frame.backStack.at(-1)?.resolvedPage !== below
          ) {
            session.dispose()
            return
          }
          try {
            if (await goBack()) session.cancel()
            else session.dispose()
          } catch {
            session.cancel()
          }
        },
        () => session.dispose(),
      )
    },
  }
}
