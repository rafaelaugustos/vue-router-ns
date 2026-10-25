# 可选的原生布局 {#optional-native-layouts}

显式路由记录保留默认值。仅当您想要在目标之间共享原生 `Page`、其 `ActionBar` 和主体结构时，才需要注册布局。布局使用 NativeScript-Vue 组件和插槽，具有与现有页面相同的原生条目、导航守卫 和历史记录。未添加 Nuxt 运行时、Vue Router 或 WebView。

## Page 和 ActionBar 的一名所有者 {#one-owner-for-page-and-actionbar}

选定的布局拥有条目的 **one 根 `Page`** 及其可选的 **one `ActionBar`**，直接位于 Page 内部。它的默认槽只渲染一次目的地。目标提供正文内容，没有另一个 `Page` 或 `ActionBar`。

```vue
<!-- layouts/Default.vue -->
<script setup lang="ts">
import { useRoute } from 'vue-router-ns'

const route = useRoute()
</script>

<template>
  <Page>
    <ActionBar :title="String(route.meta.title ?? 'My app')" />
    <GridLayout padding="16">
      <slot />
    </GridLayout>
  </Page>
</template>
```

```vue
<!-- pages/Account.vue: content for a configured layout -->
<script setup lang="ts">
import { ref } from 'nativescript-vue'

const name = ref('')
</script>

<template>
  <StackLayout>
    <Label text="Account" />
    <TextField v-model="name" hint="Your name" />
  </StackLayout>
</template>
```

将共享 ActionItems、导航按钮和原生 Page 属性放入布局中。它可以读取条目的 `useRoute().meta` 来选择其标题/操作。浏览器 Nuxt 布局和 HTML 标记不会转换为原生视图。

## 注册并明确选择 {#register-and-select-explicitly}

```ts
import { createRouter } from 'vue-router-ns'

const router = createRouter({
  layouts: {
    default: () => import('./layouts/Default.vue'),
    compact: () => import('./layouts/Compact.vue'),
  },
  defaultLayout: 'default',
  routes: [
    {
      path: '/account',
      component: () => import('./pages/Account.vue'),
      meta: { title: 'Account' },
    },
    {
      path: '/preview',
      component: () => import('./pages/PreviewBody.vue'),
      meta: { layout: 'compact', title: 'Preview' },
      modal: true,
    },
    {
      path: '/legacy',
      component: () => import('./pages/LegacyPage.vue'),
      meta: { layout: false },
    },
  ],
})
```

`layouts` 接受组件对象或工厂，包括惰性 `.vue` 导入。创建路由器时会捕获注册表。除非明确设置，否则 `defaultLayout` 是 `false`：单独注册名为 `default` 的组件不会激活它。 `meta.layout` 选择注册名称或 `false` 选择退出。如果没有选定的布局，目标将遵循现有合约并拥有自己的根 `Page`，如上面的 `LegacyPage.vue` 所做的那样。

元数据从父级合并到子级。子级继承其父级的布局，除非它提供其他名称或 `false`。布局选择/加载发生在条目 导航守卫 和中间件之后，组件加载发生在 `beforeResolve` 之前；选择路线记录中的布局或较早的 导航守卫。未知的默认值在创建路由器时失败。未知的路由布局或导入失败会拒绝导航并在安装任何原生页面之前到达 `onError()`。导入失败可以重试。

此运行时 API 中没有文件系统发现。可选的文件路由和构建集成仍然是独立的路线图工作；显式路由数组现在可以与布局一起使用。

## 生命周期和原生行为 {#lifetime-and-native-behavior}

布局代码可以被缓存，但 **每个原生条目都有自己的布局和目标实例**。本地参考不会在访问之间共享，包括重复路径。有盖入口保持安装状态；返回 Back 揭示其现有的 Page 和状态。弹出或替换该条目会卸载其布局和内容与原生页面。

两个组件接收相同的条目绑定 `useRoute()`、导航栈 绑定 `useRouter()` 和原生宿主。路线属性及导航`props` 前往目的地。布局/页面激活挂钩，保留 导航守卫，模态结果和可访问性焦点使用现有的条目生命周期。在布局中注册的 导航守卫 可以保护该条目，就像其内容中的 导航守卫 一样。

布局和内容共享条目的钩子命名空间：给 `usePageState()` 不同的键，并为该条目仅安装一个 `useNavigationFocus()` 所有者。它的目标可能位于任一组件内。正常的原生手势限制仍然适用；请参阅 [导航守卫](./guards) 和 [accessibility](./accessibility)。

布局是每页，而 `RouterTabs`、`RouterDrawer` 和 `RouterSplitView` 是持久性应用程序容器。将这些容器保留在页面布局之外。选择其他布局不得创建另一个 Frame、替换选项卡栏或展平 导航栈。

## 变化、HMR 和诊断 {#changes-hmr-and-diagnostics}

创建条目时，所选布局是固定的。更改路线的元数据或实时路线的 `meta.layout` 不会交换现有条目的原生 Page。要显示不同的布局，请导航到新条目或显式替换当前条目（替换相同路径时为 `force: true`）。更改注册表或 `defaultLayout` 配置需要创建新路由器；不提供动态注册表突变 API。

在开发过程中，布局或目标的脚本 HMR 使用 NativeScript-Vue 的现有原生 Page 替换。如果另一页覆盖其 Frame 中的条目，则替换等待 Frame 返回。被丢弃的条目会丢弃其挂起的重新加载。保留条目/历史身份；重新安装可能会重置本地设置参考。仅模板更新遵循 Vue 的正常 HMR 行为。

开发诊断可识别丢失的根 Page、嵌套的目标页面、冲突/错位的 ActionBar 以及遗漏/重复的目标插槽。这些是创作警告，而不是生产渲染器或修复机制：无效的原生树仍然不受支持，NativeScript-Vue/Core 可能会拒绝它们。仅保留一个布局拥有的根 Page 并渲染其默认插槽一次。
