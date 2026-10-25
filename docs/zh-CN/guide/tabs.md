# 导航栈等独立选项卡 {#tabs-and-other-independent-stacks}

有关所有权、平台边界和 rc.2/rc.3 区别，请参阅 [native 功能和容器选择](./capabilities)。

`<RouterTabs>` 将名为 导航栈 的名称放在原生选项卡栏后面，并使两者保持同步：

```vue
<RouterTabs v-model:selected="tab" sidebar minimize="onScrollDown">
  <RouterTab name="inbox" title="Inbox" icon="tray.fill" androidIcon="sys://ic_dialog_email" :badge="unread">
    <RouterSplitView name="inbox" list="/" backToRootOnReselect />
  </RouterTab>
  <RouterTab name="settings" title="Settings" icon="gearshape.fill">
    <RouterView name="settings" initial="/settings" backToRootOnReselect />
  </RouterTab>
</RouterTabs>
```

<div class="clips">
<Clip name="ios-tabs" caption="选项卡保留自己的历史记录。再次点击“收件箱”会将其返回到其根目录。 iOS 26模拟器。" />
<Clip name="android-tabs" aspect="9 / 20" caption="Material 底部导航后面的相同 导航栈。 Android 16 模拟器。" />
</div>

- **iOS** 是 `UITabBarController`，`UITab` 位于 iOS 18 及更高版本上：`icon` 是 SF 符号，`badge` 出现在选项卡上， `sidebar` 在 iPad 上打开 UIKit 的侧边栏，`minimize="onScrollDown"` 让 iOS 26 栏在滚动时缩小，`role="search"` 制作搜索选项卡。
- **Android** 是 Material 的 `BottomNavigationView`，或来自 `rail` 的 `NavigationRailView` (600) 宽度与设备无关的像素； `androidIcon` 是可绘制名称或 `sys://` 加上 `android.R.drawable` 名称。如果没有材质库，核心 `TabView` 将在底部渲染； `supportsNativeTabs()` 告诉。
- 导航到另一个选项卡中的 导航栈 会首先将该选项卡向前推进，因此 `router.push(to, { frame: 'settings' })` 和深层链接会出现在视图中。切换选项卡运行无路由导航守卫； `canSelect(name)` 可以拒绝点击，`select`/`reselect` 事件说明发生了什么。 `v-model:selected` 保存选项卡的名称。

最多使用五个目的地，以便它们适合 Android 底杆和导轨。 `:rail="0"` 使底部栏保持在每个宽度。调整杆和导轨之间的尺寸可以保留安装的 导航栈 及其历史记录。

`canSelect` 适用于用户选择。更改为 `selected` 并导航到名为 导航栈 的位置，直接选择它；保护路由为 导航守卫 的路由。目标选项卡在导航运行之前显示，包括当 导航守卫 随后拒绝该导航时。在页面之外，`router.currentRoute`、导航和Android 返回遵循可见选项卡。

路由器将导航栈历史记录保存为`restore`。如果应用程序应在进程终止后返回同一选项卡，则单独保留 `v-model:selected`；恢复 导航栈 不会更改该选择。

## 在详细信息页面上隐藏导航 {#hide-navigation-on-a-detail-page}

在路线上设置 `meta.tabBarVisibility`。所选选项卡的提交首页控制其所属的 `RouterTabs`：

```ts
const router = createRouter({
  routes: [
    { path: '/inbox', component: Inbox },
    {
      path: '/inbox/detail',
      component: Message,
      meta: { tabBarVisibility: 'hidden' },
    },
    { path: '/saved', component: Saved },
  ],
})

// From Inbox: the existing Frame pushes Message and the bar disappears.
await router.push('/inbox/detail', { frame: 'inbox' })
// Native Back or router.back() restores Inbox and its bar.
```

将此路由表与上面的两个 `RouterTab` / `RouterView` 导航栈 一起使用。保留原生 Back 按钮或以其他方式返回隐藏页面。

| 值               | 含义                                             |
| ---------------- | ------------------------------------------------ |
| `hidden`         | 隐藏支撑的底部栏或材料轨并释放其布局空间。       |
| `visible`        | 显示导航，包括标记为 `hidden` 的父路线内部。     |
| `inherit` 或省略 | 使用具有显式值的最接近的匹配父级；否则显示导航。 |

继承遵循匹配的路由记录，而不是历史记录中的前一页。显式路由和文件路由（`definePageMeta({ meta: { tabBarVisibility: 'hidden' } })`）使用相同的策略。

原生导航提交 **后，策略更改**，但不添加动画。推送、替换、原生 Back、根重置、恢复和传入链接都使用提交的路由。待处理/拒绝的 导航守卫、页面加载失败或取消的交互式 Back 会保留当前演示文稿。在交互手势期间，当前页面的栏状态保持在原位直到完成；减少的运动不会获得额外的条形动画。

