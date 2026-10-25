# API {#api}

这是查找参考。从 [您的第一个应用程序](./first-app) 开始学习流程，从 [常见任务](./recipes) 开始选择 API，或从 [容器选择](./capabilities) 决定导航所有权。

## 创建路由器 {#creating-a-router}

```ts
import { createRouter } from 'vue-router-ns'

const router = createRouter({ routes, restore, backPreview: true })
```

| 选项          | 默认    | 含义                                                                                                                                                       |
| ------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diagnostics` | `false` | `true` 或 `{ maxEvents }` 用于有界时间线和原生快照。请参见 [diagnostics](./diagnostics)。                                                                  |
| `routes`      | 必需    | `RouteRecordRaw` 的只读数组。                                                                                                                              |
| `restore`     | 禁用    | `save(state)`、`load()`、可选 `maxAge`（默认值：30 分钟）和 `stateLimit`（默认值：每页字节数） 8 KiB）。请参阅 [restoration](./restore)。                  |
| `backPreview` | `true`  | 在 Android 14+ 返回手势 期间显示上一页。 `false` 禁用它；实验性 `'core'` 尝试建议的 Core API 和旧版回退。需要 [平台选择加入](./android-back#enabling-it)。 |
| `links`       | 禁用    | `true` 或 `{ schemes, hosts, map, frame, options, system }` 获取操作系统 URL。请参阅[深层链接](./deep-links#receiving-operating-system-urls)。             |

使用 `createApp(App).use(router).start()` 安装一次。这将注册组件并在模板中提供 `$router` 和 `$route`。 `router.install(app)` 是 Vue 插件挂钩。

## 路由器方法 {#router-methods}

`to` 是 `RouteLocationRaw`：路径字符串、`{ path, query?, hash? }`、`{ name, params?, query?, hash? }` 或相对于当前路线的位置。对象位置还接受 `replace` 和 `force`。使用 `force: true` 推送当前位置的另一个实例。参数属于命名或相对位置，而不是 `path` 对象。

| 方法                             | 行为                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `push(to, options?)`             | 添加页面或呈现模态框。                                                                                                |
| `replace(to, options?)`          | 替换当前页。                                                                                                          |
| `back(options?)`                 | 弹出一页；在其根部关闭模式。在非模态根处它什么也不做。 Android的系统回来仍然可以离开应用程序。                        |
| `go(delta)`                      | 后退负数页。零和正值没有任何作用。不接受任何选项参数。                                                                |
| `backTo(to, options?)`           | 返回顶部下方最接近的匹配页面；如果缺席则拒绝。                                                                        |
| `backToRoot(options?)`           | 返回当前 导航栈 的第一页。                                                                                            |
| `setStack(locations, options?)`  | 将非空位置列表与 导航栈 进行协调。保留公共前缀；在第一次失败时停止，而不回滚已完成的步骤。                            |
| `pushForResult<T>(to, options?)` | 打开页面并等待 `back({ result })`。当关闭或打开被阻止时解析为 `T \| undefined`。                                      |
| `resolve(to)`                    | 无需导航即可同步解析位置。返回`RouteLocation`；抛出一条不匹配的路线。                                                 |
| `isReady()`                      | Promise 初始导航后稳定；不等待每个隐藏选项卡加载。                                                                    |
| `openLink(url, options?)`        | 按照操作系统的方式打开完整 URL 或裸路径：通过 `links`，与父级一起，在第一页和目标 导航栈 之后。解析为 `LinkResult`。  |
| `resolveLink(url)`               | `links` 或 `undefined` 下的 `RouteLocation` URL 指向。                                                                |
| `onLink(listener)`               | 侦听路由器被移交（无论是否被占用）的每个链接。返回取消订阅函数。                                                      |
| `setShortcuts(shortcuts)`        | 将主屏幕快捷方式（Android 动态快捷方式、iOS 快速操作）替换为通过 `openLink` 打开的 `RouteShortcut`。返回已发布的 id。 |
| `shortcutURL(id, to)`            | 用于静态快捷方式资源或应用程序拥有的原生集成的版本化有效负载。                                                        |
| `pinShortcut(shortcut)`          | 请求 Android 启动器固定； `true` 表示已请求，而非用户确认。                                                           |
| `claimSystemBack(claimant)`      | 让原生容器 (`{ owns(), back() }`) 首先进行 Android 前后滑动，就像打开的 抽屉导航 一样。返回释放函数。                 |

`push`、`replace`、`back`、`go`、`backTo`、`backToRoot` 和 `setStack` 解析为 `NavigationFailure | undefined`。意外错误拒绝；请参阅 [失败](./navigating#failures-and-errors)。在拆分 导航栈 中调用时，Back 方法具有 [拆分视图语义](./split-view#history-and-back)。

### 导航选项 {#navigation-options}

`push`、`replace` 和 `pushForResult` 接受 `NavigationOptions`：

| 选项           | 含义                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `frame`        | 将 导航栈 命名为目标。否则使用调用者的页面 导航栈，或页面外的焦点 导航栈。不选择 `TabView` 选项卡。 |
| `transition`   | 名称，例如 `'fade'` 或 NativeScript 过渡对象；覆盖默认路由。包括 `SharedTransition`。               |
| `animated`     | 设置 `false` 跳过动画。                                                                             |
| `clearHistory` | 删除较早的页面，以 导航守卫 为准。拆分后的 导航栈 保留其列表。                                      |
| `props`        | 额外页面属性，合并在路线记录属性上。 `restore` 未保留。                                             |
| `modal`        | `true`、`false` 或 `ModalOptions`；覆盖路线的呈现。                                                 |
| `withParents`  | 将组件承载祖先推到目的地之前。                                                                      |
| `zoomFrom`     | 视图、元素 ref、组件或 `null`；原生iOS 18+变焦源。                                                  |

`back`、`backTo` 和 `backToRoot` 接受 `BackOptions`：`animated`、`frame` 和 `result`。 `go(delta)` 没有 options 参数。 `setStack` 接受 `SetStackOptions`：`frame`、`animated` 和 `transition`；动画仅适用于最后一步。

### 路线和挂钩 {#routes-and-hooks}

| 方法                                                | 返回值                                     |
| --------------------------------------------------- | ------------------------------------------ |
| `addRoute(record)` / `addRoute(parentName, record)` | 删除添加的路由的回调。                     |
| `removeRoute(name)`                                 | `void`。删除已注册的路线；不弹出现有页面。 |
| `hasRoute(name)`                                    | `boolean`.                                 |
| `getRoutes()`                                       | 标准化 `RouteRecord[]`。                   |
| `beforeEach(guard)` / `beforeResolve(guard)`        | 取消注册 导航守卫 的回调。                 |
| `afterEach((to, from, failure?) => …)`              | 注销钩子的回调。                           |
| `onError((error, to, from) => …)`                   | 取消注册处理程序的回调。                   |

`NavigationGuard`接收`(to, from, { type })`，其中`type`是`'push'`、`'replace'`或`'back'`。它可以返回一个承诺。返回 `false` 以中止，返回位置以重定向，或返回 `undefined`/`true` 以继续。守卫使用返回值，而不是 `next()`。参见 [导航守卫](./guards)。

### 可选的中间件和助手 {#optional-middleware-and-helpers}

`router.addRouteMiddleware(name, guard, { global }?)` 注册一个命名中间件并返回其处理程序。目标 `meta.middleware` 接受名称/函数或只读数组。中间件在 `beforeEach` 之后运行，首先是全局变量，然后是目标列表，在 `beforeEnter` 之前。 `defineRouteMiddleware(guard)` 键入一个函数而不注册它。

`useNavigateTo()` 捕获页面设置中的帮助程序，绑定到该页面的 导航栈。外部设置使用带有显式上下文的 `navigateTo(router, to, options?)`。两者都委托推送/替换并返回 `Promise<NavigationFailure | undefined>`。选项：`NavigationOptions` 加 `replace`。型号：`RouteMiddleware`、`RouteMiddlewareReference`、`RouteMiddlewareOptions`、`NavigateTo`、`NavigateToOptions`。有关订购、资源清理、支持的约定和原生手势限制，请参阅 [可选中间件和帮助程序](./middleware)。

### 状态 {#state}

- `currentRoute`：只读 ref 到聚焦路线，包括活动模态。
- `stack`：只读 ref 到按从下到上顺序的路由。页面绑定路由器公开该页面的 导航栈；导出的路由器遵循聚焦的 导航栈。
- `diagnostics`: `RouterDiagnostics` 启用时；否则为 `undefined`。请参阅 [诊断](./diagnostics)。
- `options`：路由器配置。
- `START_LOCATION`：初始导航之前的空位置（`path: '/'`，没有匹配的记录）。

## 位置和路线记录 {#locations-and-route-records}

`RouteLocation` 包含 `path`、`fullPath`、`name`、`params`、`query`、`hash`、`meta`、`matched` 和`redirectedFrom`。解析的参数是字符串或字符串数​​组。查询值为字符串、`null`或数组；输入查询值还接受数字、布尔值和 `undefined`。 `meta` 将父级合并到子级。

`RouteRecordRaw` 接受 `path`、`name`（字符串或符号）、`component`（组件或同步/异步加载程序）、`children`、`redirect`（位置或函数）、`meta`、`props` （`true`、对象或映射器）、`beforeEnter`（导航守卫 或数组）、`modal`（`boolean` 或 `ModalOptions`）和 `transition`。

路径支持命名参数、可选/重复参数和自定义模式。请参见 [类型路由](./typed-routes)。 `children` 嵌套路径和元数据；它不会自动创建嵌套 UI。

`ModalOptions` 转发 NativeScript `showModal` 选项，但路由器拥有的 `context` 和 `closeCallback` 除外。其 `ios` 选项还接受 `detents`、`selectedDetent`、`largestUndimmedDetent`、`grabber` 和 `cornerRadius`。请参阅 [模态和板材](./modals)。

## 可选文件路由 API {#optional-file-routing-apis}

仅节点 `vue-router-ns/file-routing/webpack` 为 webpack 5 导出 CommonJS 兼容的 `NativeFileRoutesPlugin`。`vue-router-ns/file-routing/setup` 导出 `prepareFileRouting(options)`、`FileRoutingOptions` 和 `PreparedFileRouting`。这些可选的构建条目生成平台模块和类型；他们生成的 `installFileRouting(router)` 注册发现的中间件并处理路由表 HMR。请参阅 [设置和支持](./file-routing)。

仅节点 `vue-router-ns/file-routing/vite` 为 Vite 导出 `nativeFileRoutes(options)` 和 `NativeFileRoutesOptions` 8。原生 HMR 使用可选的相邻 JSON 元数据 (`metadataFiles: true`)； `definePageMeta` 需要捆绑 Vite 构建，同时上游宏转换限制仍然存在。独立设置接受 `bundler: 'vite'`；默认值仍为 webpack。

`vue-router-ns/file-routing` 导出类型化编译时 `definePageMeta()` 宏、`PageMeta`、`PageMetaValue`、`mergeFileRoutes(generated, explicit)` 和 `createFileRouteUpdater(router, routes)` (`FileRouteUpdater`)。更新程序会更改未来的匹配，同时保留原生条目。

仅节点 `vue-router-ns/file-routing/generator` 导出 `generateFileRoutes(options)`、`writeFileRoutes(options)`、`watchFileRoutes(options, callbacks)`、`transformPageMeta(source, filename)` 和 `FileRouteError`；型号：`FileRoutesOptions`、`GeneratedFileRoutes`、`FilePage`。编译器对等体是可选的，只有构建工具才需要。有关约定、元数据限制、HMR 所有权和集成状态，请参阅 [文件路由](./file-routing)。

## 可选的原生布局 {#optional-native-layouts}

`createRouter({ layouts, defaultLayout })` 注册每个路由器的原生布局组件/工厂。 `defaultLayout` 默认为 `false`； `meta.layout` 选择注册名称或使用 `false` 选择退出。该布局拥有根Page和可选的ActionBar；目标通过默认槽提供其主体。每个条目的布局选择都是固定的，每次访问都有单独的布局/内容实例。未知名称/导入失败在安装前被拒绝。有关生命周期、HMR、诊断和创作示例，请参阅 [native 布局](./layouts)。

## 路线数据（实验） {#route-data-experimental}

`defineRouteLoader(load)`从`(context) => value | PromiseLike<value>`推断数据结果。在`meta.loaders`中声明； `createRouter({ loaders })` 可以选择注册显式/文件生成的元数据的名称。根据定义，匹配的父声明和子声明是可添加和去重复的。

`useRouteData(loader)` 返回每个条目的只读引用 `data`、`error`、`status`、当前尝试 `ready`、Promise 和 `reload()`。两个承诺都决定成功、失败或取消；数据错误保持在状态中。加载在授权后开始，并且不会阻止原生呈现。有关取消、生命周期、缓存所有权和原生示例，请参阅 [数据加载](./data-loading)。

导出类型：`RouteLoader<T>`、`RouteLoaderContext`、`RouteLoaderReference`、`RouteData<T>`、`RouteDataStatus`。

## 可组合项 {#composables}

| 函数                                   | 合约                                                                                                                                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useRouter()`                          | 绑定当前页面导航栈的路由器；页面外部的应用程序路由器。需要使用路由器的应用程序。                                                                                                                                                 |
| `useRoute(name?)`                      | 本页固定路由，或者页面外的聚焦路由。可选名称缩小了类型范围；它不会选择另一条路线。                                                                                                                                               |
| `onBeforeRouteLeave(guard, { when }?)` | Page 离开 导航守卫。 `when` 接受布尔值、ref 或 getter。卸载时删除。                                                                                                                                                              |
| `onPageActivated(hook)`                | 当页面变得可见时调用，包括其第一次激活和返回。                                                                                                                                                                                   |
| `onPageDeactivated(hook)`              | 被覆盖时调用。如需拆卸，请使用 Vue 的 `onUnmounted`。                                                                                                                                                                            |
| `useBackGesture()`                     | 只读浅 ref 至 `{ progress, edge }` 或 `null`； Android 14+。 `edge` 是 `'left'`、`'right'` 或 `'none'`。                                                                                                                         |
| `usePageState(key, options)`           | 在进程死亡期间保持 JSON 兼容的页面状态：`save`、`restore(value, { version, page })`、可选的 `version` 和 `migrate`。路由器上需要 `restore`。参见[页面状态](./restore#page-state)。                                               |
| `useNativeFlow(flow)`                  | 将`NativeFlow`（系统选择器，另一个应用程序的活动）绑定到页面：`run(input, { before })` 与`completed`、`cancelled` 或`failed` 解析一次； `running` ref。 `createDocumentPicker()`为内置流量。请参见 [native 流](./native-flows)。 |

在路由组件的设置中注册页面挂钩。在展开的分割视图中，列表和顶部详细信息均处于活动状态。请参阅 [page 生命周期和 HMR](./pages)。

## 组件 {#components}

| 组件                   | 属性和插槽                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RouterView`           | `name`（`'default'`），`initial`（`'/'`），`backToRootOnReselect`（`false`）。安装一个 Frame。                                                                                                                                                                                                                                                                                                                      |
| `RouterSplitView`      | 必填 `list`； `name` (`'default'`)、`breakpoint` (840)、`listWidth` (320)、`foldAware` (`true`、Android)、`backToRootOnReselect` (`false`)。插槽：`empty`。                                                                                                                                                                                                                                                         |
| `RouterUIKitSplitView` | 必填 `list`； `name`（`'default'`）、`primaryWidthFraction`（`0.32`）。窗口根 UIKit 主/辅列，iOS 18+ 与 Core SplitView。请参见 [UIKit 列](./split-view#opt-in-uikit-columns)。                                                                                                                                                                                                                                      |
| `RouterDrawer`         | `width` (300)、`open` (`v-model:open`)、`closeOnNavigate` (`true`)。槽位：默认内容和`drawer`。事件 `opened`、`closed`； ref、`open()`、`close()`、`toggle()`、`isOpen`。仅限 Android； iOS 渲染内容。参见 [Android 抽屉导航](./drawer)。                                                                                                                                                                            |
| `RouterTabs`           | `selected`（`v-model:selected`，选项卡名称）、`canSelect(name)`、`sidebar`（iOS 18+）、`minimize` (`'never'`、iOS 26 `'onScrollDown'`/`'onScrollUp'`)、`rail` (600、Android)； `tabBackgroundColor`、`tabTextColor`、`selectedTabTextColor`、`labelVisibility`（材料）。事件 `select`、`reselect`。子代：`RouterTab` 与 `name`、`title`、`icon`（SF 符号）、`androidIcon`、`badge`、`role`。请参见 [tabs](./tabs)。 |
| `RouterLink`           | 必填 `to`； `replace`、`clearHistory`、`withParents`、`zoom`（全部 `false`）； `transition`、`frame`； `menu`（`RouteMenuOptions`：长按预览路线）。一个默认槽子项；插槽接收 `{ navigate }`。添加一个没有原生包装器的点击处理程序。                                                                                                                                                                                  |
| `Deferred`             | 无属性。插槽：默认内容和`fallback`。在页面首次激活后显示内容并在之后保持其安装状态。在路由页面之外，立即呈现。                                                                                                                                                                                                                                                                                                      |

`v-route-preview`（导出为 `vRoutePreview`，由 `install` 注册）在任何视图上采用 `RoutePreviewOptions`：`to`、`preview`、`props`、`canPreview`、 `size`、`actions`、`openTitle` 和导航选项。 `attachRouteMenu(view, router, options)` 和 `detachRouteMenu(view)` 在没有 Vue 的情况下执行相同的操作。请参阅 [上下文菜单预览](./context-menus)。

路由器视图名称必须是唯一的，包括分割视图。挂载时读取`name`和初始路由（`initial`/`list`）；使用新的 Vue `key` 创建不同的 导航栈。分割视图尺寸是与设备无关的像素；列表宽度上限为可用宽度的一半。请参见 [分割视图](./split-view)。

## 失败和导出类型 {#failures-and-exported-types}

`isNavigationFailure(value, type?)` 标识 `NavigationFailure`（`Error` 与 `type`、`to`、`from`）。 `NavigationFailureType` 有 `aborted` (4)、`cancelled` (8) 和 `duplicated` (16)；可选类型参数还接受位掩码。

公共类型从包根导出：

- 标签：`RouterTabDescriptor`、`TabMinimize`、`TabRole`、`TabLabelVisibility`、`TabBarVisibility`； `supportsNativeTabs()`。
- 路由器配置：`Router`、`RouterOptions`、`SystemBackClaimant`、`RouterDrawerHandle`、`RestoreOptions`、`SavedStacks`、`SavedEntry`、`SavedState`、`PageStateOptions`、 `PageStateContext`。
- 路线：`RouteRecordRaw`、`RouteRecord`、`RouteRecordName`、`RouteMeta`、`RouteProps`、`RouteComponent`、`RawRouteComponent`、`Lazy`。
- 地点：`RouteLocation`、`RouteLocationRaw`、`RouteLocationPathRaw`、`RouteLocationNamedRaw`、`RouteLocationRelativeRaw`、`RouteParams`、`RouteParamsRaw`、`RouteParamValue`、`RouteParamValueRaw`、 `LocationQuery`、`LocationQueryRaw`、`LocationQueryValue`、`LocationQueryValueRaw`。
- 导航：`NavigationOptions`、`BackOptions`、`SetStackOptions`、`NavigationType`、`NavigationInfo`、`NavigationGuard`、`NavigationGuardReturn`、`NavigationHookAfter`、`NavigationErrorHandler`、 `NavigationFailure`、`LeaveGuardOptions`。
- 原生流：`NativeFlow`、`NativeFlowContext`、`NativeFlowOutcome`、`NativeFlowHandle`、`NativeFlowRunOptions`、`DocumentPickerInput`、`DocumentPickerResult`； `startNativeFlow(flow, input, page)` 在页面外运行一个。
- 链接：`LinksOptions`、`LinkOptions`、`LinkWindow`、`InitialLinkRequest`、`IncomingLink`、`LinkResult`、`LinkIgnoredReason`、`LinkSource`、`LinkListener`、 `RouteShortcut`。 `supportsShortcuts()` 报告平台是否显示主屏幕快捷方式。
- 原生演示：`ModalOptions`、`SheetOptions`、`SheetDetent`、`AndroidModalOptions`、`BottomSheetOptions`、`BottomSheetState`、`TransitionOption`、`ZoomSource`、`BackGesture`、 `BackGestureEdge`。 `supportsBottomSheets()` 报告 Android 版本是否包含材质。
- 推断的路由类型：`Register`、`RegisteredRouter`、`RouteMapFrom`、`RouteMapGeneric`、`RouteNames`、`RouteLocationOf`、`RouteLocationRawOf`、`ParamsFromPath`。

增强 `Register` 和 `RouteMeta`，如 [类型路由](./typed-routes) 中所示。

## 诊断 {#diagnostics}

`RouterDiagnostics` 公开 `routerId`、`stopped`、`events`、`droppedEvents`、`snapshot()`、`subscribe(listener)`、`toJSON()`、`export()`、 `clear()` 和 `stop()`。数据是只读的、有界的和经过编辑的； `stop()` 发布直播源。出口型号：`DiagnosticsOptions`、`RouterDiagnostics`、`DiagnosticsExport`、`DiagnosticSnapshot`、`DiagnosticStack`、`DiagnosticHost`、`DiagnosticEntry`、`DiagnosticIssue`、`DiagnosticIssueCode`、`DiagnosticEvent`、 `DiagnosticPhase` 和 `DiagnosticOutcome`。有关格式、时序语义和生命周期，请参阅 [diagnostics](./diagnostics)。

## 原生搜索 {#native-search}

`useNativeSearch(options)` 注册页面拥有的原生搜索。出口：`NativeSearchOptions`、`NativeSearch`。请参阅 [native 栏并搜索](./native-bars) 以了解查询所有权、激活和平台差异。

## Page 行动 {#page-actions}

`usePageActions(source, { onError? })` 在 `PageActionItem` 和路由菜单之间共享类型化、页面拥有的回调和反应状态。出口：`PageAction`、`PageActionContext`、`PageActionState`、`PageActions`、`PageActionsOptions`。有关执行、取消、所有权和可选键盘重用的信息，请参阅 [页面操作](./page-actions)。

## 键盘命令 {#keyboard-commands}

`useNavigationCommands(source)` 和 `NavigationCommandScope` 将选择加入命令绑定到页面/窗口。型号：`NavigationCommand`、`NavigationCommandState`、`NavigationCommands`、`NavigationShortcut`、`KeyModifier`。请参见 [键盘命令](./keyboard)。

## 辅助功能和运动 {#accessibility-and-motion}

`useNavigationFocus(options)` 提供选择加入初始/返回可访问性目标和模式启动器恢复。型号：`NavigationFocus`、`NavigationFocusOptions`、`NavigationFocusTarget`。 `RouterOptions.motion` 接受 `MotionPolicy`（`system`、`reduced`、`full`）；默认`system`。请参阅 [辅助功能和运动](./accessibility)。

## 本地主机（实验） {#native-hosts-experimental}

`mountNativeHost(router, name, host, initial?)` 驱动 `NativeHost` 中的 导航栈 并返回其卸载函数。 `useNativeHost<TNative>()` 为页面提供其主机的 `kind`、`capabilities` 和 `native` 容器。 `createFrameHost(frame, { modal? })`、`createSplitFrameHost(list, detail, { expanded, detailVisible })`为内置主机； `NATIVE_HOST_VERSION` 是路由器接受的合约版本。型号：`NativeHost`、`NativeHostCapabilities`、`NativeHostDelegate`、`NativeHostPushOptions`、`NativeHostBackOptions`、`NativeHostPart`、`NativeHostRole`、`NativeHostHandle`、`NativeHostVersion`、`FrameHostOptions`、 `SplitFrameHostOptions`、`SplitFrames`、`BackGestureSession`、`BackPreview`。请参阅 [native 主机](./native-hosts)。

`defineNativeDestination<Input, Output>({ id, input, ios?, android? })` 返回包含现有 UIKit 控制器或 AndroidX 片段的路由组件。工厂返回`{ native, dispose? }`；它们的上下文提供 `input`、`route`、`page`、`complete(value)`、`cancel()`、`dismissed()` 和 `beforeLeave(guard)`。型号：`NativeDestinationOptions`、`NativeDestinationContext`、`NativeDestinationInstance`。有关遏制、导航守卫 限制和恢复，请参阅 [native 目的地](./native-destinations)。

`supportsUIKitSplitView()` 检查可选的 UIKit 后端是否可用。

## 原生 Windows（实验性，核心 9.1+） {#native-windows-experimental-core-9-1}

`RouterOptions.window?: RouterWindow` 将一台路由器绑定到一个原生窗口；否则，第一个安装的视图将提供其所有者。 `router.window` 对于该所有者来说是只读的 ref。 `router.openWindow(to, options?: OpenWindowOptions): void` 解析键入的位置并请求操作系统窗口。 `OpenWindowOptions.data` 携带可序列化的应用程序元数据。 `getWindowRoute(data)` 在窗口内容解析器中读取其路径。

`RestoreOptions.key` 提供稳定的应用程序快照密钥。作用域回调在 `save(state, context)` 和 `load(context)` 中接收可选的 `RestoreContext`（`windowId`、`key`）。范围 `SavedStacks` 包括 `windowKey`；不匹配将被忽略。 `RouterWindow` 是 NativeWindow 的结构子集，因此包声明仍然可用于较旧的受支持核心版本。有关引导、生命周期、配置和限制，请参阅 [native windows](./windows)。

可选的 `vue-router-ns/system-search` 入口点导出 `createSystemSearch`、`SystemSearch`、`SystemSearchOptions` 和 `SearchItem`。 `supportsPinnedShortcuts()` 是从包根目录导出的。请参阅[深层链接](./deep-links)。

## 附加导出类型和元数据解析 {#additional-exported-types-and-metadata-parsing}

| 出口                         | 合约                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `RouteMenuAction`            | 原生上下文菜单操作描述符；请参见 [上下文菜单](./context-menus)。                                           |
| `SearchBarPlacement`         | `'automatic'`、`'stacked'`、`'inline'` 或 `'integrated'` 用于支持的 UIKit 搜索布局。可用性仍然依赖于平台。 |
| `DrawerPresentation`         | 请求 `'overlay'`、`'permanent'` 或 `'auto'` 模式。                                                         |
| `ResolvedDrawerPresentation` | 抽屉导航 句柄和呈现事件报告的有效 `'overlay'` 或 `'permanent'` 模式。                                      |
| `UIKitSplitFrames`           | 使用只读 `view: UIKitSplitView` 扩展 `SplitFrames` 的实验性原生宿主有效负载。                              |
| `PageMetaTransform`          | 实验生成器结果：`hasMacro`、`metadata`、转换后的 `code` 及其源 `map`。                                     |

实验性仅节点 `vue-router-ns/file-routing/generator` 条目也导出 `parsePageMetadataJson(source, filename): PageMeta`。它验证 JSON 元数据对象，并针对无效或不受支持的元数据抛出 `FileRouteError`。集成相邻元数据文件时使用它；它不执行路由代码。
