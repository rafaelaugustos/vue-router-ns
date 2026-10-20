import { describe, expect, it, vi } from 'vitest'
import { coreBackPreview } from '../src/core-back-preview.js'

function setup(version = 1) {
  const top = {} as any
  const below = {} as any
  let active = true
  let finish!: (value: boolean) => void
  let onDispose = () => {}
  const session = {
    version,
    get active() {
      return active
    },
    update: vi.fn(),
    cancel: vi.fn(),
    finish: vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve
        }),
    ),
    dispose: vi.fn(() => {
      if (!active) return
      active = false
      onDispose()
    }),
  }
  const frame = {
    currentPage: top,
    backStack: [{ resolvedPage: below }],
    beginBackPreview: vi.fn((options) => {
      onDispose = options.onDispose
      return session
    }),
  } as any
  const goBack = vi.fn(async (): Promise<unknown> => undefined)
  const disposed = vi.fn()
  const preview = coreBackPreview(frame, top, below, goBack, disposed)
  return {
    frame,
    top,
    below,
    session,
    goBack,
    disposed,
    preview,
    finish: (value: boolean) => finish(value),
  }
}
const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('experimental Core back preview adapter', () => {
  it('falls back when the API or target is unavailable', () => {
    const { frame, top, below } = setup()
    delete frame.beginBackPreview
    expect(coreBackPreview(frame, top, below, vi.fn(), vi.fn())).toBeUndefined()
    frame.beginBackPreview = vi.fn()
    frame.backStack = []
    expect(coreBackPreview(frame, top, below, vi.fn(), vi.fn())).toBeUndefined()
    expect(frame.beginBackPreview).not.toHaveBeenCalled()
  })
  it('disposes an unsupported protocol before falling back', () => {
    const { preview, session, disposed } = setup(2)
    expect(preview).toBeUndefined()
    expect(session.dispose).toHaveBeenCalledOnce()
    expect(disposed).toHaveBeenCalledOnce()
  })
  it('forwards progress and cancellation without navigation', () => {
    const { preview, session, goBack } = setup()
    preview!.progress(0.6, 'right')
    preview!.cancel()
    expect(session.update).toHaveBeenCalledWith(0.6, 'right')
    expect(session.cancel).toHaveBeenCalledOnce()
    expect(goBack).not.toHaveBeenCalled()
  })
  it('waits for finishing and navigates at most once', async () => {
    const { preview, session, goBack, finish } = setup()
    preview!.commit()
    preview!.commit()
    expect(goBack).not.toHaveBeenCalled()
    finish(true)
    await flush()
    expect(session.finish).toHaveBeenCalledOnce()
    expect(goBack).toHaveBeenCalledOnce()
    expect(session.dispose).toHaveBeenCalledOnce()
  })
  it.each(['interrupted', 'replaced', 'disposed'])(
    'does not navigate when %s during finishing',
    async (reason) => {
      const { preview, frame, goBack, finish } = setup()
      preview!.commit()
      if (reason === 'replaced') frame.currentPage = {}
      if (reason === 'disposed') preview!.dispose()
      finish(reason !== 'interrupted')
      await flush()
      expect(goBack).not.toHaveBeenCalled()
    },
  )
  it.each(['refused', 'error'])(
    'restores the preview when navigation is %s',
    async (reason) => {
      const { preview, session, goBack, finish } = setup()
      if (reason === 'refused') goBack.mockResolvedValue({ type: 'aborted' })
      else goBack.mockRejectedValue(new Error('guard failed'))
      preview!.commit()
      finish(true)
      await flush()
      expect(session.cancel).toHaveBeenCalledOnce()
    },
  )
})
