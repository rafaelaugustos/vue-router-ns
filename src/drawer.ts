import { isAndroid, LayoutBase, Utils, type View } from '@nativescript/core'
import {
  defineComponent,
  computed,
  h,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watch,
  type PropType,
} from 'nativescript-vue'
import { useRouter } from './composables.js'
import { NavigationFailureType } from './errors.js'
import type { Router } from './router.js'
import {
  observeSplitViewport,
  observeWindowFolds,
  splitViewport,
  type WindowFold,
} from './folding.js'
import {
  drawerGeometry,
  type DrawerGeometry,
  type DrawerPresentation,
  type ResolvedDrawerPresentation,
} from './drawer-geometry.js'
export type { DrawerPresentation, ResolvedDrawerPresentation } from './drawer-geometry.js'

const GRAVITY_START = 0x00800003
const MATCH_PARENT = -1

declare const androidx: {
  drawerlayout: {
    widget: {
      DrawerLayout: {
        new (context: unknown): any
        LayoutParams: new (width: number, height: number, gravity: number) => any
        DrawerListener: new (methods: object) => object
      }
    }
  }
}

/** What the Vue component needs from the native layout, real or stand-in. */
export interface DrawerLayoutLike {
  drawerWidth: number
  drawerGeometry: DrawerGeometry
  openDrawer(): void
  closeDrawer(): void
  readonly isDrawerOpen: boolean
}

/**
 * An AndroidX `DrawerLayout` with two NativeScript children: the content,
 * then the drawer pane. The native widget owns the drag, the settle, the
 * scrim and the accessibility of the drawer; the children lay themselves out
 * as usual.
 */
export class DrawerLayoutView extends LayoutBase implements DrawerLayoutLike {
  static readonly drawerOpenedEvent = 'drawerOpened'
  static readonly drawerClosedEvent = 'drawerClosed'
  drawerWidth = 300
  private listener: object | undefined
  private geometry: DrawerGeometry | undefined
  private changing = false
  get drawerGeometry() {
    return this.geometry!
  }
  set drawerGeometry(value: DrawerGeometry) {
    const changed = value.presentation !== (this.geometry?.presentation ?? 'overlay')
    const native = this.nativeViewProtected
    const pane = this.getChildAt(1)?.nativeViewProtected
    if (changed && native && pane && value.presentation === 'permanent') {
      this.changing = true
      const wasOpen = this.isDrawerOpen
      // Move to the closed endpoint first. Locking then starts a zero-distance
      // settle, aborting any pending ViewDragHelper animation before gravity changes.
      native.closeDrawer(pane, false)
      native.setDrawerLockMode(1, GRAVITY_START)
      this.changing = false
      if (wasOpen) this.notify({ eventName: 'drawerClosed', object: this })
    }
    this.geometry = value
    this.eachChildView((child) => {
      this._updateNativeLayoutParams(child)
      return true
    })
    if (changed && native && pane) {
      pane.setVisibility(value.presentation === 'permanent' ? 0 : 4)
      pane.setImportantForAccessibility(value.presentation === 'permanent' ? 1 : 4)
      this.getChildAt(0)?.nativeViewProtected?.setImportantForAccessibility(1)
      // A persistent pane has no floating drawer elevation.
      if (value.presentation === 'permanent') pane.setElevation(0)
      native.setDrawerLockMode(value.presentation === 'permanent' ? 1 : 0, GRAVITY_START)
      native.computeScroll()
    }
    this.requestLayout()
  }

  override createNativeView() {
    return new androidx.drawerlayout.widget.DrawerLayout(this._context)
  }

  override initNativeView() {
    super.initNativeView()
    const owner = new WeakRef(this)
    this.listener = new androidx.drawerlayout.widget.DrawerLayout.DrawerListener({
      onDrawerOpened() {
        const view = owner.deref()
        if (view && !view.changing)
          view.notify({ eventName: DrawerLayoutView.drawerOpenedEvent, object: view })
      },
      onDrawerClosed() {
        const view = owner.deref()
        if (view && !view.changing)
          view.notify({ eventName: DrawerLayoutView.drawerClosedEvent, object: view })
      },
      onDrawerSlide() {},
      onDrawerStateChanged() {},
    })
    this.nativeViewProtected.addDrawerListener(this.listener)
  }

