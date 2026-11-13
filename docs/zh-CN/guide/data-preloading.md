# 路由数据预加载（实验性） {#route-data-preloading-experimental}

用户触摸卡片时，可以准备一个明确允许提前执行的路由加载器。目标页面仅在正常导航守卫通过后，消费有效的已准备或进行中的数据。准备过程不会导入组件、挂载 Vue/原生视图、显示标签页、改变历史或运行导航守卫。现有加载器与[代码预加载](./preloading)保持独立；不会自动发起推测性网络请求，也不要求缓存框架。

## 明确授权可安全提前执行的加载器 {#authorize-an-explicitly-safe-loader}

将 `preload` 策略作为 `defineRouteLoader()` 的第二个参数。`scope()` 必须返回当前会话/权限版本的稳定对象；返回 `null`/`undefined` 则拒绝准备。`authorize({ to, from })` 必须同步返回布尔值 `true`。它应是无副作用的权限检查；异步策略会被拒绝。允许准备前，应用应先完成异步身份认证。这些检查不能代替服务端授权或导航守卫。

```ts
import { defineRouteLoader } from 'vue-router-ns'

type Session = { accessToken: string; mayReadProducts: boolean }
type Product = { id: string; title: string }
let session: Session | null = null

export function updateSession(next: Session | null) {
  session = next ? { ...next } : null
}
export const productData = defineRouteLoader(
  async ({ to }) => {
    const account = session
    if (!account?.mayReadProducts) throw new Error('Product access denied')
    const response = await fetch(
      `https://api.example.com/products/${encodeURIComponent(String(to.params.id))}`,
      { headers: { Authorization: `Bearer ${account.accessToken}` } },
    )
    if (!response.ok) throw new Error('Could not load product')
    return response.json() as Promise<Product>
  },
  {
    preload: {
      scope: () => session,
      authorize: () => session?.mayReadProducts === true,
    },
  },
)
```

示例在调用时捕获凭据。账户、凭据或权限变化时，应替换作用域对象。不要在每次读取作用域时都创建新对象。更新会话后，按下文方式清除准备工作。

在路由元数据中声明同一个加载器定义。命名定义以及匹配的父路由声明也受支持。只准备指定的定义，不启动其他加载器。以下配置展示独立数据池的默认值：

```ts
const router = createRouter({
  routes: [
    { path: '/', component: () => import('./Home.vue') },
    {
      path: '/products/:id',
      name: 'product',
      component: () => import('./Product.vue'),
      meta: { loaders: productData },
    },
  ],
  preloadData: { concurrency: 2, maxEntries: 16, ttl: 30_000 },
})
```

## 从页面准备 {#prepare-from-a-page}

在路由页面 setup 中获取 `useRouteDataPreload()`。按照[完整触摸处理器](./preloading#prepare-from-a-page)，将这些函数连接到按下、放弃拖动/取消及松开事件；保留普通无障碍按钮作为另一种打开方式。页面/作用域释放时，helper 自动释放需求。保留 handle 直到导航完成，让异步守卫之后仍能复用。示例标识符和标签为英文。

```ts
import { useRouter, useRouteDataPreload, type RoutePreload } from 'vue-router-ns'
import { productData } from './product-data'

const router = useRouter()
const prepare = useRouteDataPreload()
const to = { name: 'product', params: { id: '42' } } as const
let interest: RoutePreload | undefined

