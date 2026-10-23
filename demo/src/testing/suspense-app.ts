import {
  File,
  Folder,
  knownFolders,
  path,
  type Frame,
  type Page,
  type View,
} from '@nativescript/core'
import {
  ActionBar,
  createApp,
  defineAsyncComponent,
  defineComponent,
  h,
  nextTick,
  onErrorCaptured,
  onScopeDispose,
  ref,
  Suspense,
} from 'nativescript-vue'
import {
  createRouter,
  Deferred,
  onPageActivated,
  onPageDeactivated,
  useNavigationFocus,
  RouterTab,
  RouterTabs,
  RouterView,
  useRoute,
  useRouteData,
  useRouter,
  type Router,
  type RouteLocation,
} from 'vue-router-ns'
import {
  consumeProduct,
  consumers,
  invalidateProduct,
  productData,
} from './suspense/data'
import AsyncProduct from './suspense/AsyncProduct.vue'
import { registerSuspenseContainer } from './suspense/native-container'

// Negative control on the installed renderer, before the opt-in registration.
let stockError = ''
try {
  const probe = createApp({
    render: () => h(Suspense, {}, { default: () => h('Label', { text: 'Probe' }) }),
  })
  probe.mount()
  probe.unmount()
} catch (error) {
  stockError = String(error)
}

// Vue's hidden staging element is a detached native layout, never a web view.
registerSuspenseContainer()

const LazyProduct = defineAsyncComponent(() => import('./suspense/AsyncProduct.vue'))
const SetupProduct = defineComponent({
  async setup() {
    const { product, consumer } = consumeProduct()
    const ready = product.ready
    await ready
    const current = product.ready === ready && !consumer.disposed
    if (current && product.status.value === 'error') throw product.error.value
    const data = current ? product.data.value : undefined
    if (data) consumer.resolved = true
    return () => (data ? h('Label', { text: data.title, fontSize: 24 }) : null)
  },
})
const frames = new Map<string, Frame>()
const pages: {
  id: string
  mode: string
  disposed: boolean
  active: boolean
  events: string[]
  native?: Page
  retry: (keyed?: boolean) => void
  getError: () => string
  getStatus: () => string
}[] = []
const nativeIds = new WeakMap<View, number>()
let nextId = 0
const identity = (view?: View) => {
  if (!view) return null
  if (!nativeIds.has(view)) nativeIds.set(view, ++nextId)
  return nativeIds.get(view)
}
function texts(view?: View): string[] {
  if (!view) return []
  const found: string[] = []
  const text = (view as View & { text?: string }).text
  if (text) found.push(text)
  view.eachChildView((child) => {
    found.push(...texts(child))
    return true
  })
  return found
}
const button = (text: string, onTap: () => unknown) => h('Button', { text, onTap })
const Home = defineComponent({
  setup() {
    const router = useRouter()
    return () =>
      h('Page', {}, [
        h(ActionBar, { title: 'Native Suspense' }),
        h('StackLayout', { padding: 24 }, [
          h('Label', { text: 'Product data', fontSize: 28 }),
          h('Label', {
            text: 'Async content inside a stable native Page.',
            textWrap: true,
          }),
          button('Open product', () => router.push('/product/42')),
          button('Try an error', () => router.push('/product/error')),
          button('Pending gesture', () => router.push('/product/gesture')),
        ]),
      ])
  },
})
const ProductPage = defineComponent({
  setup() {
    const route: RouteLocation = useRoute()
    const router = useRouter()
    const id = String(route.params.id)
    const mode = String(route.query.mode ?? 'sfc')
    const resource = useRouteData(productData)
    useNavigationFocus({ initial: 'product-heading', return: 'product-heading' })
    const error = ref('')
    const generation = ref(0)
    const info = {
      id,
      mode,
      disposed: false,
      active: false,
      events: [] as string[],
      native: undefined as Page | undefined,
      retry(keyed = true) {
        invalidateProduct(id)
        void resource.reload()
        error.value = ''
        if (keyed) generation.value++
      },
      getError: () => error.value,
      getStatus: () => resource.status.value,
    }
    pages.push(info)
    onPageActivated(() => {
      info.active = true
      info.events.push('activated')
    })
    onPageDeactivated(() => {
      info.active = false
      info.events.push('deactivated')
    })
    onScopeDispose(() => {
      info.disposed = true
    })
    onErrorCaptured((reason) => {
      error.value = String(reason)
      info.events.push('error')
      return false
    })
    const fallback = () =>
      h('StackLayout', { padding: 20 }, [
        h('ActivityIndicator', { busy: true }),
        h('Label', {
          text: 'Loading product…',
          accessibilityLabel: 'Loading product',
          textAlignment: 'center',
        }),
      ])
    const content = () =>
      h(mode === 'setup' ? SetupProduct : mode === 'lazy' ? LazyProduct : AsyncProduct, {
        key: generation.value,
      })
    const boundary = () =>
      h(
        Suspense,
        {
          timeout: Number(route.query.timeout ?? 0),
          onPending: () => info.events.push('pending'),
          onFallback: () => info.events.push('fallback'),
          onResolve: () => info.events.push('resolve'),
        },
        {
          default:
            mode === 'nested'
              ? () =>
                  h('GridLayout', {}, [
                    h(Suspense, { suspensible: true }, { default: content, fallback }),
                  ])
              : content,
          fallback,
        },
      )
    return () =>
      h(
        'Page',
        {
          onLoaded: (args: { object: Page }) => {
            info.native = args.object
          },
        },
        [
          h(ActionBar, { title: `Product ${id}` }),
          h('StackLayout', { padding: 24 }, [
            h('Label', {
              text: route.fullPath,
              accessibilityLabel: route.fullPath,
              textWrap: true,
            }),
            h('Label', {
              id: 'product-heading',
              text: 'Product details',
              fontSize: 28,
              marginBottom: 16,
              accessibilityLabel: 'Product heading',
            }),
            error.value
              ? h('StackLayout', {}, [
                  h('Label', {
                    text: 'Could not load product. Please try again.',
                    textWrap: true,
                  }),
                  button('Retry', () => info.retry()),
                ])
              : mode === 'deferred'
                ? h(
                    Deferred,
                    {},
                    {
                      default: boundary,
                      fallback: () =>
                        h('Label', { text: 'Waiting for native activation' }),
                    },
                  )
                : boundary(),
            button('Reload content', () => info.retry()),
            button('Go back', () => router.back()),
          ]),
        ],
      )
  },
})
const router: Router = createRouter({
  routes: [
    { path: '/', component: Home },
    { path: '/product/:id', component: ProductPage, meta: { loaders: productData } },
  ],
})
const selected = ref('a')
const app = createApp({
  render: () =>
    h(
      RouterTabs,
      {
        selected: selected.value,
        'onUpdate:selected': (value: string) => {
          selected.value = value
        },
      },
      () =>
        ['a', 'b'].map((name) =>
          h(
            RouterTab,
            {
              name,
              title: name === 'a' ? 'Products' : 'Saved',
              icon: name === 'a' ? 'house' : 'heart',
            },
            () =>
              h(RouterView, {
                name,
                initial: '/',
                ref: (view: any) => {
                  if (view) frames.set(name, view.$el.nativeView)
                },
              }),
          ),
        ),
    ),
})
const unhandled: string[] = []
app.config.errorHandler = (error) => {
  unhandled.push(String(error))
  console.error(error)
}
app.use(router)
app.start()

