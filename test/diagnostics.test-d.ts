import { expectTypeOf, it } from 'vitest'
import {
  createRouter,
  type RouterDiagnostics,
  type DiagnosticSnapshot,
} from '../src/index.js'

it('exports readonly, handle-free diagnostic data without changing route inference', () => {
  const router = createRouter({
    routes: [{ path: '/items/:id', name: 'item' }],
    diagnostics: { maxEvents: 100 },
  })
  expectTypeOf(router.diagnostics).toEqualTypeOf<RouterDiagnostics | undefined>()
  router.push({ name: 'item', params: { id: 42 } })
  // @ts-expect-error required route parameter is still enforced
  router.push({ name: 'item' })
  const snapshot: DiagnosticSnapshot = router.diagnostics!.snapshot()
  // @ts-expect-error snapshot history is readonly
  snapshot.stacks.push({})
  // @ts-expect-error native handles are not exposed
  snapshot.stacks[0]!.native[0]!.frame
  // @ts-expect-error diagnostic records are readonly
  router.diagnostics!.events[0]!.time = 0
  expectTypeOf(router.diagnostics!.toJSON().version).toEqualTypeOf<1>()
})
