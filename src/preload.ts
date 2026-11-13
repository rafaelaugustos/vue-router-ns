import { computed, shallowRef, type ComputedRef } from 'nativescript-vue'
import type { RouteComponent, RouteRecord } from './types.js'

/** Experimental. Budgets apply to speculative code, not navigation or the JS module cache. */
export interface RoutePreloadOptions {
  /** Simultaneous speculative factories. Default: 2. Navigation does not wait for unrelated work. */
  concurrency?: number
  /** Pending/ready route records retained by this router. Default: 16. */
  maxEntries?: number
  /** Maximum lease lifetime from the first request, in milliseconds. Default: 30_000. */
  ttl?: number
}
export type RoutePreloadCancelReason =
  'cancelled' | 'expired' | 'invalidated' | 'disposed' | 'capacity' | 'unauthorized'
export type RoutePreloadResult =
  | { readonly status: 'ready' }
  | { readonly status: 'error'; readonly error: unknown }
  | { readonly status: 'cancelled'; readonly reason: RoutePreloadCancelReason }
export type RoutePreloadState =
  RoutePreloadResult | { readonly status: 'queued' } | { readonly status: 'loading' }
export interface RoutePreload {
  /** Live lease state. A ready lease can later expire, be invalidated or be cancelled. */
  readonly state: ComputedRef<RoutePreloadState>
  /** First ready/error/cancelled outcome; never rejects and never navigates. */
  readonly ready: Promise<RoutePreloadResult>
  /** Release this consumer. Imports cannot abort; data transport cancellation is cooperative. */
  cancel(): void
}

export function lease(initial: RoutePreloadState) {
  const state = shallowRef<RoutePreloadState>(Object.freeze(initial))
  let resolve!: (result: RoutePreloadResult) => void
  let settled = false
  let release: (() => void) | undefined
  const ready = new Promise<RoutePreloadResult>((done) => {
    resolve = done
  })
  const publish = (value: RoutePreloadState) => {
    if (value.status === 'cancelled' || value.status === 'error') release = undefined
    state.value = Object.freeze(value)
    if (value.status !== 'queued' && value.status !== 'loading' && !settled) {
      settled = true
      resolve(value)
    }
  }
  publish(initial)
  return {
    publish,
    onCancel(callback: () => void) {
      release = callback
    },
    handle: Object.freeze({
      state: computed(() => state.value),
      ready,
      cancel() {
        const callback = release
        if (!callback) return
        publish({ status: 'cancelled', reason: 'cancelled' })
        callback()
      },
    }) satisfies RoutePreload,
  }
}

/** A failed resolution/closed owner is an explicit outcome, not an unhandled rejection. */
export function settledPreload(result: RoutePreloadResult): RoutePreload {
  return lease(result).handle
}

interface Consumer {
  owner: object
  lease: ReturnType<typeof lease>
}
interface Job {
  record: RouteRecord
  raw: RouteRecord['component']
  consumers: Set<Consumer>
  navigation: number
  state: 'queued' | 'loading' | 'ready'
  value?: RouteComponent
  work?: Promise<RouteComponent>
  valid: boolean
  expires: number
  timer?: ReturnType<typeof setTimeout>
  result: Promise<RouteComponent | undefined>
  resolve: (value: RouteComponent | undefined) => void
}

