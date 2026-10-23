import { isAndroid, LayoutBase, Utils, type View } from '@nativescript/core'
import {
  defineComponent,
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

const GRAVITY_START = 0x00800003
const MATCH_PARENT = -1

declare const androidx: {
  drawerlayout: {
    widget: {
      DrawerLayout: {
        new (context: unknown): any
        LayoutParams: new (width: number, height: number, gravity: number) => unknown
        DrawerListener: new (methods: object) => object
      }
    }
  }
}

/** What the Vue component needs from the native layout, real or stand-in. */
export interface DrawerLayoutLike {
  drawerWidth: number
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

  override createNativeView() {
    return new androidx.drawerlayout.widget.DrawerLayout(this._context)
  }

  override initNativeView() {
    super.initNativeView()
    const owner = new WeakRef(this)
    this.listener = new androidx.drawerlayout.widget.DrawerLayout.DrawerListener({
      onDrawerOpened() {
        const view = owner.deref()
        view?.notify({ eventName: DrawerLayoutView.drawerOpenedEvent, object: view })
      },
      onDrawerClosed() {
        const view = owner.deref()
        view?.notify({ eventName: DrawerLayoutView.drawerClosedEvent, object: view })
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
    native.setLayoutParams(
      new androidx.drawerlayout.widget.DrawerLayout.LayoutParams(
        drawer ? Utils.layout.toDevicePixels(this.drawerWidth) : MATCH_PARENT,
        MATCH_PARENT,
        drawer ? GRAVITY_START : 0,
      ),
    )
  }

  openDrawer() {
    this.nativeViewProtected?.openDrawer(GRAVITY_START)
  }

  closeDrawer() {
    this.nativeViewProtected?.closeDrawer(GRAVITY_START)
  }

  get isDrawerOpen(): boolean {
    return !!this.nativeViewProtected?.isDrawerOpen(GRAVITY_START)
  }
}

export interface RouterDrawerHandle {
  open(): void
  close(): void
  toggle(): void
  readonly isOpen: boolean
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
  },
  setup(props, { slots, emit, expose }) {
    const router = useRouter() as unknown as Router
    const layout = shallowRef<{ nativeView: DrawerLayoutLike }>()
    const isOpen = shallowRef(false)
    const open = () => layout.value?.nativeView.openDrawer()
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
    } satisfies RouterDrawerHandle)

    onMounted(() => {
      const release = isAndroid
        ? router.claimSystemBack({ owns: () => isOpen.value, back: close })
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
      }
      if (props.open) open()
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