  override disposeNativeView() {
    if (this.listener) this.nativeViewProtected?.removeDrawerListener(this.listener)
    this.listener = undefined
    super.disposeNativeView()
  }

  /** The second child is the drawer: it gets the start gravity and its width. */
  override _updateNativeLayoutParams(child: View) {
    const native = child.nativeViewProtected
    if (!native) return
    const drawer = this.getChildIndex(child) === 1
    const permanent = this.geometry?.presentation === 'permanent'
    const previous = native.getLayoutParams()
    // Retain the native open/slide state when only width or viewport changes.
    const params =
      previous?.getClass?.().getName() ===
        'androidx.drawerlayout.widget.DrawerLayout$LayoutParams' &&
      previous.gravity === (drawer && !permanent ? GRAVITY_START : 0)
        ? previous
        : new androidx.drawerlayout.widget.DrawerLayout.LayoutParams(
            drawer ? Utils.layout.toDevicePixels(this.drawerWidth) : MATCH_PARENT,
            MATCH_PARENT,
            drawer && !permanent ? GRAVITY_START : 0,
          )
    params.width =
      drawer && !permanent ? Utils.layout.toDevicePixels(this.drawerWidth) : MATCH_PARENT
    params.leftMargin = params.rightMargin = params.topMargin = params.bottomMargin = 0
    if (permanent && this.geometry) {
      const rect = drawer ? this.geometry.pane : this.geometry.content
      params.leftMargin = Utils.layout.toDevicePixels(rect.x)
      params.rightMargin = Utils.layout.toDevicePixels(
        Math.max(0, this.geometry.width - rect.x - rect.width),
      )
      params.topMargin = Utils.layout.toDevicePixels(rect.y)
      params.bottomMargin = Utils.layout.toDevicePixels(
        Math.max(0, this.geometry.height - rect.y - rect.height),
      )
    }
    native.setLayoutParams(params)
  }

  openDrawer() {
    if (this.geometry?.presentation === 'permanent') return
    this.nativeViewProtected?.openDrawer(GRAVITY_START)
  }

  closeDrawer() {
    if (this.geometry?.presentation === 'permanent') return
    this.nativeViewProtected?.closeDrawer(GRAVITY_START)
  }

  get isDrawerOpen(): boolean {
    if (this.geometry?.presentation === 'permanent') return false
    return !!this.nativeViewProtected?.isDrawerOpen(GRAVITY_START)
  }
}

export interface RouterDrawerHandle {
  open(): void
  close(): void
  toggle(): void
  readonly isOpen: boolean
  readonly presentation: ResolvedDrawerPresentation
}

/**
 * A native drawer around the app's stacks. The default slot is the
 * content, usually a `<TabView>` or a `<RouterView>`; the `drawer` slot is the
 * pane that slides in from the start edge. Back closes an open drawer before
 * popping a page on Android, and a successful navigation closes it.
 */