function touchDown() {
  interest?.cancel()
  interest = prepare(to, productData)
}
function abandon() {
  interest?.cancel()
  interest = undefined
}
async function open() {
  const held = interest
  interest = undefined
  try {
    await router.push(to)
  } finally {
    held?.cancel()
  }
}
```

页面之外可调用 `router.preloadData(to, productData)`。绑定到栈的 router 持有需求直到栈关闭；根需求属于 router/窗口。目标必须可解析，且定义必须已声明并明确允许提前执行，否则 handle 返回错误。可以通过 `router.preload(to)` 单独准备代码。

## 结果、匹配与导航 {#results-matching-and-navigation}

结果使用相同的 `RoutePreload` handle：只读实时 `state`、首次结果的 `ready` promise 和 `cancel()`。它从不暴露准备的数据。状态为 `queued`、`loading`、`ready`、`error` 和 `cancelled`。数据权限拒绝使用取消原因 `unauthorized`；其他原因为 `cancelled`、`expired`、`invalidated`、`disposed` 和 `capacity`。promise 永不拒绝，即使后续就绪状态过期，也保留首次结果。

共享要求加载器、会话身份、匹配路由记录、完整目标和完整来源全部相同，包括 params/query/hash。来源也包含在键中，因为加载器可能依赖它。不同 router/窗口拥有独立池。消费者的需求相互独立；取消一个不会取消另一个，也不会取消已消费该请求的条目。准备开始前已经运行的普通加载不会追加入池；应用缓存可以合并这些工作。

所有正常守卫通过后，新条目获取匹配的准备工作，同时继续展示页面，无需等待数据。`useRouteData(productData)` 暴露条目的普通状态。就绪值和进行中请求都可以复用；过期或推测性失败回退到正常加载。账户/权限变化或显式失效会取消共享的待发布结果，不会悄悄重试受保护工作。导航拒绝或重定向不会为已准备目标创建条目。

`RouteLoaderContext.preloading` 区分推测性调用与普通加载。`reload()` 总是启动普通尝试，不会再次消费准备工作。没有准备的普通加载仍然独立。Back/标签页保留的条目维持已有状态。共享值是浅层引用，不会复制或深度冻结：请将准备结果视为不可变数据。数据不会随保存的栈序列化。

## 限额、取消与账户变化 {#budgets-cancellation-and-account-changes}

`RouterOptions.preloadData` 提供独立的 `concurrency`（2）、`maxEntries`（16）和 `ttl`（30,000 ms）限制。值必须为有限正整数。限额计算加载器任务/保留结果数量，不计算字节数或应用缓存内容。TTL 从首次请求开始，包括排队时间；复用不会延长。就绪结果按 LRU 淘汰；池中全是待完成任务时返回 `capacity`。已授权导航可以优先执行自己的排队请求，无需等待其他推测性任务。

没有消费者的排队任务不会执行。最后一个待完成需求释放时，共享加载器上下文会调用 `onCancel()` 回调。即使已取消，正在执行的请求仍占用推测性并发槽，直到 promise 完成。只有当该调用拥有请求或自己的缓存订阅时，才把回调连接到 HTTP 客户端。取消总会阻止 router 发布结果；只有客户端支持并实现相应适配器时，才会中止传输。原生 fixture 刻意让 HTTP 在取消后继续完成。

退出登录、切换账户或改变权限时，立即调用以下操作，并清除相应的应用缓存：

```ts
updateSession(nextSession)
router.clearPreloads()
```

执行、复用和发布前都会检查作用域与权限。作用域变化不会被持续监听，因此清除操作可立即取消；即使未清除，检查也会拒绝迟到响应。路由移除/替换、生成路由表的 HMR 及工厂变化会使准备失效。原地修改元数据或显式刷新后，请调用 `router.clearPreloads()`。替换命名加载器注册仍要求完整重载 router。

清除会影响代码和数据准备，包括仍在等待准备工作的条目。它不会擦除活跃条目已经消费的值或应用缓存；账户页面退场和缓存数据清理由应用负责。普通路由数据的重新加载与释放保持原有行为。进程终止后不会保留准备结果。

## 原生证据 {#native-evidence}

<Clip name="route-data-preload" :width="480" aspect="3 / 4" caption="真实 HTTP 的冷/已准备导航、放弃拖动、拒绝推测性请求、守卫拒绝、HTTP 期间切换账户及释放所有者。服务端受控延迟 900 ms；不是网络基准。iOS 18.6 模拟器；fixture 标签为英文。" />

fixture 统计提交前的构造，并检查来源 Page/历史身份。HTTP 服务端独立核实请求数，包括拒绝时零请求以及账户 A/B 的独立请求。请参阅[验证报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-route-preload-stage2.md)和[可复现驱动](https://github.com/rafaelaugustos/vue-router-ns/blob/main/scripts/native/preload/README.md)。原生证据覆盖 iOS 模拟器，不证明 Android 原生触摸、实体设备性能或垃圾回收。
