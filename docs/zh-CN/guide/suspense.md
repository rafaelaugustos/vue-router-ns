# 原生悬念成分（实验） {#native-suspense-composition-experimental}

保持路由的 **Page 同步** 并将 Vue 的 `Suspense` 放在其异步周围
内容。 Page、ActionBar、transition和history继续属于原生
路由器。此配方是选择性加入的，并且不添加路由器组件或自动包装器。

## 渲染器兼容性优先 {#renderer-compatibility-comes-first}

在 **NativeScript-Vue 3.1.2 / Vue 3.5.44** 上，股票悬念抛出
`No known component for element div.` Vue 请求渲染器进行隐藏暂存
容器；此渲染器不注册该元素。导出 `Suspense` 会
本身并不能使其在原生页面上可用。

该示例在启动应用程序之前显式将该名称注册为原生布局：

```ts
import { GridLayout } from '@nativescript/core'
import { getViewMeta, registerElement } from 'nativescript-vue'

registerElement('div', () => GridLayout, getViewMeta('GridLayout'))
```

这是一个**应用程序范围的兼容性注册**，使用公共渲染器
API。该名称必须未被使用；不要覆盖现有的注册或放置
每个页面都会调用这个。它为 Vue 创建一个独立的原生 GridLayout 来暂存
待定内容，然后将已解析的分支移动到可见的原生树中。
它不引入 HTML、浏览器渲染或 WebView。

仅将配方与您已验证的版本一起使用。 Vue 悬念是实验性的，
和暂存名称是测试的 Vue 运行时的实现细节。复查
升级任一渲染器后进行此调整；未来的本地实现
可能会变得不必要。库存行为和调整后的配方分别进行测试
在[兼容性报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-suspense.md)中。

## 显式使用路由加载器 {#consume-a-route-loader-explicitly}

通过[路由数据加载](./data-loading)声明`productData`。路线开始
授权后的请求。该子项消耗该条目的现有尝试：

```vue
<!-- ProductContent.vue -->
<script setup lang="ts">
import { useRouteData } from 'vue-router-ns'
import { productData } from './product-data'

const product = useRouteData(productData)
const ready = product.ready
await ready
const current = product.ready === ready
if (current && product.status.value === 'error') throw product.error.value
const data = current ? product.data.value : undefined
</script>

<template>
  <StackLayout v-if="data">
    <Label :text="data.title" />
    <Label :text="'$' + data.price" />
  </StackLayout>
</template>
```

`ready` 解析成功，错误 **并取消**。而是检查状态
比假设解决意味着成功。子设置中的 `await` 是异步的
依赖性；仅从加载程序返回 Promise 不会使 Vue 挂起。
尝试身份检查会丢弃被取代的尝试。孩子不再去取。这里捕获 `data` 是有意的快照
此尝试，因此旧内容在稍后的超时期间可以保持可见。

同步页面拥有错误捕获和显式重试：

```vue
<script setup lang="ts">
import { onErrorCaptured, ref } from 'nativescript-vue'
import { useRouteData } from 'vue-router-ns'
import ProductContent from './ProductContent.vue'
import { productData } from './product-data'

const product = useRouteData(productData)
const error = ref(false)
const attempt = ref(0)
onErrorCaptured(() => {
  error.value = true
  return false
})
function retry() {
  // Invalidate your application cache here if it retains the failed request.
  void product.reload()
  error.value = false
  attempt.value++
}
</script>

<template>
  <Page>
    <ActionBar title="Product" />
    <StackLayout padding="24">
      <Label text="Product details" />
      <StackLayout v-if="error">
        <Label text="Could not load product. Please try again." />
        <Button text="Retry" @tap="retry" />
      </StackLayout>
      <Suspense v-else :timeout="0">
        <ProductContent :key="attempt" />
        <template #fallback>
          <StackLayout>
            <ActivityIndicator :busy="true" />
            <Label text="Loading product…" />
          </StackLayout>
        </template>
      </Suspense>
    </StackLayout>
  </Page>
</template>
```

每个插槽使用一个原生根。捕获同步父级中的错误
边界，呈现单独的错误视图，并针对已处理的错误返回 `false`。
Suspense 的加载回退不是错误边界。 Put注入和生命周期
在普通`async setup()`中的`await`之前注册；编译顶级
await 恢复 Vue 的设置上下文，但不更改请求所有权。

## 内容生命周期 {#content-lifecycle}

| 案例                          | 合约                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| 第一个挂起的子                | 原生回退出现在现有 Page 内。                                                             |
| 分辨率                        | 内容替换后备； Page、ActionBar 和历史记录保持不变。                                      |
| `reload()` 单独               | 不重新运行已安装的异步设置或自动显示回退。                                               |
| 默认槽根                      | 的键控替换 启动新的异步子项。 `timeout="0"` 立即显示回退；正超时会保留旧分支直至其过期。 |
| 未更改的根下面的新异步内容    | 不会自动将外部边界返回到挂起状态。在需要时使用显式嵌套边界。                             |
| 嵌套 `<Suspense suspensible>` | 内部边界参与其父级的异步依赖项处理。                                                     |
| 覆盖的页面或非活动选项卡      | 其拥有的请求可能会完成；解决时不会选择该页面。                                           |
| Back 或模态驳回               | 路由器资源清理取消结果发布； Vue 丢弃已删除的异步子树。                                  |
| 已取消原生 Back 手势          | Page、挂起的子项和请求仍然存在。                                                         |

该示例记录 `pending`、`fallback` 和 `resolve` 事件。这些描述了
Vue 内容边界，不是原生导航完成。 [Vue 导轨](https://vuejs.org/guide/built-ins/suspense.html)
定义它们的语义；这个配方不提供React并发渲染
或 React 转换 API。

应用程序拥有其缓存和网络工作。一个请求可能有两个页面等待；去除
不得中止共享请求。原始异步设置仍然是 JavaScript 并且
在其组件被处理后继续。 Guard应用程序的副作用和使用
装载机取消该条目单独拥有的工作合同。从来没有
从异步完成回调发起导航，将结果发布到已移除的页面。

## Page 边界、延迟和可访问性 {#page-boundaries-deferred-and-accessibility}

`RouterView` 周围的悬念不会包装单独安装的原生页面应用程序。
不要使 Page 本身异步，将 Page 放在加载边界内，或者
使用此配方来包装整个原生导航器。惰性路由导入加载代码
演示前；装载机开始数据工作； Suspense 等待异步内容
组件。这是三个不同的阶段。

`Deferred` 在安装其内容之前等待原生页面激活。确实如此
不等待数据。将悬念 **inside** 当两种行为都发生时推迟
；当子进程等待挂载时，加载程序可能已经在运行。

将 ActionBar 和可访问的标题保留在更改内容之外。的
示例使用具有稳定航向的 `useNavigationFocus`。它不会移动焦点
；原生运动政策仍然存在
路由器的责任。自动检查Page和航向标识；
这并不是说 VoiceOver/TalkBack 公告已被手动审核。
本节没有引入单独的安全区域或键盘布局。

## 原生示例 {#native-example}

[完整夹具](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/suspense-app.ts)
包括股票渲染器负控制、显式注册、
应用程序拥有的 HTTP 缓存、异步设置/SFC/惰性子项和生命周期检查。
请参阅 [复制命令和测试范围](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-suspense.md)。

<div class="clips">
<Clip name="ios-suspense" caption="iOS：待处理内容、捕获错误并在同一原生 Page 内重试。" />
<Clip name="android-suspense" aspect="9 / 20" caption="Android：Vue 具有显式原生暂存容器和共享路由数据的 Suspense。" />
</div>
