// --env.loadersTest: route data + an application-owned Promise cache.
import {
  File,
  Folder,
  knownFolders,
  path,
  type Frame,
  type Page as NativePage,
} from '@nativescript/core'
import { ActionBar, createApp, defineComponent, h } from 'nativescript-vue'
import {
  createRouter,
  RouterView,
  defineRouteLoader,
  useRouteData,
  useRoute,
  type RouteData,
  type Router,
  type RouteLocation,
} from 'vue-router-ns'

type Product = { id: string; title: string; price: number }
// The cache owns these shared requests. A page cancellation only detaches that
// page's result; passing its cancellation to this shared request would be wrong.
const cache = new Map<string, Promise<Product>>()
function getProduct(id: string): Promise<Product> {
  let request = cache.get(id)
  if (!request) {
    request = fetch(`http://127.0.0.1:18818/products/${encodeURIComponent(id)}`).then(
      (response) => {
        if (!response.ok) throw new Error('Could not load product')
        return response.json() as Promise<Product>
      },
    )
    cache.set(id, request)
    void request.catch(() => {
      if (cache.get(id) === request) cache.delete(id)
    })
  }
  return request
}
const productLoader = defineRouteLoader(({ to }) => getProduct(String(to.params.id)))
let frame: Frame
const states: { id: string; state: RouteData<Product> }[] = []
const pageIds = new WeakMap<NativePage, number>()
let pageId = 0
const button = (text: string, onTap: () => unknown) => h('Button', { text, onTap })
const Home = defineComponent({
  setup: () => () =>
    h('Page', {}, [
      h(ActionBar, { title: 'Route data' }),
      h('StackLayout', { padding: 24 }, [
        h('Label', { text: 'Products', fontSize: 28, fontWeight: 'bold' }),
        h('Label', {
          text: 'Native navigation stays responsive while data loads.',
          textWrap: true,
          marginBottom: 24,
        }),
        button('Open product', () => router.push('/products/42')),
        button('Try an error', () => router.push('/products/error')),
        button('Open slowly, then go back', () => router.push('/products/slow')),
      ]),
    ]),
})
const ProductPage = defineComponent({
  setup() {
    const route: RouteLocation = useRoute()
    const id = String(route.params.id)
    const resource = useRouteData(productLoader)
    states.push({ id, state: resource })
    return () =>
      h('Page', {}, [
        h(ActionBar, { title: 'Product details' }),
        h('StackLayout', { padding: 24 }, [
          h('Label', {
            text: `Product ${id}`,
            fontSize: 28,
            fontWeight: 'bold',
            marginBottom: 20,
          }),
          resource.status.value === 'pending'
            ? h('StackLayout', {}, [
                h('ActivityIndicator', { busy: true }),
                h('Label', { text: 'Loading product…', textAlignment: 'center' }),
              ])
            : resource.status.value === 'error'
              ? h('StackLayout', {}, [
                  h('Label', {
                    text: 'Could not load product. Please try again.',
                    textWrap: true,
                  }),
                  button('Retry', () => resource.reload()),
                ])
              : h('StackLayout', {}, [
                  h('Label', { text: resource.data.value?.title, fontSize: 24 }),
                  h('Label', { text: `$${resource.data.value?.price}`, marginTop: 12 }),
                ]),
          button('Go back', () => router.back()),
          button('Open another copy', () =>
            router.push({ path: route.fullPath, force: true }),
          ),
        ]),
      ])
  },
})
const router: Router = createRouter({
  loaders: { product: productLoader },
  links: { schemes: ['loaders'] },
  routes: [
    { path: '/', component: Home },
    {
      path: '/products/:id',
      component: ProductPage,
      meta: { loaders: ['product'] },
      beforeEnter: (to) => to.params.id !== 'secret',
    },
  ],
})
const app = createApp({
  render: () =>
    h(RouterView, {
      name: 'main',
      initial: '/',
      ref: (view: any) => {
        if (view) frame = view.$el.nativeView
      },
    }),
})
app.use(router)
app.start()

// Acceptance-only file bridge; application pages above use only public APIs.
const folder = path.join(knownFolders.documents().path, 'loaders')
Folder.fromPath(folder)
const command = path.join(folder, 'command.json')
const result = File.fromPath(path.join(folder, 'result.json'))
let busy = false
setInterval(async () => {
  if (busy || !frame?.currentPage || !File.exists(command)) return
  busy = true
  let id: unknown
  try {
    const request = JSON.parse(File.fromPath(command).readTextSync())
    File.fromPath(command).removeSync()
    id = request.id
    switch (request.action) {
      case 'push':
        await router.push(`/products/${request.value}`)
        break
      case 'force':
        await router.push({ path: router.currentRoute.value.fullPath, force: true })
        break
      case 'back':
        await router.back()
        break
      case 'retry':
        void states.at(-1)!.state.reload()
        break
      case 'modal':
        await router.push(`/products/${request.value}`, { modal: true })
        break
      case 'link':
        await router.openLink(`loaders://products/${request.value}`)
        break
    }
    const page = frame.currentPage
    if (!pageIds.has(page)) pageIds.set(page, ++pageId)
    result.writeTextSync(
      JSON.stringify({
        id,
        current: router.currentRoute.value.fullPath,
        page: pageIds.get(page),
        history: frame.backStack.length + 1,
        states: states.map(({ id, state }) => ({
          id,
          status: state.status.value,
          data: state.data.value,
          error: state.error.value ? String(state.error.value) : undefined,
        })),
      }),
    )
  } catch (error) {
    result.writeTextSync(JSON.stringify({ id, error: String(error) }))
  } finally {
    busy = false
  }
}, 60)
