import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'nativescript-vue'
import {
  RouterSplitView,
  onBeforeRouteLeave,
  useNavigationFocus,
  type NavigationFocus,
} from '../src/index.js'
import { reduceMotion } from '../src/motion.js'
import { mount, page, settle } from './helpers.js'
import {
  Frame,
  Device,
  Page,
  SharedTransition,
  View,
  setPlatform,
  setScreenReaderEnabled,
} from './shims/core.js'
import { views } from './shims/nativescript-vue.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Device.sdkVersion = '36'
})
const accessible = (setup?: () => void) =>
  defineComponent({
    setup() {
      useNavigationFocus({ initial: 'heading', return: 'trigger' })
      setup?.()
      return () =>
        h('Page', {}, [h('Label', { id: 'heading' }), h('Button', { id: 'trigger' })])
    },
  })
function voiceOver() {
  const post = vi.fn()
  vi.stubGlobal('UIAccessibilityPostNotification', post)
  vi.stubGlobal('UIAccessibilityLayoutChangedNotification', 100)
  return post
}

describe('navigation accessibility focus', () => {
  it('waits for a returned native Page to load after Frame completion', async () => {
    const post = voiceOver()
    const { app, router, frame } = await mount(
      [
        { path: '/', component: accessible() },
        { path: '/detail', component: accessible() },
      ],
      { before: () => setScreenReaderEnabled(true) },
    )
    const root = frame().currentPage!
    await router.push('/detail')
    await settle()
    post.mockClear()
    root.isLoaded = false
    await router.back()
    await settle()
    expect(post).not.toHaveBeenCalled()
    root.isLoaded = true
    root.notify({ eventName: 'loaded' })
    await settle()
    expect(post).toHaveBeenCalledOnce()
    expect(post).toHaveBeenLastCalledWith(100, root.getViewById<View>('trigger')!.ios)
    app.unmount()
  })
  it('announces one explicit target after successful push/back, keeps rejected/cancelled navigation silent', async () => {
    const post = voiceOver()
    const { router, frame, app } = await mount(
      [
        { path: '/', component: accessible() },
        { path: '/detail', component: accessible(() => onBeforeRouteLeave(() => false)) },
      ],
      { before: () => setScreenReaderEnabled(true) },
    )
    const root = frame().currentPage!
    await settle()
    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenLastCalledWith(100, root.getViewById<View>('heading')!.ios)
    await router.push('/detail')
    await settle()
    expect(post).toHaveBeenCalledTimes(2)
    expect(root.accessibilityHidden).toBe(true)
    await router.back()
    expect(router.stack.value).toHaveLength(2)
    frame().currentPage!.accessibilityScreenChanged(true)
    frame().notify({ eventName: 'navigatedTo' })
    await settle()
    expect(post).toHaveBeenCalledTimes(2)
    frame().popNatively()
    await settle()
    expect(root.accessibilityHidden).toBe(false)
    expect(post).toHaveBeenCalledTimes(3)
    expect(post).toHaveBeenLastCalledWith(100, root.getViewById<View>('trigger')!.ios)
    app.unmount()
  })

  it('falls back to core once for missing or disposed targets and leaves screen-reader-off navigation alone', async () => {
    const post = voiceOver()
    const original = vi.spyOn(Page.prototype, 'accessibilityScreenChanged')
    const { router, app } = await mount(
      [
        {
          path: '/',
          component: page('Missing', () => useNavigationFocus({ initial: 'missing' })),
        },
        { path: '/detail', component: accessible() },
      ],
      { before: () => setScreenReaderEnabled(true) },
    )
    await settle()
    expect(post).not.toHaveBeenCalled()
    expect(original).toHaveBeenCalledTimes(1)
    setScreenReaderEnabled(false)
    await router.push('/detail')
    await settle()
    expect(post).not.toHaveBeenCalled()
    expect(original).toHaveBeenCalledTimes(2)
    app.unmount()
  })

  it('falls back once when a return target has been disposed', async () => {
    const post = voiceOver()
    const original = vi.spyOn(Page.prototype, 'accessibilityScreenChanged')
    const { app, router, frame } = await mount(
      [
        { path: '/', component: accessible() },
        { path: '/detail', component: accessible() },
      ],
      { before: () => setScreenReaderEnabled(true) },
    )
    const root = frame().currentPage!
    await router.push('/detail')
    root.getViewById<View>('trigger')!.isLoaded = false
    post.mockClear()
    original.mockClear()
    await router.back()
    await settle()
    expect(post).not.toHaveBeenCalled()
    expect(original).toHaveBeenCalledOnce()
    expect(original).toHaveBeenCalledWith(true)
    app.unmount()
  })

  it('restores an explicit modal initiator in the split list while both panes remain accessible', async () => {
    const post = voiceOver()
    let focus!: NavigationFocus
    const List = defineComponent({
      setup() {
        focus = useNavigationFocus({ initial: 'heading', return: 'trigger' })
        return () =>
          h('Page', {}, [h('Label', { id: 'heading' }), h('Button', { id: 'trigger' })])
      },
    })
    const { router, app } = await mount(
      [
        { path: '/', component: List },
        { path: '/detail', component: accessible() },
        { path: '/modal', component: accessible(), modal: true },
      ],
      {
        before: () => setScreenReaderEnabled(true),
        render: () => h(RouterSplitView, { list: '/' }),
      },
    )
    const [list, detail] = views.get('Frame')!.slice(-2) as Frame[]
    const layout = list!.parent!
    layout.width = 1000
    layout.notify({ eventName: 'layoutChanged' })
    await nextTick()
    await router.push('/detail')
    expect(list!.currentPage!.accessibilityHidden).toBe(false)
    expect(detail!.currentPage!.accessibilityHidden).toBe(false)
    focus.remember('trigger')
    const result = router.pushForResult('/modal')
    await settle()
    expect(list!.currentPage!.accessibilityHidden).toBe(true)
    await router.back({ result: 'saved' })
    expect(await result).toBe('saved')
    await settle()
    expect(post).toHaveBeenLastCalledWith(
      100,
      list!.currentPage!.getViewById<View>('trigger')!.ios,
    )
    expect(list!.currentPage!.accessibilityHidden).toBe(false)
    expect(detail!.currentPage!.accessibilityHidden).toBe(false)
    app.unmount()
  })
})

