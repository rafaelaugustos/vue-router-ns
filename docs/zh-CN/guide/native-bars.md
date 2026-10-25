# 原生吧和搜索 {#native-bars-and-search}

有关所有权、平台边界和 rc.2/rc.3 区别，请参阅 [native 功能和容器选择](./capabilities)。

要跨标题、菜单和键盘共享状态、异步执行和错误处理，请参阅 [页面操作](./page-actions)。

将标题和动作保留在 NativeScript 的 `ActionBar` 中。它拥有原生工具栏/UINavigationBar、委托和后退按钮。反应式标题和 `ActionItem` 绑定已经可以使用，包括从细节返回时。在iOS、`iosLargeTitle="true"`上启用原生折叠标题；使用原生滚动视图作为页面内容。 Android 在标准 ActionBar 中没有等效的大标题策略。

<Clip name="ios-search" caption="原生搜索字段过滤收件箱而不添加路由。 iOS 26模拟器。" />

## 搜索页面拥有的 {#search-owned-by-a-page}

```vue
<script setup lang="ts">
import { computed, ref } from 'nativescript-vue'
import { useNativeSearch } from 'vue-router-ns'

const query = ref('')
const search = useNativeSearch({ query, placeholder: 'Search messages' })
const messages = ref([{ subject: 'Welcome' }])
const filtered = computed(() =>
  messages.value.filter((message) =>
    message.subject.toLowerCase().includes(query.value.toLowerCase()),
  ),
)
</script>

<template>
  <Page>
    <ActionBar title="Inbox" iosLargeTitle="true">
      <ActionItem text="Search" ios.position="right" @tap="search.activate()" />
    </ActionBar>
    <ListView :items="filtered">
      <template #default="{ item }"><Label :text="item.subject" /></template>
    </ListView>
  </Page>
</template>
```

`useNativeSearch({ query, placeholder?, onSubmit?, ios?: { hidesWhenScrolling?, placement? } })` 在路由页面的设置中注册一次。 `query` 是应用程序拥有的可写 ref。将其保留在页面中以维持其 back-导航栈 生命周期，或保留在存储中以在页面删除/重新启动时保持持久性。键入永远不会推送路由或更改 URL 查询；如果这是您的应用程序的政策，则明确导航到提交。 `placeholder` 接受字符串、ref 或 getter。 `onSubmit(query)` 是可选的。

结果为只读 `active`、ref、`activate(): boolean` 和 `dismiss(): boolean`。激活需要加载页面，当前页面位于其自己的 Frame 中，位于其选定的选项卡中，并且不被模式覆盖。关闭将关闭搜索 UI/键盘并保留查询。返回页面不会自动调用键盘。两个可见的分割窗格都可以独立拥有自己的搜索。 导航守卫 拒绝不会影响搜索。

| 平台    | 演示                                                                                                                                                                                                                                                                                                                                   |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS 11+ | 其 `UINavigationItem` 中的页面本地 `UISearchController`。默认情况下，搜索字段在滚动时隐藏；设置 `ios.hidesWhenScrolling: false` 以保持其可见。 `ios.placement` 是 `automatic`、`stacked`、`inline` 或 `integrated`（iOS 26，在底部）。在 `TabView` 中，默认值为 `stacked`，位于标题下：iOS 26 的自动放置将该栏放在底部、选项卡栏后面。 |
| Android | NativeScript 的 `SearchBar` (`androidx.appcompat.widget.SearchView`) 在活动时暂时成为现有 ActionBar 的标题视图。关闭后会返回之前的标题视图。 ActionItems 仍归 NativeScript 所有。                                                                                                                                                      |

现有的搜索控制器被保留：激活返回 false 并且开发版本解释了冲突。每页仅注册一个搜索所有者。搜索绑定和原生委托在页面处理、路由器主机处理和 HMR 替换上发布。没有替换全局栏或导航委托，并且 left-导航守卫 `backAction` 拦截保持不变。

## 外观超越NativeScript款式 {#appearance-beyond-nativescript-styles}

首选 ActionBar `color`、`backgroundColor`、`flat`、`title`、`titleView` 和 ActionItem。如果需要 UIKit 特定的外观，请配置 **页面的导航项**，而不是共享导航栏。加载的处理程序可以访问 `event.object.ios.navigationItem`：

```ts
function loaded({ object: page }) {
  if (!__IOS__ || !page.ios) return
  const appearance = UINavigationBarAppearance.new()
  appearance.configureWithDefaultBackground()
  page.ios.navigationItem.standardAppearance = appearance
  page.ios.navigationItem.scrollEdgeAppearance = appearance
}
```

这是 iOS 13+ 应用程序配方，需要 iOS 键入。如果多个应用程序功能对其进行修改，则保留任何现有的每项外观。保持 ActionItems 声明性，不要分配 `backAction` 或替换导航控制器委托：路由器使用这些委托来进行受保护的返回导航。 UIKit 在弹出时恢复上一页自己的导航项，包括取消的交互式弹出。

请参阅 [NativeScript ActionBar](https://docs.nativescript.org/ui/action-bar)、[UISearchController](https://developer.apple.com/documentation/uikit/uisearchcontroller) 和 [页面生命周期](./pages)。
