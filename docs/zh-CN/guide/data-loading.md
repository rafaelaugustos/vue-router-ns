# 路线数据加载（实验性） {#route-data-loading-experimental}

声明路由上的数据加载，并在同一原生 Page 内渲染挂起、成功和错误状态。此选择加入 API 使用现有路由器和原生 导航栈。显式路由仍然是默认的；它既不需要文件路由、Vue Router、Nuxt，也不需要缓存库。

惰性 `component: () => import('./Product.vue')` 加载 **页面代码**。路由加载器获取 **数据**。数据加载不会阻止原生呈现：`router.push()` 在导航完成时稳定，与请求无关。

## 定义类型化加载器 {#define-a-typed-loader}

将定义保留在路由表和页面共享的模块中：

```ts
// product-data.ts
import { defineRouteLoader } from 'vue-router-ns'

type Product = { id: string; title: string; price: number }

export const productData = defineRouteLoader(async ({ to }) => {
  const response = await fetch(
    `https://api.example.com/products/${encodeURIComponent(String(to.params.id))}`,
  )
  if (!response.ok) throw new Error('Could not load product')
  return response.json() as Promise<Product>
})
```

```ts
// router.ts
import { createRouter } from 'vue-router-ns'
import { productData } from './product-data'

export const router = createRouter({
  routes: [
    { path: '/', component: () => import('./Home.vue') },
    {
      path: '/products/:id',
      component: () => import('./Product.vue'),
      meta: { loaders: productData },
    },
  ],
})
```

```vue
<!-- Product.vue -->
<script setup lang="ts">
import { useRouteData } from 'vue-router-ns'
import { productData } from './product-data'

const product = useRouteData(productData)
// Top-level refs unwrap in the template; data is Product | undefined.
const { data, status } = product
function retry() {
  void product.reload()
}
</script>

<template>
  <Page>
    <ActionBar title="Product" />
    <StackLayout padding="24">
      <StackLayout v-if="status === 'pending'">
        <ActivityIndicator :busy="true" />
        <Label text="Loading product…" />
      </StackLayout>
      <StackLayout v-else-if="status === 'error'">
        <Label text="Could not load product. Please try again." textWrap />
        <Button text="Retry" @tap="retry" />
      </StackLayout>
      <StackLayout v-else-if="data">
        <Label :text="data.title" />
        <Label :text="'$' + data.price" />
      </StackLayout>
    </StackLayout>
  </Page>
</template>
```

在路由页面的设置中调用 `useRouteData(definition)`，使用路由声明的相同定义对象。它会抛出路由页面之外或未声明的定义。该条目内的多个消费者接收相同的句柄。不同的条目、导航栈 和路由器具有单独的句柄，即使它们的 URL 和定义匹配。

`data`、`error` 和 `status` 是只读参考。结果很浅：路由器没有深度代理返回的对象。 `status` 是 `pending`、`success`、`error` 或 `cancelled`。成功的加载程序可能会返回`undefined`；使用 `status` 来区分它和待处理。

`await product.ready` 等待 **当前尝试** 并始终解决，包括失败或取消。随后检查 `status`/`error`。 `reload()` 显式清除旧数据/错误，取消先前的挂起尝试并在此条目上开始新的尝试；其承诺具有相同的结算规则。它不会更改 Page 或历史记录。没有自动重试。处理后调用它是无操作的。

## 授权和生命周期 {#authorization-and-lifecycle}

现有事务在开始目标数据工作之前运行离开 导航守卫、`beforeEach`、中间件、`beforeEnter`、页面/布局导入和 `beforeResolve`。一旦授权，独立的加载器在条目创建期间同时启动；原生演示并不等待他们的承诺。中止、重定向或取代的预提交导航永远不会启动该目的地的加载程序。失败的代码导入也会阻止加载。

| 操作                                           | 数据行为                                     |
| ---------------------------------------------- | -------------------------------------------- |
| 初始路由、推送、替换、`force`、更改的参数/查询 | 新条目获取新的加载程序状态。                 |
| 重复导航，无 `force`                           | 无新条目或加载。                             |
| Back，选项卡开关，显示被覆盖的页面             | 保留状态；没有自动重新获取。                 |
| 重建保存的 导航栈                              | 导航守卫 之后的新加载器；数据/结果未序列化。 |
| 深层链接或 `setStack`                          | 新创建的条目加载；保留的公共前缀保留其数据。 |
| 模态                                           | 自己的条目；解雇将取消其待发布的内容。       |
| 删除，原生 Back 或路由器/窗口资源清理          | 取消待处理的尝试，清除结果，忽略迟到的响应。 |
| 用另一页覆盖另一页/模态                        | 保留的条目可以完成其请求。                   |

`meta.loaders` 接受定义/名称或数组。所有匹配的父项和子项声明都会贡献；子进程的 `[]` 不会删除父进程的加载程序。重复定义对象每个条目运行一次，包括名称和对同一对象的内联引用。未知名称/无效定义会在启动任何同级加载程序之前拒绝导航。

数据异常和被拒绝的承诺变为 `error` 状态，包括当它们在呈现后到达时。他们不会拒绝 `router.push()` 或致电 `router.onError()`。配置、组件导入和原生导航失败保留现有的导航错误行为。通过返回的状态或数据客户端处理或记录数据错误。

## 取消和现有缓存 {#cancellation-and-an-existing-cache}

上下文包含`to`、`from`（始发导航栈的路由）、`isCancelled()`和`onCancel(callback)`。 `onCancel` 返回取消订阅函数。它在 **pending** 尝试被取代或其条目被资源清理时运行，如果在取消后注册，则立即运行。已完成的尝试释放其回调。取消会立即解决 `ready` 并防止延迟成功/错误发布，即使基础请求继续也是如此。

本合约有意不公开浏览器 `AbortSignal`。 NativeScript Core 9.1.3 的中止信号使用其 Observable 事件合约；它不能与每个 HTTP 客户端信号互换。要中止仅由该调用拥有的工作，请将 `onCancel` 调整为您的客户端支持的取消 API。路由器不会随意取消共享请求。

例如，重用应用程序拥有的 Promise 缓存：

```ts
const products = new Map<string, Promise<Product>>()