const folder = path.join(knownFolders.documents().path, 'suspense')
Folder.fromPath(folder)
const command = path.join(folder, 'command.json')
const result = File.fromPath(path.join(folder, 'result.json'))
let busy = false
setInterval(async () => {
  if (busy || !frames.get('a')?.currentPage || !File.exists(command)) return
  busy = true
  let id: unknown
  try {
    const request = JSON.parse(File.fromPath(command).readTextSync())
    File.fromPath(command).removeSync()
    id = request.id
    switch (request.action) {
      case 'push':
        await router.push(request.value, { frame: request.frame ?? 'a' })
        break
      case 'back':
        await router.back()
        break
      case 'modal':
        await router.push(request.value, { modal: true })
        break
      case 'select':
        selected.value = request.value
        break
      case 'retry':
        pages.at(-1)!.retry()
        break
      case 'refresh':
        pages.at(-1)!.retry(false)
        break
    }
    await nextTick()
    result.writeTextSync(
      JSON.stringify({
        id,
        current: router.currentRoute.value.fullPath,
        stockError,
        unhandled,
        frames: Object.fromEntries(
          [...frames].map(([key, frame]) => [
            key,
            { page: identity(frame.currentPage), history: frame.backStack.length + 1 },
          ]),
        ),
        pages: pages.map((p) => ({
          id: p.id,
          mode: p.mode,
          disposed: p.disposed,
          active: p.active,
          events: p.events,
          error: p.getError(),
          status: p.getStatus(),
          texts: texts(p.native),
          heading: identity(p.native?.getViewById('product-heading')),
          size: p.native?.getActualSize(),
          page: identity(p.native),
          actionBar: identity(p.native?.actionBar),
        })),
        consumers,
      }),
    )
  } catch (error) {
    result.writeTextSync(JSON.stringify({ id, error: String(error) }))
  } finally {
    busy = false
  }
}, 60)
