# 第一页上方启动 {#splash-above-the-first-page}

在 `<RouterView>` 上方保留启动画面，以便第一个原生页面可以安装在其下方。删除覆盖层会显示同一页面，而无需在导航历史记录中添加启动条目。

如果splash是一条路线，则调用`replace()`会在splash退出时创建目的地。在 Android 上，该工作可以与 UI 线程上的退出动画竞争。覆盖可以让页面创建在退出动画开始之前完成；它不会将初始化工作移出 UI 线程。

## 保持 RouterView 安装 {#keep-routerview-mounted}

[正常路由器安装](./install)后，将其保存为`App.vue`，将下一个组件保存为`Splash.vue`，保存在同一目录中：

<<< ../../snippets/SplashApp.vue

两个孩子占据相同的`GridLayout`单元。水花最后出现，位于路由器上方。包装器使覆盖的页面脱离接触交互和可访问性遍历，直到飞溅被移除。

只有覆盖层有 `v-if`。不要将 `<RouterView>` 放在 `v-if="!showSplash"` 后面：这会推迟页面创建，直到启动画面消失。也不要在 `createApp(App).use(router).start()` 之前等待 `router.isReady()`：路由器需要首先安装其视图。

## 显示页面 {#reveal-the-page}

该组件等待初始导航，淡出覆盖层并发出 `done`。如果初始化抛出异常或初始 导航守卫 没有留下目的地，它会保持可见并显示错误消息：

<<< ../../snippets/Splash.vue

淡入淡出是一个应用程序动画。当您的应用程序的简化动作首选项启用时，绑定 `:fade="false"`；路由器的 [运动策略](./accessibility#reduced-motion) 控制路由过渡，而不是此自定义动画。

`isReady()` 等待初始导航，而不是每个隐藏选项卡或页面自己的网络请求。将任何所需的应用程序初始化添加到就绪条件中。对于新手入门，请在用户完成新手入门时发出 `done` ；保持 `<RouterView>` 始终安装。

## 匹配iOS启动屏幕 {#match-the-ios-launch-screen}

在叠加层的根布局上设置 `iosOverflowSafeArea="true"`，使其背景延伸到安全区域之外。使用与 `App_Resources/iOS/LaunchScreen.storyboard` 相同的背景、图稿、大小和位置，以避免 iOS 移交给正在运行的应用程序时出现明显的跳跃。检查您支持的 iPhone 和 iPad 尺寸的对齐情况。

NativeScript 启动后出现此覆盖。它补充了操作系统的启动屏幕；它不能取代 JavaScript 运行之前显示的屏幕。 `iosOverflowSafeArea` 特定于 iOS。

## 警卫仍在下面奔跑 {#guards-still-run-underneath}

初始导航、重定向和 [导航守卫](./guards) 在启动画面可见时照常运行。它在视觉上隐藏了页面；它不会延迟身份验证或绕过 导航守卫。将未经身份验证的初始访问重定向到可用的登录页面。飞溅不是访问控制边界。

无需更改路由器 API、额外路由、`push()` 或 `replace()` 即可删除覆盖。 Back 通过实际的应用程序历史记录返回，并且不会带回启动画面。