每个选项卡都会记住自己的策略。选择另一个选项卡将使用该选项卡的当前页面；它保留历史记录和页面实例。模态框保持其呈现选项卡不变。嵌套的 `RouterTabs` 拥有自己的策略，单独的容器/窗口不共享它。每个选项卡使用一个 `RouterView` 或 `RouterSplitView`；对于拆分导航，逻辑顶部路由提供策略。处理后恢复UIKit原来的状态。

| 主机                                            | 支持                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| iOS 18+底部标签栏                               | 公共 UIKit `setTabBarHidden:animated:`; UIKit 重新计算安全区域。                         |
| `sidebar` on iOS                                | 保持原生导航可见，包括紧凑的演示文稿。禁用 `sidebar` 以使用每页隐藏。                    |
| Android 材质底部栏/导轨                         | 折叠原生视图及其自动调整大小的布局行/列；隐藏的导航被排除在辅助功能之外。                |
| 较旧的 UIKit / Android Core 后备/普通 `TabView` | 无每页隐藏。现有的导航仍然可见。 `supportsNativeTabs()` 单独不检查 iOS 版本/侧边栏限制。 |

<div class="clips">
<Clip name="ios-tabs-visibility" caption="详情页隐藏栏；承诺的导航将恢复它。 iOS 26模拟器。" />
<Clip name="android-tabs-visibility" aspect="9 / 20" caption="材料底杆和导轨释放其空间而无需更换页面。 Android 14 模拟器。" />
</div>

