# 路由代码预加载（实验性） {#route-code-preloading-experimental}

用户触摸卡片时，可以先准备延迟加载目标的代码，之后的导航再复用该工作。准备过程解析目标及声明式重定向，仅加载最终匹配的路由组件。它不会导航、显示标签页、创建窗口、挂载 Vue/原生视图、运行守卫或启动数据加载器。父页面和布局仍在导航时正常加载。

此功能是可选的实验性功能。只有调用 `router.preload(to)` 或 `useRoutePreload()` 返回的函数时，router 才开始推测性工作。

## 从页面准备 {#prepare-from-a-page}

延迟加载工厂应只导入代码。以下配置展示默认值：

```ts
const router = createRouter({
  routes: [
    { path: '/', component: () => import('./Home.vue') },
    { path: '/products/:id', name: 'product', component: () => import('./Product.vue') },
  ],
  preload: { concurrency: 2, maxEntries: 16, ttl: 30_000 },
})
```

在路由页面的 setup 中获取 `useRoutePreload()`。每次调用都独立持有对代码的需求；页面或作用域释放时自动取消这些需求。放弃手势时取消准备。保留需求直到导航完成，以便异步守卫之后仍能复用。普通按钮提供无需长按的无障碍入口。示例标签为英文。

```vue
<script setup lang="ts">
import type { TouchGestureEventData } from '@nativescript/core'
import { useRouter, useRoutePreload, type RoutePreload } from 'vue-router-ns'

const router = useRouter()
const prepare = useRoutePreload()
const to = { name: 'product', params: { id: '42' } } as const
let interest: RoutePreload | undefined
let inside = false

function abandon() {
  inside = false
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
function touch(event: TouchGestureEventData) {
  if (event.action === 'down') {
    abandon()
    inside = true
    interest = prepare(to)
  } else if (event.action === 'cancel') {
    abandon()
  } else if (event.action === 'move') {
    const size = event.view.getActualSize()
    if (
      event.getX() < 0 ||
      event.getY() < 0 ||
      event.getX() > size.width ||
      event.getY() > size.height
    )
      abandon()
  } else if (event.action === 'up' && inside) {
    inside = false
    void open().catch(console.error)
  }
}
</script>

<template>
  <Page>
    <ActionBar title="Products" />
    <StackLayout>
      <GridLayout height="160" backgroundColor="#19385c" @touch="touch">
        <Label text="Hold to prepare, release to open" color="white" />
      </GridLayout>
      <Button text="Open product" @tap="open().catch(console.error)" />
    </StackLayout>
  </Page>
</template>
```

## 结果与所有权 {#outcomes-and-ownership}

`RoutePreload` 提供只读的 `state`、`ready` Promise 和 `cancel()`。当前状态为 `queued`、`loading`、`ready`、`error` 或 `cancelled`。错误包含 `error`；取消包含 `reason`：`cancelled`、`expired`、`invalidated`、`disposed` 或 `capacity`。

`ready` 不会拒绝。它只以首次就绪、错误或取消结果结算一次。已就绪的需求随后仍可能取消或过期；当前状态会改变，但 Promise 保留原始结果。就绪不代表获得导航授权，也不保证之后仍保留缓存。

```ts
const interest = router.preload({ name: 'product', params: { id: 42 } })
const result = await interest.ready
if (result.status === 'error') console.error(result.error)
interest.cancel()
router.clearPreloads()
```

页面 helper 在页面或组件作用域释放时取消需求。直接调用的 `router.preload(to)` 属于该 router；绑定到导航栈的 router 在栈关闭时释放需求。router/窗口永久关闭会使所有准备失效。不同 router 使用独立的池。解析遵循 `router.resolve()`，包括从调用方导航栈解析相对 params，且不会改变焦点。

## 限额与失效 {#budgets-and-invalidation}

| 选项          | 默认值    | 策略                                                                                                      |
| ------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| `concurrency` | 2         | 同时执行的推测性工厂上限。已授权导航可以提升排队中的目标，无需等待无关工作。                              |
| `maxEntries`  | 16        | 待处理/就绪路由记录上限。达到限额时淘汰最久未使用的就绪记录；若全部仍待处理，则以 `capacity` 拒绝新需求。 |
| `ttl`         | 30,000 ms | 从记录首次请求起的最长生命周期，包含排队和加载时间。复用不会延长期限。                                    |

值必须为有限正整数。已取消但仍执行的导入会占用名额直到结束。没有消费者的排队工作不会执行。同一路由不同 params 的消费者共享代码，不共享页面状态或数据。取消一个消费者不会取消其他消费者或已共享该导入的授权导航。普通导航先启动的导入也可被共享。

移除/替换路由、生成路由表的 HMR，以及组件工厂变化都会使旧准备失效。退出登录、切换账户或显式失效时使用 `router.clearPreloads()`。迟到的完成结果不会重新填充该推测性池。原地修改 Vue 组件的 HMR 仍由 Vue 管理。准备状态不会跨进程死亡持久化。

限额约束 router 持有的推测性引用和工作数量，不限制已导入模块的字节数。取消不能中断正在执行的 JavaScript 导入、撤销模块初始化副作用、卸载 JavaScript 模块缓存，或清除导航后的普通组件缓存。准备过期或失败后，获授权的导航会退回正常加载。

## 授权与原生证据 {#authorization-and-native-evidence}

代码预加载会在导航守卫之前执行延迟加载工厂及模块初始化。不要把受保护的数据请求、凭据或导航副作用放在那里。受保护的数据应保留在[获授权的路由加载器](./data-loading)中。实际导航始终运行正常守卫；守卫重定向可能选择另一个目标。此阶段不提供推测性数据 API，也不要求缓存框架。

<Clip name="route-code-preload" :width="480" aspect="3 / 4" caption="冷启动/已准备触摸导航、放弃拖动、守卫拒绝及所有者释放。工厂包含受控的 900 ms 延迟；这些时间不是导入性能基准。iOS 18.6 模拟器；演示标签为英文。" />

原生 fixture 在提交前统计 Page、Frame、UIViewController 和 Vue app 的构建，比较来源的精确历史，并记录守卫/数据调用。真实触摸序列展示了无需这些分配的准备、拒绝和释放。原生证据来自 iOS 模拟器，不代表已验证实体硬件、Android 原生输入或内存回收。契约测试覆盖共享消费者、限额、失效和窗口所有权。参见[验证报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-route-preload-stage1.md)及 [API 参考](./api#route-code-preloading)。
