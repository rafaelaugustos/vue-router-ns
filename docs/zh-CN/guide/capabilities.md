# 原生功能和容器选择 {#native-capabilities-and-container-choices}

尝试 [Fieldnotes，集成的原生示例](./native-showcase)，在一个应用程序中跟踪 抽屉导航、搜索、共享操作、导航守卫 和模态结果。

从您的应用程序需要显示的内容开始，然后选择原生所有者。 NativeScript 提供页眉和控件；路由器提供路由标识、导航守卫、结果以及原生 导航栈 之间的协调。该应用程序提供内容、业务操作和持久性策略。

本页描述了 **0.1.0-rc.3**，与之前的 **0.1.0-rc.2** 基线进行了比较。下面的“现有”是指在rc.2中已经可用； “rc.3”标识需要新候选或本地存储库构建的添加内容。该软件包仍然是候选版本，而不是 1.0 的稳定性承诺。详细指南仍然是 API 参考。

## 查找功能 {#find-a-capability}

下面的示例是存储库路径。按照[演示设置](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/README.md)；在运行选择加入示例之前构建包。 [兼容性表](./compatibility) 记录依赖性基线。

| 需要                                   | 所有者/可用性                                            | 平台边界                                                                        | 指南和可运行源                                                                                                                                                                                          |
| -------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 原生页眉和页面按钮                     | Core `ActionBar` / `ActionItem`； iOS 上现有             | UIKit 导航栏，Android 上的原生工具栏                                            | [原生栏](./native-bars)； [`Inbox.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Inbox.vue)，正常演示                                                                   |
| 折叠大标题                             | Core `ActionBar iosLargeTitle`；现有的                   | iOS 具有原生滚动内容。标准 Android ActionBar 没有等效的折叠 Material 应用栏策略 | [Native 栏](./native-bars)；正常演示收件箱                                                                                                                                                              |
| 原生页面搜索                           | 路由器 `useNativeSearch`;现有                            | iOS `UISearchController`； Android SearchView 在现有 ActionBar 标题视图中       | [搜索所有权](./native-bars#search-owned-by-a-page)；正常演示收件箱                                                                                                                                      |
| 项目上下文操作和预览                   | 路由器菜单集成、应用程序回调；现有                       | iOS 原生预览/菜单； Android 具有显式打开操作的原生弹出窗口                      | [上下文菜单](./context-menus)； [`MessagePreview.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/components/MessagePreview.vue)，正常演示收件箱                                |
| 共享标头/菜单/键盘操作                 | 路由器 `usePageActions` / `PageActionItem`； **rc.3**    | 跨受支持的原生表面共享资格/忙/错误处理；应用程序仍执行保存/共享/删除            | [Page 操作](./page-actions)； [`actions-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/actions-app.ts)，`--env.actionsTest`                                        |
| 键盘命令                               | 路由器注册和原生密钥调度；现有的                         | 物理键盘/平台快捷方式行为不同                                                   | [Keyboard](./keyboard)； [`navigation-commands.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/navigation-commands.ts)，正常演示                                                |
| 抽屉/持久自定义菜单                    | 路由器 `RouterDrawer`                                    | Android 覆盖现有； iOS 叠加和自适应/永久呈现 **rc.3**                           | [Drawer](./drawer)； [`adaptivedrawer-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/adaptivedrawer-app.ts)，`--env.adaptivedrawerTest`                            |
| 独立选项卡历史记录 / iPad 选项卡侧边栏 | 具有原生宿主的路由器 `RouterTabs`； iOS 18+ 上现有的     | UIKit 选项卡/侧边栏； Android 材料底部导航/导轨，带有记录的 Core 后备           | [Tabs](./tabs)； [`App.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/App.vue)，正常演示                                                                                      |
| 自适应列表/详细信息                    | 路由器 `RouterSplitView`，单独的原生框架；现有           | 跨平台，包括可选的Android折叠几何形状                                           | [Split](./split-view)；正常演示收件箱                                                                                                                                                                   |
| UIKit 控制分列                         | 路由器 `RouterUIKitSplitView`；实验性，现有              | iOS 18+；拥有窗口根目录。不是 抽屉导航 或选项卡                                 | [UIKit split](./split-view#opt-in-uikit-columns) 的子项； [`uikitsplit-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/uikitsplit-app.ts)，`--env.uikitsplitTest`   |
| 原生模态和类型化结果                   | 路由器路由表示，原生模态主机；现有的                     | 内部历史是独立的；工作表行为/依赖性不同                                         | [Modals](./modals)； [`Compose.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Compose.vue)，正常演示                                                                    |
| 缩放/共享元素/预测 Back                | UIKit/Core 过渡和路由器协调；现有的                      | iOS 变焦需要 18+ 和运行时 API； Android 进度需要14+。无通用交互控制器           | [Transitions](./transitions)、[所有权限制](./interactive-transitions)； [`Transitions.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Transitions.vue)，正常演示中的设置 |
| 导航诊断                               | 路由器选择加入收集器/导出；现存的。浏览器查看器 **rc.3** | 逻辑/原生状态和计时，而不是原生堆/FPS 或实时时间旅行                            | [Diagnostics](./diagnostics)、[viewer](./diagnostics-viewer)； [`Diagnostics.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Diagnostics.vue)，正常演示中的设置          |
| 多个原生窗口/娱乐                      | 每个原生窗口一个路由器；现有的                           | 已发布的依赖关系基线和特定于平台的会话/任务重建测试                             | [Windows](./windows)； [`windows-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/windows-app.ts)，`--env.windowsTest`                                               |

标志从 `demo` 运行，例如 `ns run ios --env.actionsTest` 或 `ns run android --env.actionsTest`。仅 iOS 的灯具需要 iOS。大标题、标题、搜索和菜单不需要新的“原生导航标题”子系统。

## 选择一个容器 {#choose-a-container}

| 容器                       | 它拥有什么                                   | 当 时使用它                                                                                     |
| -------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `RouterView`               | 一个原生 Frame 及其路线 导航栈               | 您需要普通的推送/返回导航。                                                                     |
| `RouterTabs` + `RouterTab` | 目标选择和每个选项卡中安装的框架             | 目标应保留独立的历史记录。 `sidebar` 更改了 UIKit 的选项卡呈现方式；它不会创建通用的 抽屉导航。 |
| `RouterDrawer`             | 围绕已安装内容的菜单；没有自己的路线历史记录 | 您需要自定义导航内容或自适应持久菜单。它的按钮选择是否按下、打开链接或重置 导航栈。             |
| `RouterSplitView`          | 一种基于 Frame 的列表/详细信息排列及其改编   | 一个逻辑流应扩展为窗格。它可以是 抽屉导航 内容或位于选项卡内。                                  |
| `RouterUIKitSplitView`     | 窗口的原生 `UISplitViewController` 和列      | 您明确想要 UIKit 列/根所有权并接受实验/平台限制。                                               |

永久的 抽屉导航、UIKit 的选项卡侧边栏和 UIKit 拆分列可能看起来都像侧边栏。他们的历史和控制者所有权不同；根据所有权进行选择，而不仅仅是外表。

## 组成具有独立目的地的 抽屉导航 {#compose-a-drawer-with-independent-destinations}

保持已安装的容器和名为 Frames 的状态。调整 抽屉导航 的 `presentation`，而不是用 `v-if` 切换整个键控树：

```vue
<RouterDrawer ref="drawer" presentation="auto" :breakpoint="840">
  <template #drawer>
    <StackLayout>
      <Button text="Inbox" @tap="router.openLink('/')" />
      <Button text="Settings" @tap="router.openLink('/settings')" />
    </StackLayout>
  </template>
  <RouterTabs>
    <RouterTab name="inbox" title="Inbox">
      <RouterView name="inbox" />
    </RouterTab>
    <RouterTab name="settings" title="Settings">
      <RouterView name="settings" initial="/settings" />
    </RouterTab>
  </RouterTabs>
</RouterDrawer>
```

该片段属于与路由器一起安装的应用程序。配置`links.frame`为`/settings`选择`settings`，否则选择`inbox`； [、抽屉导航 导轨、](./drawer) 和 [可运行的 抽屉导航 夹具](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/drawer-app.ts) 提供完整的设置。 `openLink` 选择所属目的地及其 导航栈。成功导航会关闭叠加层 抽屉导航；被拒绝的 导航守卫 使其保持打开状态。选择目的地并不是隐式历史重置。

**不支持的组合：** `<RouterDrawer><RouterUIKitSplitView /></RouterDrawer>` 要求两个容器拥有不兼容的原生根。在抽屉导航内部使用`RouterSplitView`，或者将`RouterUIKitSplitView`作为窗口根并在那里设计其列。不要重新安装 `RouterView` 来模拟转换；这样做会丢弃其原生历史和页面标识。

## 状态、焦点和可及性 {#state-focus-and-accessibility}

保留的 Page 保持其 Vue 状态，而另一页覆盖它。 `usePageState` 在进程死亡后选择小可串行化状态进行恢复；它不保留承诺或原生对象。搜索查询所有权属于应用程序，搜索激活必须针对当前符合条件的页面。 [Page actions](./page-actions) 也拒绝被覆盖、不活跃或已资源清理所有者的执行。

对 抽屉导航 目的地使用带有清晰辅助功能标签的原生按钮，保留菜单/Back 来替代手势，并使用 [navigation focus](./accessibility) 声明焦点目标。荣誉减少运动。自动原生层次结构检查并不是语音 VoiceOver/TalkBack 焦点的证据。每个链接的验证报告都说明了其局限性。

## 建议不发货能力 {#proposals-are-not-shipped-capabilities}

[交互式过渡调查](./interactive-transitions) 提出了边界，而不是新的通用 API 或 Jolt 集成。 [Core 拥有的 Android 预览版](./android-back#experimental-core-owned-preview) 需要未发布的固定候选者； Core 9.1.3 回落。本概述不承诺折叠 Material Android 应用栏、实时诊断传输和任意自定义主机手势奇偶校验。
