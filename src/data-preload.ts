import {
  lease,
  settledPreload,
  type RoutePreload,
  type RoutePreloadCancelReason,
} from './preload.js'
import type { RouteLoader, RouteLoaderContext, RouteLoaderPreload } from './route-data.js'
import type { RouteLocation, RouteRecord } from './types.js'

/** Separate budgets for speculative loader invocations/retained results, not bytes or app caches. */
export interface RouteDataPreloadOptions {
  /** Maximum executing speculative loaders. Default: 2. */
  concurrency?: number
  /** Maximum pending/ready loader jobs retained by this router. Default: 16. */
  maxEntries?: number
  /** Lifetime from first request, including queue/loading time, in ms. Default: 30_000. */
  ttl?: number
}

type Result =
  { kind: 'value'; value: unknown } | { kind: 'fallback' } | { kind: 'cancelled' }
export interface PreparedRouteData {
  result: Promise<Result>
  invalid(): RoutePreloadCancelReason | undefined
  release(): void
}
interface Job {
  to: RouteLocation
  from: RouteLocation
  loader: RouteLoader
  load: RouteLoader['load']
  policy: Readonly<RouteLoaderPreload>
  scope: object
  records: [RouteRecord, RouteRecord['component']][]
  consumers: Map<ReturnType<typeof lease>, object>
  entries: number
  state: 'queued' | 'loading' | 'ready'
  valid: boolean
  completed: boolean
  reason?: RoutePreloadCancelReason
  expires: number
  timer?: ReturnType<typeof setTimeout>
  callbacks: Set<() => void>
  result: Promise<Result>
  resolve(value: Result): void
}
const sameRoute = (a: RouteLocation, b: RouteLocation) =>
  a.fullPath === b.fullPath &&
  a.matched.length === b.matched.length &&
  a.matched.every((record, index) => record === b.matched[index])

