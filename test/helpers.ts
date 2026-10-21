import { Frame, resetNative, setPlatform } from './shims/core.js'
import {
  createApp,
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  type Component,
  type VNode,
} from 'nativescript-vue'
import {
  createRouter,
  RouterView,
  type RestoreOptions,
  type Router,
  type RouteRecordRaw,
} from '../src/index.js'

export const events: string[] = []

/** Lets queued native navigations finish. */
export async function settle() {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0))
}

/** A routed page. `setup` runs inside the page, so it can use the composables. */
export function page(
  name: string,
  setup?: (props: Record<string, unknown>) => void,
): Component {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs }) {
      setup?.(attrs)
      onMounted(() => events.push(`mount ${name}`))
      onUnmounted(() => events.push(`unmount ${name}`))
      return () => h('Page')
    },
  })
}

interface MountOptions {
  initial?: string
  render?: () => VNode | VNode[]
  platform?: 'ios' | 'android'
  /** Runs before the app starts, e.g. to add guards that see the initial navigation. */
  before?: (router: Router) => void
  restore?: RestoreOptions
  backPreview?: boolean | 'core'
  diagnostics?: import('../src/index.js').DiagnosticsOptions | boolean
  motion?: import('../src/index.js').MotionPolicy
  links?: import('../src/index.js').LinksOptions | boolean
  layouts?: import('../src/index.js').RouterOptions['layouts']
  defaultLayout?: string | false
}

export async function mount(
  routes: readonly RouteRecordRaw[],
  options: MountOptions = {},
) {
  resetNative()
  setPlatform(options.platform ?? 'ios')
  events.length = 0

  const router = createRouter({
    routes,
    layouts: options.layouts,
    defaultLayout: options.defaultLayout,
    restore: options.restore,
    backPreview: options.backPreview,
    diagnostics: options.diagnostics,
    motion: options.motion,
    links: options.links,
  })
  options.before?.(router as Router)
  const App = defineComponent({
    render:
      options.render ??
      (() => h(RouterView, options.initial ? { initial: options.initial } : {})),
  })
  const app = createApp(App)
  app.use(router)
  app.start()
  await router.isReady()

  return { router, app, frame: () => Frame.topmost()! }
}

export const paths = (routes: readonly { fullPath: string }[]) =>
  routes.map((route) => route.fullPath)