可运行示例：[`demo/src/testing/tabsvisibility-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/tabsvisibility-app.ts)。构建包，然后在 `demo` 中运行 `ns run ios --env.tabsvisibilityTest` 或 `ns run android --env.tabsvisibilityTest`。 [原生验收说明](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/tabs-visibility)涵盖真实手势、导航守卫、布局、还原和冷链接。

## 颜色和标签 {#colors-and-labels}

在`RouterTabs`上使用NativeScript现有的选项卡颜色名称。这些更新当前的原生栏，无需重新挂载页面或重置历史记录：

```vue
<script setup lang="ts">
import { ref } from 'nativescript-vue'
import { RouterTabs, RouterTab, RouterView } from 'vue-router-ns'
const dark = ref(false)
</script>

<template>
  <RouterTabs
    :tabBackgroundColor="dark ? '#172033' : '#f1f5f9'"
    :tabTextColor="dark ? '#cbd5e1' : '#475569'"
    :selectedTabTextColor="dark ? '#38bdf8' : '#2563eb'"
    labelVisibility="labeled"
  >
    <RouterTab
      name="inbox"
      title="Inbox"
      icon="tray.fill"
      androidIcon="sys://ic_dialog_email"
      :badge="2"
    >
      <RouterView name="inbox" initial="/inbox" />
    </RouterTab>
    <RouterTab
      name="saved"
      title="Saved"
      icon="bookmark.fill"
      androidIcon="sys://ic_menu_save"
    >
      <RouterView name="saved" initial="/saved" />
    </RouterTab>
  </RouterTabs>
</template>
```

| 属性                   | CSS                       | 含义                                                                           |
| ---------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| `tabBackgroundColor`   | `tab-background-color`    | 原生栏背景/色调。                                                              |
| `tabTextColor`         | `tab-text-color`          | 未选择的标题；还有 UIKit 和材质上的模板图标。                                  |
| `selectedTabTextColor` | `selected-tab-text-color` | 所选标题；还有 UIKit 和材质上的模板图标。                                      |
| `labelVisibility`      | —                         | 材质：`auto`、`selected`、`labeled` 或 `unlabeled`。省略使用小部件的默认主题。 |

颜色属性接受字符串或 NativeScript `Color`。您可以改为使用 `RouterTabs` 上的类：

```css
.app-tabs {
  tab-background-color: #f1f5f9;
  tab-text-color: #475569;
  selected-tab-text-color: #2563eb;
}
.ns-dark .app-tabs {
  tab-background-color: #172033;
  tab-text-color: #cbd5e1;
  selected-tab-text-color: #38bdf8;
}
```

该类应用于原生根（iOS/核心后备上的 `TabView`，Material 上的 `RouterTabsHost`）。对两个平台都使用类选择器。这些选项卡颜色不会从父项继承，也不会更改页面颜色。显式 props 和内联样式是本地 NativeScript 值，并且优先于样式表规则；避免将两者设置为相同的颜色。省略的颜色保留平台/主题默认值。固定颜色在深色模式下不会自动反转：绑定调色板或使用 NativeScript 的浅色/深色 CSS 类。更改调色板或类会更新现有小部件，包括调整大小后创建的导轨。

Material 支持底部导航和导轨上的所有四种标签模式。隐藏标签会保留其标题和可访问性描述。 UIKit 和核心 `TabView` 忽略 `labelVisibility` 并保留其原生标题布局。 Core Android 后备支持背景/文本的三种现有颜色属性；图标色调仍然是 Core 的行为。材料仍然是可选的。

在 iOS 上，这些颜色使用 Core 的外观 API 和 UIKit 模板图标色调来设置 **选项卡栏** 的样式。它们没有为 iPad 侧边栏提供主题。 UIKit 控制侧边栏行、位置、标题可见性和 iOS 26 液体玻璃合成；渲染的背景可能是半透明的，而不是平坦的精确颜色。在 iOS 26 接受记录中，UIKit 还保留了未选择的 SF 符号的系统颜色，尽管接受了配置的图标色调；标题和所选图标确实发生变化。不要依赖于该版本上确切的未选择图标颜色。现有的 `TabView` CSS（包括标题字体）在该主机上继续工作；额外的 Core-only 属性不是跨平台的 Material 合约。

<div class="clips">
<Clip name="ios-tabs-style" caption="打开详细信息页面时更改选项卡颜色。 iOS 26模拟器。" />
<Clip name="android-tabs-style" aspect="9 / 20" caption="颜色、标签和材料导轨发生变化，同时 导航栈 仍保持安装状态。 Android 14 模拟器。" />
</div>

使用 `cd demo && ns run ios --env.tabsstyleTest`（或 `ns run android --env.tabsstyleTest`）运行 [共享示例](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/tabsstyle-app.ts)。它包括调色板、标签和导轨控件以及草稿字段。有关自动检查，请参阅 [native 验收](https://github.com/rafaelaugustos/vue-router-ns/blob/main/scripts/native/tabs-style/README.md)。

## iPad 上的侧边栏 {#sidebar-on-ipad}

<Clip name="ipad-tabs" :width="480" aspect="3 / 4" caption="UIKit 的侧边栏选择收件箱和设置，每个都有自己的 导航栈。 iPadOS 26模拟器。" />

## Android 发布版本中的材料 {#material-in-android-release-builds}

NativeScript 的调试运行时包含 Material，但发布版本需要 `App_Resources/Android/app.gradle` 中的显式依赖项：

```groovy
dependencies {
  implementation "com.google.android.material:material:1.12.0"
}
```

`supportsNativeTabs()` 报告材料是否可用。该栏在存在时使用应用程序的 Material 主题；否则它只会将 Material 主题应用于小部件，包括其徽章。在没有依赖关系的情况下，`<RouterTabs>`使用核心底层`TabView`并保留命名选择和独立的导航栈；材料徽章和导轨不可用。

## 其他选项卡容器 {#other-tab-containers}

不过，任何选项卡容器都可以。每个 导航栈 使用一个 `<RouterView>` 并将其命名为：

```vue
<TabView>
  <TabViewItem title="Inbox">
    <RouterView name="inbox" initial="/" backToRootOnReselect />
  </TabViewItem>
  <TabViewItem title="Settings">
    <RouterView name="settings" initial="/settings" backToRootOnReselect />
  </TabViewItem>
</TabView>
```

页面在自己的选项卡中导航。从其他任何地方，以 `{ frame: 'settings' }` 为目标。

## 点击活动选项卡 {#tapping-the-active-tab}

`backToRootOnReselect` 仅适用于已选择的选项卡上的新点击。切换到另一个选项卡会保留这两个历史记录。更新 `v-model:selected` 或导航/深层链接到另一个选项卡不算作重新选择。被拒绝的 `canSelect` 使选择和历史记录保持不变；离开 导航守卫 可以拒绝重新选择 root。

当您点击已经打开的选项卡时，原生选项卡栏会返回到第一页。 `backToRootOnReselect` 通过离开 导航守卫 为 `<TabViewItem>` 内的 `<RouterView>` 执行此操作，就像任何背部一样。 `router.backToRoot()` 按需执行相同操作。

在 iOS 上，路由器在选项卡栏代理前面进行侦听，否则代理会对重复点击回答“否”并且不会告诉任何人。在 Android 上，它会监视选项卡条的触摸，因为它自己的点击侦听器仅切换选项卡。

## 尚未显示的选项卡 {#tabs-that-haven-t-been-shown-yet}

在iOS上，`TabView`仅加载选定的选项卡。另一个选项卡中的 `<RouterView>` 会等待其第一页，直到该选项卡打开，并且导航到该选项卡（例如深层链接）也会随之等待。其他 导航栈 中的导航不会被阻止。

在 `<RouterTabs>` 内，定位 `{ frame: 'settings' }` 会选择页面显示之前的选项卡。对于普通的 `TabView`，请自行更新其 `selectedIndex`，然后等待 `router.push(to, { frame: 'settings' })`。 `RouterView` 和 `RouterSplitView` 中的名称必须是唯一的。