export const RouterDrawer = defineComponent({
  name: 'RouterDrawer',
  props: {
    /** Overlay by default; auto uses this container's available width. */
    presentation: { type: String as PropType<DrawerPresentation>, default: 'overlay' },
    breakpoint: { type: Number, default: 840 },
    foldAware: { type: Boolean, default: true },
    /** Start-edge direction; defaults to the platform's effective direction. */
    direction: String as PropType<'ltr' | 'rtl'>,
    /** Width of the pane, in device-independent pixels. */
    width: { type: Number, default: 300 },
    /** `v-model:open`. */
    open: { type: Boolean, default: false },
    /** Close the pane after a navigation. */
    closeOnNavigate: { type: Boolean, default: true },
  },
  emits: {
    'update:open': (_value: boolean) => true,
    opened: () => true,
    closed: () => true,
    presentationChange: (_value: ResolvedDrawerPresentation) => true,
  },
  setup(props, { slots, emit, expose }) {
    const router = useRouter() as unknown as Router
    const layout = shallowRef<{ nativeView: DrawerLayoutLike & View }>()
    const viewport = shallowRef({ x: 0, y: 0, width: 0, height: 0, rtl: false })
    const folds = shallowRef<readonly WindowFold[]>([])
    const geometry = computed(() =>
      drawerGeometry(
        {
          ...viewport.value,
          rtl: props.direction ? props.direction === 'rtl' : viewport.value.rtl,
        },
        props.foldAware ? folds.value : [],
        props.presentation,
        props.breakpoint,
        props.width,
      ),
    )
    const measure = () => {
      const view = layout.value?.nativeView
      if (!view) return
      const next = splitViewport(view)
      if (!isAndroid)
        next.rtl = view.nativeViewProtected?.effectiveUserInterfaceLayoutDirection === 1
      if (JSON.stringify(next) !== JSON.stringify(viewport.value)) viewport.value = next
    }
    const isOpen = shallowRef(false)
    const open = () => {
      if (geometry.value.presentation === 'permanent') {
        if (props.open) emit('update:open', false)
        return
      }
      layout.value?.nativeView.openDrawer()
    }
    const close = () => layout.value?.nativeView.closeDrawer()
    const toggle = () => (layout.value?.nativeView.isDrawerOpen ? close() : open())
    let stop: (() => void) | undefined

    expose({
      open,
      close,
      toggle,
      get isOpen() {
        return isOpen.value
      },
      get presentation() {
        return geometry.value.presentation
      },
    } satisfies RouterDrawerHandle)

    onMounted(() => {
      measure()
      const stopViewport = observeSplitViewport(layout.value!.nativeView, measure)
      let stopFolds: (() => void) | undefined
      const stopWatch = watch(
        () => props.foldAware,
        (enabled) => {
          stopFolds?.()
          stopFolds = enabled
            ? observeWindowFolds(layout.value!.nativeView, (value) => {
                folds.value = value
                measure()
              })
            : undefined
        },
        { immediate: true },
      )
      const stopGeometry = watch(
        geometry,
        (value, previous) => {
          const wasOpen = isOpen.value
          layout.value!.nativeView.drawerGeometry = value
          if (value.presentation === 'permanent' && props.open && !wasOpen)
            emit('update:open', false)
          if (previous && value.presentation !== previous.presentation)
            emit('presentationChange', value.presentation)
        },
        { immediate: true, flush: 'post' },
      )
      const release = isAndroid
        ? router.claimSystemBack({
            owns: () => geometry.value.presentation === 'overlay' && isOpen.value,
            back: close,
          })
        : () => {}
      // a stack showing its first page is not the user going somewhere
      const after = router.afterEach((_to, from, failure) => {
        const selected = !failure || failure.type === NavigationFailureType.duplicated
        if (
          selected &&
          props.closeOnNavigate &&
          layout.value?.nativeView.isDrawerOpen &&
          from.matched.length
        )
          close()
      })
      stop = () => {
        release()
        after()
        stopViewport()
        stopWatch()
        stopFolds?.()
        stopGeometry()
      }
      if (props.open && geometry.value.presentation === 'overlay') open()
    })
    watch(
      () => props.open,
      (value) => (value ? open() : close()),
    )
    onBeforeUnmount(() => stop?.())

    const onOpened = () => {
      isOpen.value = true
      emit('update:open', true)
      emit('opened')
    }
    const onClosed = () => {
      isOpen.value = false
      emit('update:open', false)
      emit('closed')
    }

    return () => {
      const content = h('GridLayout', slots.default?.())
      return h(
        'RouterDrawerLayout',
        {
          ref: layout,
          drawerWidth: props.width,
          direction: isAndroid ? props.direction : undefined,
          drawerDirection: isAndroid ? undefined : props.direction,
          onDrawerOpened: onOpened,
          onDrawerClosed: onClosed,
          onLayoutChanged: measure,
        },
        [
          content,
          h(
            'GridLayout',
            { className: 'router-drawer', backgroundColor: '#ffffff' },
            slots.drawer?.(),
          ),
        ],
      )
    }
  },
})
