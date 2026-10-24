import { describe, expect, it } from 'vitest'
import {
  compareStack,
  filterTimeline,
  MAX_BYTES,
  parseReport,
  timeline,
  windowIds,
} from '../tools/diagnostics-viewer/model.js'
import { examples } from '../tools/diagnostics-viewer/examples.js'
import { mount, page, settle } from './helpers.js'
import { Page } from './shims/core.js'

const example = () => examples()[0]!.report
const parse = (value: unknown) => parseReport(JSON.stringify(value))

describe('standalone diagnostics viewer', () => {
  it('reads the actual collector export without adding route values or changing collection', async () => {
    const { router, app, frame } = await mount(
      [
        { path: '/', component: page('Home') },
        { path: '/items/:id', component: page('Item') },
        { path: '/blocked', component: page('Blocked'), beforeEnter: () => false },
      ],
      { diagnostics: true },
    )
    try {
      await router.push('/items/private-id?token=private-token', {
        props: { secret: 'private-prop' },
      })
      await router.push('/blocked')
      frame().navigate({ create: () => new Page() })
      await settle()
      const exported = router.diagnostics!.export()
      const report = parseReport(exported)
      expect(JSON.parse(JSON.stringify(report))).toEqual(JSON.parse(exported))
      expect(
        report.snapshot.issues.some((issue) => issue.code === 'unknown-native-page'),
      ).toBe(true)
      expect(compareStack(report.snapshot.stacks[0]!).some((row) => row.differs)).toBe(
        true,
      )
      const rows = timeline(report)
      expect(rows.some((row) => row.event.outcome === 'aborted')).toBe(true)
      expect(
        rows
          .filter((row) => row.event.status !== 'event')
          .every((row) => row.completeness === 'complete'),
      ).toBe(true)
      expect(router.diagnostics!.export()).not.toContain('private-')
      expect(JSON.stringify(report)).not.toContain('private-')
    } finally {
      app.unmount()
    }
  })

  it.each([
    [
      'version',
      (r: any) => {
        r.version = 2
      },
      /Unsupported diagnostics version/,
    ],
    [
      'clock',
      (r: any) => {
        r.clock = 'wall'
      },
      /report.clock/,
    ],
    [
      'missing snapshot',
      (r: any) => {
        delete r.snapshot
      },
      /snapshot/,
    ],
    [
      'foreign router',
      (r: any) => {
        r.events[0].routerId = 'other'
      },
      /routerId/,
    ],
    [
      'foreign snapshot',
      (r: any) => {
        r.snapshot.routerId = 'other'
      },
      /routerId/,
    ],
    [
      'unsafe duration',
      (r: any) => {
        r.events[1].duration = 1e100
      },
      /duration/,
    ],
    [
      'negative timestamp',
      (r: any) => {
        r.events[0].time = -1
      },
      /time/,
    ],
    [
      'unknown phase',
      (r: any) => {
        r.events[0].phase = 'secret-payload'
      },
      /phase/,
    ],
    [
      'missing span ID',
      (r: any) => {
        delete r.events[0].spanId
      },
      /spanId/,
    ],
    [
      'duplicate event IDs',
      (r: any) => {
        r.events[1].id = r.events[0].id
      },
      /unique/,
    ],
    [
      'malformed entry',
      (r: any) => {
        r.snapshot.stacks[0].logical[0].active = 'yes'
      },
      /active/,
    ],
    [
      'malformed host',
      (r: any) => {
        r.snapshot.stacks[0].native[0].entries = {}
      },
      /entries/,
    ],
    [
      'unknown issue',
      (r: any) => {
        r.snapshot.issues[0].code = 'secret-payload'
      },
      /code/,
    ],
  ])(
    'rejects %s with a field-level error, without reflecting imported values',
    (_name, mutate, error) => {
      const report = structuredClone(example())
      mutate(report)
      expect(() => parse(report)).toThrow(error)
      try {
        parse(report)
      } catch (error) {
        expect(String(error)).not.toContain('secret-payload')
      }
    },
  )

  it('contains malformed, oversized and excessive-event imports', () => {
    expect(() => parseReport('{')).toThrow('Invalid JSON')
    expect(() => parseReport(' '.repeat(MAX_BYTES + 1))).toThrow('10 MiB')
    expect(() => parse(null)).toThrow('an object')
    const report = example()
    expect(() =>
      parse({ ...report, events: Array(10_001).fill(report.events[0]) }),
    ).toThrow('at most 10000')
  })

  it('copies only the public schema, with no arbitrary nested data or prototype merging', () => {
    const report = structuredClone(example()) as any
    report.params = { token: 'DO_NOT_COPY' }
    report.events[0].error = { message: 'DO_NOT_COPY' }
    report.snapshot.stacks[0].logical[0].props = { secret: 'DO_NOT_COPY' }
    report.snapshot.stacks[0].native[0].handle = { secret: 'DO_NOT_COPY' }
    report.snapshot.stacks[0].name = '<img src=x onerror=alert(1)>'
    const result = parse(report)
    expect(JSON.stringify(result)).not.toContain('DO_NOT_COPY')
    expect(result.snapshot.stacks[0]!.name).toBe('<img src=x onerror=alert(1)>') // UI renders text, not markup.
  })

  it('pairs interleaved spans by ID and retains redirect parents without summing overlap', () => {
    const rows = timeline(parse(example()))
    const phase = (navigationId: number, phase: string) =>
      rows.find(
        (row) => row.event.navigationId === navigationId && row.event.phase === phase,
      )!
    expect(phase(1, 'guard').duration).toBe(350)
    expect(phase(1, 'mount').duration).toBe(80)
    expect(phase(1, 'transition').duration).toBe(100)
    expect(phase(1, 'navigation').duration).toBe(480)
    expect(phase(5, 'navigation').end).toBeGreaterThan(phase(6, 'navigation').start)
    expect(phase(4, 'navigation').event.parentNavigationId).toBe(3)
    expect(filterTimeline(rows, { phase: 'guard', outcome: 'aborted' })).toHaveLength(1)
    expect(
      filterTimeline(rows, { navigation: '4' }).every(
        (row) => row.event.parentNavigationId === 3,
      ),
    ).toBe(true)
  })

  it('does not invent a start or duration from truncated or unfinished spans', () => {
    const report = parse(examples()[1]!.report),
      rows = timeline(report)
    expect(rows[0]).toMatchObject({
      completeness: 'missing-start',
      start: 800,
      duration: 350,
    })
    expect(rows[0]!.end).toBeUndefined()
    expect(rows[1]).toMatchObject({ completeness: 'missing-end', start: 820 })
    expect(rows[1]!.duration).toBeUndefined()
    expect(compareStack(report.snapshot.stacks[0]!).some((row) => row.differs)).toBe(
      false,
    )
  })

  it('marks conflicting span boundaries as ambiguous instead of assigning a false duration', () => {
    const report = structuredClone(example()) as any
    const start = report.events.find(
      (event: any) => event.phase === 'guard' && event.status === 'start',
    )
    report.events.push({ ...start, id: 1000, time: start.time + 1 })
    const rows = timeline(parse(report)).filter(
      (row) => row.event.spanId === start.spanId,
    )
    expect(rows).toHaveLength(3)
    expect(
      rows.every((row) => row.completeness === 'ambiguous' && row.duration === undefined),
    ).toBe(true)
  })

  it('keeps colliding IDs in independent reports separate and supports absent windows/empty buffers', () => {
    const a = parse(example()),
      b = parse(examples()[2]!.report)
    expect(a.snapshot.stacks[0]!.id).toBe(b.snapshot.stacks[0]!.id)
    expect(timeline(b)).toEqual([])
    expect(windowIds(a)).toEqual(['window-1'])
    expect(windowIds(b)).toEqual(['window-2'])
    expect(compareStack(b.snapshot.stacks[0]!).some((row) => row.differs)).toBe(false)
    const missing = structuredClone(b) as any
    delete missing.snapshot.stacks[0].native[0].windowId
    expect(windowIds(parse(missing))).toEqual(['(unknown)'])
  })
})
