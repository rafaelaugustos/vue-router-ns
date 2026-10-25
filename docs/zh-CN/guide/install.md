# 安装并打开页面 {#install-and-open-a-page}

你需要 Node 20.19.4+、NativeScript-Vue 3.1.2+ (3.x) 和 NativeScript Core 9.1.3+ (9.x)。使用[NativeScript环境设置](https://docs.nativescript.org/setup/)准备原生SDK；本地构建 iOS 需要 macOS 和 Xcode。完整测试的基线位于 [兼容性指南](./compatibility) 中。

## 创建或使用 NativeScript-Vue 项目 {#create-or-use-a-nativescript-vue-project}

如果您已经有正在运行的 NativeScript-Vue 应用程序，请使用其目录。否则，请按照[NativeScript-Vue 官方初始项目指南](https://nativescript-vue.org/docs/getting-started/installation)：

```sh
ns create pocket-notes --template @nativescript-vue/template-blank@latest
cd pocket-notes
```

在该项目中安装路由器：

```sh
npm install vue-router-ns@next
```

`next` 标签选择发布候选版本。提交生成的锁定文件以进行可重现的安装。

## 开始使用 {#getting-started}

在项目的 `src` 目录下使用这个最小结构。将starter的应用级Frame替换为`RouterView`；路由器创建其原生 Frame。

```ts
// src/router.ts
import { createRouter } from 'vue-router-ns'

export const router = createRouter({
  routes: [{ path: '/', component: () => import('./pages/Home.vue') }],
})
```

```ts
// src/app.ts
import { createApp } from 'nativescript-vue'
import App from './App.vue'
import { router } from './router'

createApp(App).use(router).start()
```

```vue
<!-- src/App.vue -->
<template>
  <RouterView />
</template>
```

```vue
<!-- src/pages/Home.vue -->
<template>
  <Page>
    <ActionBar title="Pocket notes" />
    <Label text="Your first native page" margin="24" />
  </Page>
</template>
```

在配置的模拟器/仿真器或连接的设备上运行：

```sh
ns run ios
# or:
ns run android
```

你应该看到 **Pocket notes** 和 **Your first native page**。示例应用的界面文字仍为英文。继续 [构建您的第一个应用程序](./first-app)：使用完整文件添加列表、详细信息页面、模态结果和未保存的编辑 导航守卫。

## 在线尝试 {#try-it-online}

[StackBlitz Playground](./playground) 提供连接到设备上的 NativeScript Preview 的浏览器编辑器。其预构建的原生运行时有限制；在评估特定于平台的功能之前请参阅该指南。

## 演示应用程序 {#the-demo-app}

要运行存储库示例而不是创建项目，请按照 [Fieldnotes 仓库配置指南](./native-showcase#run-from-a-checkout) 进行操作。使用 `demo` 中的 `npm run tutorial:ios` / `tutorial:android` 作为第一个应用程序教程，使用 `showcase:ios` / `showcase:android` 用于 Fieldnotes，或使用 `ns run ios` / `ns run android` 作为默认邮件应用程序。所有条目共享演示应用程序 ID，因此在该设备上安装一个条目会替换另一个条目。

## 安装疑难解答 {#installation-troubleshooting}

对于 npm 10，请使用 beta.15 或更高版本。 Beta.14的可选 Vite peer 依赖触发`Cannot read properties of null (reading 'edgesOut')`；路由器不再声明 Vite 或 webpack peer 依赖，也不需要 `--legacy-peer-deps`。

文件路由是可选的。如果您选择它，请安装 [文件路由指南](./file-routing) 中描述的捆绑程序。在 npm 10 上保留有效的 NativeScript Vite 锁定文件：该构建器在没有锁定文件的情况下启动时会出现单独的可选对等解析器问题。请参阅 [安装证据](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/npm-install.md) 以了解经过测试的组合。
