import { describe, expect, it, vi } from 'vitest'
import {
  createRouter,
  type DiagnosticRecord,
  type RouterDiagnostics,
} from '../src/index.js'
import { createDiagnostics } from '../src/diagnostics.js'
import { createRecording } from '../src/diagnostic-recording.js'
import { parseReport } from '../tools/diagnostics-viewer/model.js'
import { mount, page, settle } from './helpers.js'
import { Page, TabView, TabViewItem } from './shims/core.js'

const routes = [
  { path: '/', component: page('Home') },
  { path: '/items/:id', component: page('Item') },
  { path: '/blocked', component: page('Blocked'), beforeEnter: () => false },
  { path: '/modal', component: page('Modal'), modal: true },
] as const
type Checkpoint = Extract<DiagnosticRecord, { kind: 'checkpoint' }>
const checkpoints = (d: RouterDiagnostics) =>
  d.recording()!.records.filter((r): r is Checkpoint => r.kind === 'checkpoint')

describe('experimental diagnostic recording', () => {
  it('leaves v1 and its importer unchanged and does not inspect sources without opt-in', () => {
    const source = vi.fn(() => [])
    const d = createDiagnostics({}, source, () => undefined).api
    expect(d.recording()).toBeUndefined()
    d.checkpoint()
    expect(source).not.toHaveBeenCalled()
    expect(parseReport(d.export()).version).toBe(1)
    const recorded = createRouter({
      routes,
      diagnostics: { recording: true },
    }).diagnostics!
    expect(recorded.toJSON().version).toBe(1)
    expect(parseReport(recorded.export()).snapshot.stacks).toEqual([])
    expect(recorded.recording()!.version).toBe(2)
    expect(checkpoints(recorded)[0]).toMatchObject({
      boundary: 'initial',
      sequence: 1,
      snapshot: { stacks: [] },
    })
  })

  it('observes native ordering before reconciliation, retaining exact identities after a native pop', async () => {
    const { router, frame, app } = await mount(routes, {
      diagnostics: { recording: true },
    })
    const d = router.diagnostics!
    await router.push('/items/private-value?secret=private-query', {
      props: { secret: 'private-prop' },
    })
    const prior = checkpoints(d).at(-1)!.snapshot.stacks[0]!
    d.clear()
    frame().popNatively()
    const before = checkpoints(d).find((r) => r.boundary === 'reconcile-before')!.snapshot
      .stacks[0]!
    const after = checkpoints(d).findLast((r) => r.boundary === 'reconcile-after')!
      .snapshot.stacks[0]!
    expect(before.logical).toHaveLength(2)
    expect(before.native[0]!.entries).toEqual([prior.logical[0]!.id])
    expect(after.logical.map((e) => e.id)).toEqual(before.native[0]!.entries)
    expect([before.id, before.native[0]!.id]).toEqual([prior.id, prior.native[0]!.id])
    expect(JSON.stringify(d.recording())).not.toContain('private-')
    app.unmount()
  })

  it('retains intermediate divergence even after native recovery', async () => {
    const { router, frame, app } = await mount(routes, {
      diagnostics: { recording: true },
    })
    const d = router.diagnostics!
    frame().navigate({ create: () => new Page(), animated: false })
    await settle()
    frame().goBack()
    await settle()
    const divergent = checkpoints(d).find(
      (r) =>
        r.boundary === 'reconcile-after' &&
        r.snapshot.issues.some((i) => i.code === 'unknown-native-page'),
    )!
    expect(divergent.snapshot.stacks[0]!.native[0]!.entries).toContain(null)
    expect(divergent.snapshot.stacks[0]!.logical).toHaveLength(1)
    expect(checkpoints(d).at(-1)!.snapshot.issues).toEqual([])
    expect(Object.isFrozen(divergent.snapshot.stacks[0]!.native[0]!.entries)).toBe(true)
    app.unmount()
  })

  it('correlates overlapping guard outcomes and modal lifetime without payloads', async () => {
    const { router, app } = await mount(routes, {
      diagnostics: { recording: { maxRecords: 1000 } },
    })
    const d = router.diagnostics!
    let release!: () => void
    router.beforeEach((to) =>
      to.params.id === 'slow'
        ? new Promise<void>((resolve) => {
            release = resolve
          })
        : undefined,
    )
    await router.push('/blocked')
    const pending = router.push('/items/slow')
    await settle()
    await router.push('/items/fast')
    release()
    await pending
    const result = router.pushForResult('/modal')
    await settle()
    const modal = checkpoints(d)
      .at(-1)!
      .snapshot.stacks.find((s) => s.modal)!
    expect(modal.logical[0]!.awaitingResult).toBe(true)
    await router.back({ result: { secret: 'private-result' } })
    await result
    expect(
      checkpoints(d)
        .at(-1)!
        .snapshot.stacks.some((s) => s.id === modal.id),
    ).toBe(false)
    const events = d
      .recording()!
      .records.flatMap((r) => (r.kind === 'event' ? [r.event] : []))
    expect(
      events
        .filter((e) => e.phase === 'navigation' && e.status === 'end')
        .map((e) => e.outcome),
    ).toEqual(expect.arrayContaining(['aborted', 'cancelled', 'success']))
    expect(events.filter((e) => e.phase === 'result')).toHaveLength(1)
    expect(JSON.stringify(d.recording())).not.toContain('private-')
    app.unmount()
  })

  it('separates active entries, host visibility, tab selection, router focus and unknown input focus', async () => {
    const { router, frame, app } = await mount(routes, {
      diagnostics: { recording: true },
    })
    const tabs = new TabView(),
      item = new TabViewItem()
    tabs.children.push(item)
    item.parent = tabs
    frame().parent = item
    tabs.selectedIndex = 0
    router.diagnostics!.checkpoint()
    const selected = checkpoints(router.diagnostics!).at(-1)!
    expect(selected.observations[0]).toMatchObject({
      selected: true,
      routerFocused: true,
      inputFocused: null,
      tab: { index: 0, selectedIndex: 0 },
    })
    expect(selected.observations[0]!.hostVisible).toEqual([
      selected.snapshot.stacks[0]!.logical[0]!.id,
    ])
    tabs.selectedIndex = 1
    router.diagnostics!.checkpoint()
    expect(checkpoints(router.diagnostics!).at(-1)!.observations[0]).toMatchObject({
      selected: false,
      tab: { id: selected.observations[0]!.tab!.id, selectedIndex: 1 },
    })
    app.unmount()
  })

  it('bounds records and UTF-8 bytes, keeps independent checkpoints and exposes cleared epochs', async () => {
    const { router, app } = await mount(routes, {
      diagnostics: { maxEvents: 1, recording: { maxRecords: 7, maxBytes: 2400 } },
    })
    const d = router.diagnostics!
    for (let i = 0; i < 5; i++) await router.replace(`/items/${i}`)
    const first = d.recording()!
    expect(first.records.length).toBeLessThanOrEqual(7)
    expect(first.retainedBytes).toBe(Buffer.byteLength(JSON.stringify(first.records)))
    expect(first.retainedBytes).toBeLessThanOrEqual(2400)
    expect(first.droppedRecords).toBeGreaterThan(0)
    expect(first.records[0]!.sequence).toBeGreaterThan(1)
    expect(checkpoints(d).at(-1)!.snapshot.stacks[0]!.logical).toHaveLength(1)
    d.clear()
    const cleared = d.recording()!
    expect(cleared.epoch).toBe(1)
    expect(cleared.clearedRecords).toBe(first.records.length)
    expect(cleared.droppedRecords).toBe(first.droppedRecords)
    expect(cleared.captureId).toBe(first.captureId)
    expect(cleared.records[0]).toMatchObject({ kind: 'gap', reason: 'cleared', epoch: 1 })
    expect(cleared.records[0]!.sequence).toBeGreaterThan(first.records.at(-1)!.sequence)
    expect(first.records).not.toEqual(cleared.records)
    expect(cleared.overhead.samples).toBeGreaterThan(0)
    expect(cleared.overhead.totalMs).toBeGreaterThanOrEqual(cleared.overhead.maxMs)
    app.unmount()
  })

  it('marks oversized Unicode records and failed inspections as gaps without partial states or exceptions', () => {
    const buffer = createRecording(
      { maxBytes: 1024 },
      { routerId: 'r', startedAt: 1 },
      () => 0,
    )
    buffer.append({
      kind: 'event',
      time: 0,
      event: {
        id: 1,
        routerId: 'r',
        time: 0,
        phase: 'navigation',
        status: 'event',
        route: '😀'.repeat(300),
      },
    })
    expect(buffer.read(false).records[0]).toMatchObject({
      kind: 'gap',
      reason: 'oversized',
      eventId: 1,
    })
    for (let i = 0; i < 10; i++)
      buffer.append({
        kind: 'event',
        time: i,
        event: {
          id: i + 2,
          routerId: 'r',
          time: i,
          phase: 'navigation',
          status: 'event',
          route: '😀/漢字/é',
        },
      })
    const report = buffer.read(false)
    expect(report.retainedBytes).toBe(Buffer.byteLength(JSON.stringify(report.records)))
    expect(report.retainedBytes).toBeLessThanOrEqual(1024)
    const source = vi.fn(() => {
      throw new Error('private-exception')
    })
    const d = createDiagnostics({ recording: true }, source, () => undefined).api
    expect(d.recording()!.records[0]).toMatchObject({
      kind: 'gap',
      reason: 'inspection-failed',
      boundary: 'initial',
    })
    expect(JSON.stringify(d.recording())).not.toContain('private-exception')
    expect(() => d.checkpoint()).not.toThrow()
  })

  it('releases sources on stop and never samples, resumes or executes navigation when reading recordings', () => {
    const source = vi.fn(() => [])
    const d = createDiagnostics({ recording: true }, source, () => undefined).api
    d.stop()
    source.mockClear()
    const report = d.recording()!
    d.checkpoint()
    d.stop()
    expect(d.recording()).toEqual(report)
    expect(report.stopped).toBe(true)
    expect(report.records.at(-1)).toMatchObject({ boundary: 'stop' })
    expect(source).not.toHaveBeenCalled()
    expect(Object.isFrozen(report.records)).toBe(true)
  })

  it('rejects invalid capacities at setup', () => {
    for (const maxRecords of [0, -1, 1.5, NaN, Infinity, 10001])
      expect(() =>
        createRouter({ routes, diagnostics: { recording: { maxRecords } } }),
      ).toThrow('maxRecords')
    for (const maxBytes of [0, 1023, 1024.5, NaN, Infinity, 8388609])
      expect(() =>
        createRouter({ routes, diagnostics: { recording: { maxBytes } } }),
      ).toThrow('maxBytes')
  })
})