export const productData = defineRouteLoader(({ to }) => {
  const id = String(to.params.id)
  let request = products.get(id)
  if (!request) {
    request = fetchProduct(id) // Your existing client, returning Promise<Product>.
    products.set(id, request)
    const own = request
    void own.catch(() => {
      if (products.get(id) === own) products.delete(id)
    })
  }
  return request
})
```

两个条目可以重复使用一个请求；删除一个只会丢弃其结果订阅。另一个仍然收到数据。该应用程序拥有缓存范围、帐户边界、到期、失效和网络取消。 `reload()`再次调用加载器；如果您想要新的网络请求，请先使缓存无效。这个小示例删除了失败，以便显式重试可以再次请求，但会保留成功的值，直到应用程序使它们无效。

## 可选文件路径 {#optional-file-routes}

在同一路由器上注册命名定义：

```ts
createRouter({ routes, loaders: { product: productData } })
```

然后使用现有的 [文件路由元数据](./file-routing) 声明一个文字名称：

```vue
<script setup lang="ts">
import { definePageMeta } from 'vue-router-ns/file-routing'
definePageMeta({ meta: { loaders: ['product'] } })
</script>
```

对于原生 Vite HMR，请改用页面的 `.route.json`，与其他元数据一样：

```json
{ "meta": { "loaders": ["product"] } }
```

名称在该路由器的注册表中解析，在创建时捕获。页面仍然导入`productData`并调用`useRouteData(productData)`进行推理。没有隐式加载程序发现或自动导入。仅模板HMR可以保留相同的条目状态；替换加载器定义或更改其注册需要完全重新加载以保持页面/注册表身份一致。路由表更改适用于新创建的条目。

## 当目的地必须等待时 {#when-the-destination-must-wait}

异步 [导航守卫](./guards) 仍然是必须在导航之前完成的工作的现有选项。例如授权导航守卫可以返回`false`或者重定向；稍后的 `beforeResolve` 可以等待您的应用程序缓存。这会延迟导航并在抛出异常时使用导航错误处理。在受保护的请求之前保留授权。不要从加载程序启动另一个导航来实现授权。

此 API 提供显式反应式 UI 状态。它不添加自动 Suspense 边界或需要异步页面设置；保持根Page同步。请参阅选择加入的 [native Suspense 组合](./suspense) 以了解渲染器兼容性、异步内容和显式加载程序消耗。

## 原生示例和录音 {#native-example-and-recordings}

[完整示例](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/loaders-app.ts)使用真实的本地HTTP端点和应用程序拥有的缓存。两个记录均显示待处理、成功、HTTP 失败、在同一 Page 上重试，以及在请求待处理时返回。

<div class="clips">
<Clip name="ios-loaders" caption="iOS：原生页面在加载产品数据时保持响应。" />
<Clip name="android-loaders" aspect="9 / 20" caption="Android：HTTP 错误并重试保留原生 Page 和历史记录。" />
</div>

使用 `--env.loadersTest` 和 `node scripts/native/loaders/server.mjs` 运行演示。本地端点需要仅固定装置的传输设置和 Android 端口转发。有关确切的命令和验证范围，请参阅 [复制和接受](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-route-data.md)。
