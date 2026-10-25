# 用 StackBlitz 试试 {#try-it-with-stackblitz}

[在StackBlitz](https://stackblitz.com/fork/github/rafaelaugustos/vue-router-ns/tree/main/examples/playground?file=src%2Frouter.ts)中打开路由器游乐场

在浏览器中编辑 NativeScript-Vue 应用程序，并通过 [NativeScript Preview](https://preview.nativescript.org/) 在手机或平板电脑上运行其原生 UI。浏览器托管编辑器和构建过程；它不模拟 UIKit 或 Android 视图。

## 开始会话 {#start-a-session}

1. 使用其网站上的链接在您的设备上安装 NativeScript Preview。
2. 打开上面的游乐场。 StackBlitz 安装依赖项并使用官方 NativeScript StackBlitz 集成启动 `ns preview`。
3. 等待预览二维码并使用设备扫描。编辑时保持会话打开。
4. 打开 `src/router.ts` 更改路线，或打开 `src/pages/` 下的页面更改其 UI。

[示例源](https://github.com/rafaelaugustos/vue-router-ns/tree/main/examples/playground)是独立的并且引脚`vue-router-ns@0.1.0-beta.15`。它不需要构建此存储库或解析 `../dist` 别名。

## 尝试什么 {#what-to-try}

| 练习                             | 其中                                          |
| -------------------------------- | --------------------------------------------- |
| 推送多个项目，然后返回           | `src/pages/Home.vue`、`src/pages/Item.vue`    |
| 打开模态并返回回复               | `src/pages/Item.vue`、`src/pages/Compose.vue` |
| 取消非空草稿以运行离开 导航守卫  | `src/pages/Compose.vue`                       |
| 在宽窗口中保持列表和详细信息可见 | `src/App.vue` (`RouterSplitView`)             |
| 检查每个页面的路由和组合历史记录 | `src/pages/Item.vue`                          |

请参阅[navigation](./navigating)、[导航守卫](./guards)、[模态结果](./modals)和[分割视图](./split-view)了解相应的API。

## 原生功能 {#native-capabilities}

Preview 提供了一个预构建的原生应用程序。其安装的运行时、库和清单决定了哪些平台 API 可用；添加 npm 依赖项无法添加该应用程序中缺少的原生库。对您自己的 `App_Resources` 的更改需要完整的原生构建。

特别是，Android 14/15 预测返回进度需要明显的选择加入，而 iOS 缩放需要 iOS 18+ 和兼容的运行时。不要使用预览会话来断定这些功能在您自己的生产清单中有效。使用 [local demo](./install#the-demo-app) 测试原生配置、进程死亡恢复和发布版本。

示例遵循[官方Vue 3 StackBlitz模板](https://github.com/nativescript-vue/nativescript-vue/tree/main/packages/stackblitz-template)。 TypeScript 和平台捆绑检查与在连接的设备上测试端到端预览会话是分开的；这个例子并不声称后者已经被验证。

## 如果会话未开始 {#if-the-session-does-not-start}

检查 StackBlitz 终端是否有安装/构建错误，并遵循 [StackBlitz 浏览器支持](https://developer.stackblitz.com/platform/webcontainers/browser-support)。确认您的预览应用程序是最新的并且可以连接到会话。要在本地尝试相同的代码，请安装 NativeScript CLI，在 `examples/playground` 中运行 `npm install`，然后运行 ​​`ns preview`。

如果 Preview 的原生运行时无法提供功能，则完整的本地演示仍然可用。背景：[NativeScript 的预览版集成和限制](https://blog.nativescript.org/nativescript-preview-announcement/)。
