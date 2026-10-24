import type { DiagnosticEvent, DiagnosticsExport } from '../../src/diagnostics.js'

/** Explicitly synthetic teaching reports, not device performance benchmarks. */
export function examples(): { name: string; report: DiagnosticsExport }[] {
  const routerId = 'router-example',
    stackId = 'stack-main',
    windowId = 'window-1'
  const events: DiagnosticEvent[] = []
  let span = 0
  function add(
    navigationId: number,
    phase: DiagnosticEvent['phase'],
    time: number,
    duration: number,
    outcome: DiagnosticEvent['outcome'] = 'success',
    parentNavigationId?: number,
  ) {
    const spanId = ++span
    const data = {
      routerId,
      stackId,
      windowId,
      navigationId,
      parentNavigationId,
      phase,
      spanId,
      operation: 'push' as const,
      route: '/products/:id',
      detail: phase === 'guard' ? 'beforeEach' : undefined,
    }
    events.push(
      { ...data, id: 0, time, status: 'start' },
      { ...data, id: 0, time: time + duration, status: 'end', duration, outcome },
    )
  }
  add(1, 'navigation', 0, 480)
  add(1, 'guard', 10, 350)
  add(1, 'load', 360, 20)
  add(1, 'transition', 380, 100)
  add(1, 'mount', 380, 80)
  add(2, 'navigation', 510, 35, 'aborted')
  add(2, 'guard', 510, 35, 'aborted')
  add(3, 'navigation', 600, 15, 'redirected')
  add(3, 'guard', 600, 15, 'redirected')
  add(4, 'navigation', 620, 60, 'success', 3)
  add(4, 'mount', 625, 20, 'success', 3)
  add(5, 'navigation', 710, 100, 'cancelled')
  add(5, 'guard', 715, 95, 'cancelled')
  add(6, 'navigation', 750, 80)
  add(6, 'mount', 755, 30)
  events
    .sort((a, b) => a.time - b.time)
    .forEach((event, index) => {
      ;(event as { id: number }).id = index + 1
    })
  const report: DiagnosticsExport = {
    version: 1,
    routerId,
    clock: 'monotonic',
    startedAt: Date.UTC(2026, 9, 24, 12),
    droppedEvents: 0,
    events,
    snapshot: {
      routerId,
      time: 900,
      stopped: false,
      stacks: [
        {
          id: stackId,
          name: 'Catalog',
          modal: false,
          busy: false,
          logical: [
            { id: 'entry-home', route: '/', active: false, awaitingResult: false },
            {
              id: 'entry-product',
              route: '/products/:id',
              active: true,
              awaitingResult: true,
            },
          ],
          native: [
            {
              id: 'host-main',
              role: 'main',
              windowId,
              loaded: true,
              entries: ['entry-home', null],
            },
          ],
        },
      ],
      issues: [
        { code: 'stack-mismatch', stackId },
        { code: 'unknown-native-page', stackId, hostId: 'host-main' },
      ],
    },
  }
  const truncated: DiagnosticsExport = {
    ...report,
    droppedEvents: 120,
    events: [
      {
        id: 121,
        routerId,
        stackId,
        windowId,
        time: 800,
        phase: 'guard',
        status: 'end',
        spanId: 40,
        navigationId: 11,
        duration: 350,
        outcome: 'success',
      },
      {
        id: 122,
        routerId,
        stackId,
        windowId,
        time: 820,
        phase: 'navigation',
        status: 'start',
        spanId: 41,
        navigationId: 12,
      },
    ],
    snapshot: {
      ...report.snapshot,
      stacks: report.snapshot.stacks.map((stack) => ({ ...stack, busy: true })),
      issues: [],
    },
  }
  const secondary: DiagnosticsExport = {
    ...report,
    routerId: 'router-secondary',
    events: [],
    snapshot: {
      routerId: 'router-secondary',
      time: 200,
      stopped: true,
      issues: [],
      stacks: [
        {
          id: stackId,
          name: 'Inspector',
          modal: false,
          busy: false,
          logical: [
            {
              id: 'entry-home',
              route: '/inspector',
              active: true,
              awaitingResult: false,
            },
          ],
          native: [
            {
              id: 'host-main',
              role: 'main',
              loaded: true,
              windowId: 'window-2',
              entries: ['entry-home'],
            },
          ],
        },
      ],
    },
  }
  return [
    { name: '01 · Navigation investigation', report },
    { name: '02 · Truncated buffer', report: truncated },
    { name: '03 · Independent window', report: secondary },
  ]
}
