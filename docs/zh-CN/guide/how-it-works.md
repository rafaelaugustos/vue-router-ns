# 工作原理 {#how-it-works}

每个`<RouterView>`渲染一个NativeScript `Frame`并将其作为[native主机](./native-hosts)交给路由器。页面使用 `$navigateTo` 安装在一个小包装器内，该包装器提供其路由和绑定到其 导航栈 的路由器。 NativeScript-Vue 将每个页面安装为自己的应用程序，因此 `<RouterView>` 提供的任何内容都无法到达它们。

在 `RouterView` 中，原生 导航栈 是导航历史记录的来源。每次 `navigatedTo` 后，Frame 主机都会报告更改，路由器会读取该主机的页面并对其进行镜像。它没有启动的弹出（例如 iOS 滑动）的拾取方式与其本身相同。 `replace` 在导航之前标记当前条目 `backstackVisible: false`，这就是框架原生丢弃页面的方式。

路由器通过相同的主机合约与每个容器进行通信：`<RouterView>` 的 Frame、模态内的框架以及 `<RouterSplitView>` 的两个框架。匹配、导航守卫、结果和协调在路由器中保存一次；演示、手势和原生手柄都在主机中实时显示。该合约是实验性的，并记录在 [native 主机](./native-hosts) 中。

## 与平台对话的地方 {#where-it-talks-to-the-platform}

- **Android后退按钮**：`activityBackPressed`，取消并变成`router.back()`，所以让导航守卫有发言权。在 Android 14 及更高版本上，核心之上的 `OnBackPressedCallback` 会遵循预测性滑动，并将其进度交给 `useBackGesture()`。
- **iOS 向后滑动**：当离开 导航守卫 处于活动状态时，`enableSwipeBackNavigation` 关闭。
- **iOS 返回按钮**：`UINavigationItem.backAction` (iOS 16)，同时离开 导航守卫 处于活动状态。
- **Modals**：当离开 导航守卫 处于活动状态时，`modalInPresentation`，并且代表在核心前面听到保持的滑动。
- **Tabs**：iOS 上标签栏前面的代表，触摸 Android 上标签栏上的监听器，以听到对所选标签的敲击声。

## 测试 {#tests}

测试针对 NativeScript 的 `Frame` ([`test/shims/core.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/shims/core.ts)) 的替身运行。它遵循真实的顺序：导航在稍后的时间点上完成，并在 `navigatedTo` 触发之前处理掉的页面。上面接触平台的部分通过垫片可以调用的小接缝进行锻炼，并在设备上一一检查。

shim看不到的东西在真正的Android模拟器上运行：[`scripts/native/smoke-android.sh`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/scripts/native/smoke-android.sh)安装演示并通过`adb`驱动它，检查冷启动和热启动时的操作系统链接，真正进程终止后的页面状态，材料底部面板，主屏幕快捷方式、抽屉导航 和返回，以及路由器根据 [`scripts/native/baselines.json`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/scripts/native/baselines.json) 诊断得出的自身计时。 `npm run test:native:android` 在 `ns build android` 之后针对连接的设备运行它； `Native` 工作流程每周在模拟器上运行一次，按需运行，并且当套件本身发生变化时运行。 [验证报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-validation.md) 记录剩余的手动通行证。

## 列表和详细信息 {#list-and-detail}

`RouterSplitView` 在原生 `GridLayout` 中保留两个框架：一个用于固定列表，另一个用于详细信息。路由器将它们组合成一个逻辑 导航栈 并省略细节的内部透明根。宽度更改会重新排列框架，而无需在框架之间传输页面。它不使用 `UISplitViewController` 或实现 抽屉导航。

## 开发更新 {#development-updates}

包装器将路由组件重新加载转发到 NativeScript-Vue 以进行原生 Page 替换。覆盖的页面在重新加载之前等待 Frame 的 `navigatedTo` 和下一个 Vue 刻度。参见 [HMR](./pages#hmr-during-development)。

原生检查及其环境记录在 [验证报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-validation.md) 中，作为垫片测试的补充。
