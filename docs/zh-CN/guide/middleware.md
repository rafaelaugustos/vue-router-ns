# 可选的中间件和导航助手 {#optional-middleware-and-navigation-helpers}

显式路由记录和 `router.push()` 仍然是默认 API。您可以选择对这些相同的记录使用命名中间件和导航助手。他们使用现有的匹配器、导航守卫 交易和原生 导航栈； Nuxt 和 Vue Router 都不是依赖项。

这是可选 Nuxt 风格约定的中间件/帮助器部分。文件路由、命名布局和自动导入工具是单独的路线图项目，不由这些 API 启用。所有示例都使用显式导入。

## 在路由器上注册中间件 {#register-middleware-on-your-router}

```ts
import { createRouter, defineRouteMiddleware } from 'vue-router-ns'

const auth = defineRouteMiddleware((to, from, { type }) => {
  if (!session.user) {
    return { name: 'login', query: { next: to.fullPath }, replace: true }
  }
})

const router = createRouter({
  routes: [
    { path: '/', component: () => import('./Home.vue') },
    { path: '/login', name: 'login', component: () => import('./Login.vue') },
    {
      path: '/account',
      component: () => import('./Account.vue'),
      meta: { middleware: ['auth'] },
    },
  ],
})

const removeAuth = router.addRouteMiddleware('auth', auth)
router.addRouteMiddleware(
  'metrics',
  (to, from, info) => {
    // Observe this guarded navigation. Return nothing to continue.
  },
  { global: true },
)
```

在安装应用程序之前注册以覆盖初始导航。注册属于该路由器实例，包括其 导航栈 和模态。它不创建进程范围的单例。重复的名字会抛出；返回的处理程序会取消该注册，并且可以安全地重复调用。 `defineRouteMiddleware()` 仅键入功能；它不注册它。

`meta.middleware` 接受名称、函数或名称/函数的只读数组。父级元数据照常合并到目标中：子级的 `middleware` 替换父级的列表。使用`[]`清除继承的中间件；全局中间件仍在运行。未知名字抛出并到达`router.onError()`。

## 执行和结果 {#execution-and-results}

每个受保护的导航运行：

1. 在要删除的条目上保留 导航守卫。
2. `beforeEach` 导航守卫，按注册顺序。
3. 全局中间件，按注册顺序，然后是目标中间件，按声明顺序。
4. `beforeEnter` 在新输入的记录上，然后是组件加载器，用于推送/替换。
5. `beforeResolve`，原生操作，则`afterEach`。

A repeated middleware name, or repeated inline function reference, runs once in the middleware phase.也在元数据中列出的全局名称运行一次。 The phase snapshots registrations after `beforeEach`; unregistering during an asynchronous middleware does not change that attempt's snapshot. A function separately installed as a `beforeEach` 导航守卫 is a separate registration and still runs at that phase.

中间件使用与 [导航守卫](./guards) 相同的 `(to, from, { type })` 和返回值：`false` 中止；原生路由位置重定向； `true`/`undefined`继续；等待着承诺。投掷拒绝导航并到达`onError()`一次。重定向重用现有的导航机制和重定向限制。 **从中间件返回目的地；不要从其内部调用 `router.push()` 或 `navigateTo()`。** 它们会使用通常的取消语义启动另一个导航，而不是返回 导航守卫 决策。

中间件运行用于初始导航、推送、替换和路由器介导的返回，包括重复访问同一记录。除非设置了 `force`，否则仍会跳过到当前页面的重复导航。在背面，它检查目标的元数据，而不是被删除的页面。使用页面的离开 导航守卫 来保护其未保存的工作。

## 在所属 导航栈 中导航 {#navigate-in-the-owning-stack}

在路由页面的设置中，捕获助手一次：

```vue
<script setup lang="ts">
import { useNavigateTo, useRoute } from 'vue-router-ns'

const navigateTo = useNavigateTo()
const route = useRoute()

function openAccount() {
  return navigateTo('/account')
}
</script>

<template>
  <Page>
    <Button text="Account" @tap="openAccount" />
  </Page>
</template>
```

即使当另一个 导航栈 获得焦点时，捕获的帮助程序仍然绑定到该页面的 导航栈。 `useRoute()` 在被覆盖时仍然描述该特定页面条目。在组件卸载或处理其条目后调用帮助程序会被拒绝，而不是在不同的 导航栈 中导航。 `useNavigateTo()` 需要路由页面的设置。

在设置之外，显式传递所属路由器：

```ts
import { navigateTo } from 'vue-router-ns'

await navigateTo(router, '/account', { frame: 'settings', replace: true })
```

命名位置继承提供的路由器的路由名称和参数类型。 `useNavigateTo()` 选取路由器的 [类型注册](./typed-routes)。选项是现有的 `NavigationOptions` 加上 `replace`：框架、模态、过渡、动画、clearHistory、属性，withParents 和 zoomFrom 保留其原始含义。位置自己的 `replace: true` 也保留其现有行为。

Promise 与 `router.push()`/`replace()` 具有相同的结果：成功时为 `undefined`，拒绝/取消/重复时为 `NavigationFailure`，或错误时拒绝。当原生操作完成时它就稳定下来。打开模式在演示时解决；使用 `router.pushForResult<T>()` 等待该模式关闭时返回的结果。没有第二个历史记录或浏览器式转发 导航栈。

## 原生限制和支持的约定 {#native-limits-and-supported-conventions}

中间件具有与全局 导航守卫 相同的原生手势限制。 Android Back 经过路由器。不受保护的 iOS 原生弹出可以在 JavaScript 看到它之前完成，因此中间件之后无法否决它。当异步决策运行时，活动的 `onBeforeRouteLeave()` 保持 iOS 向后滑动和可取消的模态解除；请参阅 [导航守卫 行为](./guards#what-the-platform-does-while-a-guard-is-active)。单独的中间件不会安装页面离开 导航守卫 或禁用原生手势。

这些助手接受原生路由位置。外部 URL、浏览器 `open`/`external` 选项和服务器 `redirectCode` 不受支持并被拒绝。中间件重定向也拒绝外部 URL。对于应用程序/通用链接，请使用 `router.openLink()` 及其 URL 策略；要打开浏览器，请显式使用 NativeScript 的平台 API。

此 API 中没有文件系统发现或自动导入安装。显式注册/导入无需构建工具即可工作。任何未来的发现都必须通过相同的 API 进行注册并报告名称冲突，而不是覆盖处理程序。