export function createDataPreloader(
  options: RouteDataPreloadOptions = {},
  declared: (loader: RouteLoader, to: RouteLocation) => boolean,
) {
  const budget = (value: number, name: string) => {
    if (!Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647)
      throw new Error(
        `preloadData.${name} must be a positive finite integer (at most 2147483647)`,
      )
    return value
  }
  const concurrency = budget(options.concurrency ?? 2, 'concurrency')
  const maxEntries = budget(options.maxEntries ?? 16, 'maxEntries')
  const ttl = budget(options.ttl ?? 30_000, 'ttl')
  const jobs = new Set<Job>()
  const running = new Set<Job>()
  let stopped = false
  function permitted(
    policy: Readonly<RouteLoaderPreload>,
    to: RouteLocation,
    from: RouteLocation,
  ) {
    const result: unknown = policy.authorize({ to, from })
    // JS consumers can accidentally supply an async policy. Deny it and observe rejection.
    if (result && typeof (result as PromiseLike<unknown>).then === 'function')
      void Promise.resolve(result).catch(() => {})
    return result === true
  }
  const invoke = (callback: () => void) => {
    try {
      callback()
    } catch (error) {
      if (__DEV__) console.warn('[vue-router-ns] cancelling prepared data failed:', error)
    }
  }
  function invalid(job: Job): RoutePreloadCancelReason | undefined {
    // Account/permission changes take precedence over expiry/fallback.
    try {
      if (
        job.loader.load !== job.load ||
        job.loader.preload !== job.policy ||
        job.policy.scope() !== job.scope ||
        !declared(job.loader, job.to) ||
        job.records.some(([record, raw]) => record.component !== raw)
      )
        return 'invalidated'
      if (!permitted(job.policy, job.to, job.from)) return 'unauthorized'
    } catch {
      return 'invalidated'
    }
    return job.reason ?? (Date.now() >= job.expires ? 'expired' : undefined)
  }
  function drop(job: Job, reason: RoutePreloadCancelReason) {
    if (!job.valid) return
    job.valid = false
    job.reason = reason
    jobs.delete(job)
    clearTimeout(job.timer)
    job.resolve({
      kind: reason === 'expired' || reason === 'capacity' ? 'fallback' : 'cancelled',
    })
    const callbacks = [...job.callbacks]
    job.callbacks.clear()
    const consumers = [...job.consumers.keys()]
    job.consumers.clear()
    for (const consumer of consumers) consumer.publish({ status: 'cancelled', reason })
    if (!job.completed) for (const callback of callbacks) invoke(callback)
  }
  function prune() {
    for (const job of [...jobs]) {
      const reason = invalid(job)
      if (reason) drop(job, reason)
    }
  }
  function start(job: Job, speculative: boolean) {
    if (!job.valid || job.state !== 'queued') return
    job.state = 'loading'
    if (speculative) running.add(job)
    for (const consumer of job.consumers.keys()) consumer.publish({ status: 'loading' })
    const context: RouteLoaderContext = {
      to: job.to,
      from: job.from,
      preloading: true,
      isCancelled: () => !job.valid || !!invalid(job),
      onCancel(callback) {
        if (!job.valid || invalid(job)) invoke(callback)
        else if (!job.completed) job.callbacks.add(callback)
        return () => {
          job.callbacks.delete(callback)
        }
      },
    }
    void Promise.resolve()
      .then(() => {
        const reason = invalid(job)
        if (reason) drop(job, reason)
        if (job.valid) return job.load(context)
      })
      .then(
        (value) => {
          const reason = invalid(job)
          if (reason) drop(job, reason)
          if (!job.valid) return
          job.completed = true
          job.callbacks.clear()
          job.state = 'ready'
          job.resolve({ kind: 'value', value })
          for (const consumer of job.consumers.keys())
            consumer.publish({ status: 'ready' })
        },
        (error: unknown) => {
          const reason = invalid(job)
          if (reason) drop(job, reason)
          if (!job.valid) return
          job.completed = true
          job.valid = false
          jobs.delete(job)
          clearTimeout(job.timer)
          job.callbacks.clear()
          job.resolve({ kind: 'fallback' })
          const consumers = [...job.consumers.keys()]
          job.consumers.clear()
          for (const consumer of consumers) consumer.publish({ status: 'error', error })
        },
      )
      .finally(() => {
        running.delete(job)
        pump()
      })
  }
  function pump() {
    prune()
    if (stopped) return
    for (const job of jobs) {
      if (running.size >= concurrency) break
      if (job.state === 'queued') start(job, true)
    }
  }
  const find = (loader: RouteLoader, to: RouteLocation, from: RouteLocation) =>
    [...jobs].find(
      (job) =>
        job.loader === loader && sameRoute(job.to, to) && sameRoute(job.from, from),
    )
  function unused(job: Job) {
    if (!job.consumers.size && !job.entries) drop(job, 'cancelled')
  }
  return {
    preload(
      loader: RouteLoader,
      to: RouteLocation,
      from: RouteLocation,
      owner: object,
    ): RoutePreload {
      if (stopped) return settledPreload({ status: 'cancelled', reason: 'disposed' })
      prune()
      try {
        if (!declared(loader, to))
          throw new Error(
            'The prepared loader must be declared in the destination route metadata',
          )
        const policy = loader.preload
        if (!policy)
          throw new Error('This route loader has not opted into data preloading')
        const scope = policy.scope()
        if (!scope) return settledPreload({ status: 'cancelled', reason: 'unauthorized' })
        if (typeof scope !== 'object' && typeof scope !== 'function')
          throw new Error('A data preload scope must be a stable object')
        if (!permitted(policy, to, from))
          return settledPreload({ status: 'cancelled', reason: 'unauthorized' })
        let job = find(loader, to, from)
        if (!job) {
          if (jobs.size >= maxEntries) {
            const ready = [...jobs].find(
              (candidate) => candidate.state === 'ready' && !candidate.entries,
            )
            if (ready) drop(ready, 'capacity')
            else return settledPreload({ status: 'cancelled', reason: 'capacity' })
          }
          let resolve!: Job['resolve']
          job = {
            to,
            from,
            loader,
            load: loader.load,
            policy,
            scope,
            records: to.matched.map((record) => [record, record.component]),
            consumers: new Map(),
            entries: 0,
            state: 'queued',
            valid: true,
            completed: false,
            expires: Date.now() + ttl,
            callbacks: new Set(),
            result: new Promise((done) => {
              resolve = done
            }),
            resolve: (value) => resolve(value),
          }
          const owned = job
          job.timer = setTimeout(() => {
            drop(owned, invalid(owned) ?? 'expired')
            pump()
          }, ttl)
          if (typeof job.timer === 'object')
            (job.timer as { unref?: () => void }).unref?.()
          jobs.add(job)
        } else {
          jobs.delete(job)
          jobs.add(job)
        }
        const owned = job,
          consumer = lease({ status: job.state })
        job.consumers.set(consumer, owner)
        consumer.onCancel(() => {
          owned.consumers.delete(consumer)
          unused(owned)
          pump()
        })
        pump()
        return consumer.handle
      } catch (error) {
        return settledPreload({ status: 'error', error })
      }
    },
    acquire(
      loader: RouteLoader,
      to: RouteLocation,
      from: RouteLocation,
    ): PreparedRouteData | undefined {
      prune()
      const job = find(loader, to, from)
      if (!job) return
      job.entries++
      start(job, false)
      let released = false
      return {
        result: job.result,
        invalid: () => invalid(job),
        release() {
          if (released) return
          released = true
          job.entries--
          unused(job)
          pump()
        },
      }
    },
    cancelOwner(owner: object) {
      for (const job of [...jobs]) {
        for (const [consumer, value] of [...job.consumers])
          if (value === owner) {
            job.consumers.delete(consumer)
            consumer.publish({ status: 'cancelled', reason: 'disposed' })
          }
        unused(job)
      }
      pump()
    },
    invalidate() {
      prune()
      pump()
    },
    clear(reason: RoutePreloadCancelReason = 'invalidated') {
      for (const job of [...jobs]) drop(job, reason)
    },
    dispose() {
      stopped = true
      this.clear('disposed')
    },
  }
}