describe('motion policy', () => {
  it('does not touch iOS 18 transition selectors on an older controller', async () => {
    const { app, router, frame } = await mount(
      [
        { path: '/', component: page('Root') },
        { path: '/detail', component: page('Detail') },
      ],
      { motion: 'reduced' },
    )
    Device.sdkVersion = '17'
    await router.push('/detail')
    Object.defineProperty(frame().currentPage!.ios, 'preferredTransition', {
      set() {
        throw new Error('iOS 18 selector on an older controller')
      },
    })
    await expect(router.back()).resolves.toBeUndefined()
    app.unmount()
  })
  it('reads OS preferences live and supports explicit app overrides', () => {
    setPlatform('ios')
    let reduced = false
    vi.stubGlobal('UIAccessibilityIsReduceMotionEnabled', () => reduced)
    expect(reduceMotion()).toBe(false)
    reduced = true
    expect(reduceMotion()).toBe(true)
    expect(reduceMotion('full')).toBe(false)
    expect(reduceMotion('reduced')).toBe(true)
    setPlatform('android')
    vi.stubGlobal('android', {
      animation: { ValueAnimator: { areAnimatorsEnabled: () => false } },
    })
    expect(reduceMotion()).toBe(true)
  })

  it('disables zoom, shared transitions, push/back and modal animation without changing history or results', async () => {
    vi.stubGlobal('UIAccessibilityIsReduceMotionEnabled', () => true)
    const { router, app } = await mount([
      { path: '/', component: page('Root') },
      { path: '/detail', component: page('Detail') },
      { path: '/modal', component: page('Modal'), modal: true },
    ])
    await router.push('/detail', {
      zoomFrom: new View() as any,
      transition: { instance: { id: 42 } as any },
      animated: true,
    })
    expect(Frame.navigations.at(-1)!.animated).toBe(false)
    expect(Frame.navigations.at(-1)!.transition).toBeUndefined()
    expect(SharedTransition.finished).toContain(42)
    expect(router.stack.value).toHaveLength(2)
    await router.back({ animated: true })
    expect(Frame.backs.at(-1)).toBe(false)
    const result = router.pushForResult('/modal')
    await settle()
    expect(View.presented.at(-1)!.options.animated).toBe(false)
    await router.back({ result: 7 })
    expect(await result).toBe(7)
    expect(router.stack.value).toHaveLength(1)
    app.unmount()
  })
})