/** Separate speculative retention from the router's ordinary, authorized component cache. */
export function createRoutePreloader(
  options: RoutePreloadOptions = {},
  source: {
    load(record: RouteRecord): Promise<RouteComponent>
    cached(record: RouteRecord): RouteComponent | undefined
    pending?(record: RouteRecord): Promise<RouteComponent> | undefined
    current(record: RouteRecord): boolean
  },
) {
  const concurrency = positive(options.concurrency ?? 2, 'concurrency')
  const maxEntries = positive(options.maxEntries ?? 16, 'maxEntries')
  const ttl = positive(options.ttl ?? 30_000, 'ttl')
  const jobs = new Map<RouteRecord, Job>()
  // Cancelled imports still occupy their slot until they actually settle.
  const running = new Set<Job>()
  let stopped = false

  const current = (job: Job) =>
    job.valid && job.raw === job.record.component && source.current(job.record)
  function drop(job: Job, reason: RoutePreloadCancelReason) {
    if (!job.valid) return
    job.valid = false
    if (jobs.get(job.record) === job) jobs.delete(job.record)
    clearTimeout(job.timer)
    job.value = undefined
    job.resolve(undefined)
    const consumers = [...job.consumers]
    job.consumers.clear()
    for (const consumer of consumers)
      consumer.lease.publish({ status: 'cancelled', reason })
  }
  function prune() {
    for (const job of [...jobs.values()]) {
      if (!current(job)) drop(job, 'invalidated')
      else if (Date.now() >= job.expires) drop(job, 'expired')
    }
  }
  function start(job: Job, speculative: boolean) {
    if (!current(job) || job.state !== 'queued') return
    job.state = 'loading'
    if (speculative) running.add(job)
    for (const consumer of job.consumers) consumer.lease.publish({ status: 'loading' })
    // Check again in the microtask: a synchronous cancellation must not execute a factory.
    void Promise.resolve()
      .then(() => (current(job) ? (job.work ?? source.load(job.record)) : undefined))
      .then(
        (value) => {
          if (!current(job) || Date.now() >= job.expires) {
            drop(job, current(job) ? 'expired' : 'invalidated')
            return
          }
          if (!value) return
          job.value = value
          job.state = 'ready'
          job.resolve(value)
          for (const consumer of job.consumers)
            consumer.lease.publish({ status: 'ready' })
        },
        (error: unknown) => {
          if (!job.valid) return
          if (!current(job) || Date.now() >= job.expires) {
            drop(job, current(job) ? 'expired' : 'invalidated')
            return
          }
          job.valid = false
          if (jobs.get(job.record) === job) jobs.delete(job.record)
          clearTimeout(job.timer)
          job.resolve(undefined)
          const consumers = [...job.consumers]
          job.consumers.clear()
          for (const consumer of consumers)
            consumer.lease.publish({ status: 'error', error })
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
    for (const job of jobs.values()) {
      if (running.size >= concurrency) break
      if (job.state === 'queued') start(job, true)
    }
  }
  return {
    preload(record: RouteRecord, owner: object): RoutePreload {
      if (stopped) return settledPreload({ status: 'cancelled', reason: 'disposed' })
      prune()
      let job = jobs.get(record)
      if (!job) {
        if (jobs.size >= maxEntries) {
          const oldestReady = [...jobs.values()].find(
            (candidate) => candidate.state === 'ready' && !candidate.navigation,
          )
          if (oldestReady) drop(oldestReady, 'capacity')
          else return settledPreload({ status: 'cancelled', reason: 'capacity' })
        }
        let resolve!: Job['resolve']
        const value = source.cached(record)
        job = {
          record,
          raw: record.component,
          consumers: new Set(),
          navigation: 0,
          state: value ? 'ready' : 'queued',
          value,
          work: source.pending?.(record),
          valid: true,
          expires: Date.now() + ttl,
          result: new Promise((done) => {
            resolve = done
          }),
          resolve: (value) => resolve(value),
        }
        const owned = job
        job.timer = setTimeout(() => {
          drop(owned, 'expired')
          pump()
        }, ttl)
        // Timers should not keep Node tooling alive; NativeScript timers are numeric.
        if (typeof job.timer === 'object') (job.timer as { unref?: () => void }).unref?.()
        jobs.set(record, job)
        if (value) job.resolve(value)
      } else {
        // LRU applies to prepared records; it never extends an existing lease's TTL.
        jobs.delete(record)
        jobs.set(record, job)
      }
      const owned = job
      const consumer = { owner, lease: lease({ status: job.state }) }
      job.consumers.add(consumer)
      consumer.lease.onCancel(() => {
        owned.consumers.delete(consumer)
        if (!owned.consumers.size && !owned.navigation) drop(owned, 'cancelled')
        pump()
      })
      // Existing authorized work is already running; subscribing starts no speculative factory.
      if (job.work) start(job, false)
      pump()
      return consumer.lease.handle
    },
    async consume(record: RouteRecord): Promise<RouteComponent | undefined> {
      prune()
      const job = jobs.get(record)
      if (!job) return
      job.navigation++
      // A user navigation may promote a queued request past unrelated speculative imports.
      start(job, false)
      try {
        const value = await job.result
        return current(job) && Date.now() < job.expires ? value : undefined
      } finally {
        job.navigation--
        if (!job.consumers.size && !job.navigation) drop(job, 'cancelled')
      }
    },
    cancelOwner(owner: object) {
      for (const job of jobs.values()) {
        for (const consumer of [...job.consumers])
          if (consumer.owner === owner) {
            job.consumers.delete(consumer)
            consumer.lease.publish({ status: 'cancelled', reason: 'disposed' })
          }
        if (!job.consumers.size && !job.navigation) drop(job, 'disposed')
      }
      pump()
    },
    invalidate() {
      prune()
      pump()
    },
    clear(reason: RoutePreloadCancelReason = 'invalidated') {
      for (const job of [...jobs.values()]) drop(job, reason)
    },
    dispose() {
      stopped = true
      this.clear('disposed')
    },
  }
}

function positive(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647)
    throw new Error(
      `preload.${name} must be a positive finite integer (at most 2147483647)`,
    )
  return value
}
