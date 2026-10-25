# 文件中的可选路由（实验性） {#optional-routes-from-files-experimental}

文件路由为现有原生路由器生成普通类型路由数组。应用程序可以继续在 JavaScript/TypeScript 中声明路由，从原生 Vue 页面生成它们，或者组合独立的表。页面仍然通过 NativeScript 页面/框架渲染，具有相同的 导航守卫、结果和历史记录。

可选的 webpack 和 Vite 插件处理生成、元数据编译和原生 HMR。显式路由应用程序不需要构建更改。整个过程中使用了 NativeScript 组件；它不运行 Nuxt、Web Vue Router、DOM 渲染器或 WebView 导航，并且不转换 Web 模板。

## NativeScript webpack 设置 {#nativescript-webpack-setup}

将 `@vue/compiler-sfc@^3.5` 和 `webpack@^5` 作为开发依赖项与应用程序的 `@nativescript/webpack` 一起安装。编译器仍然是可选的对等体；捆绑程序属于应用程序，插件在应用时会检查 webpack 5。将插件添加到现有的 `webpack.config.js` 中：

```js
const webpack = require('@nativescript/webpack')
const { NativeFileRoutesPlugin } = require('vue-router-ns/file-routing/webpack')

module.exports = (env) => {
  webpack.init(env)
  webpack.chainWebpack((config) => {
    config.plugin('native-file-routes').use(NativeFileRoutesPlugin, [
      {
        platform: env.android ? 'android' : 'ios',
        pagesDir: 'src/pages',
        outDir: 'src/generated/router',
        layoutsDir: 'src/layouts', // optional discovery
        middlewareDir: 'src/middleware', // optional discovery
        autoImports: true, // only the definePageMeta macro
      },
    ])
  })
  return webpack.resolveConfig()
}
```

路径相对于 webpack 的项目上下文（`rootDir` 覆盖它）。输出必须位于所有扫描目录之外。将生成的目录包含在TypeScript的`include`中，并在Git中忽略它。省略 `layoutsDir`/`middlewareDir` 或将它们设置为 `false` 以保持注册明确。

```ts
import { createRouter } from 'vue-router-ns'
import { routes, layouts, installFileRouting } from './generated/router'

export const router = createRouter({ routes, layouts, defaultLayout: 'default' })
const disposeFileRouting = installFileRouting(router)
// Then app.use(router). Dispose with the app/window when it is destroyed.
```

创建路由器一次。 `installFileRouting` 注册发现的中间件并接受该实例上的路由表 HMR；它返回一个清理函数。不使用布局时，请删除 `layouts` 和 `defaultLayout`。应用程序仍然正常挂载 `RouterView`/其他原生路由器容器。

生成在 webpack 编译之前运行，包括 `ns run` 手表构建。在独立的 `tsc --noEmit` 之前，在节点脚本中准备具有相同选项的类型：

```js
import { prepareFileRouting } from 'vue-router-ns/file-routing/setup'

await prepareFileRouting({
  platform: 'android',
  pagesDir: 'src/pages',
  outDir: 'src/generated/router',
  layoutsDir: 'src/layouts',
  middlewareDir: 'src/middleware',
  autoImports: true,
})
```

在脚本和 webpack 配置之间共享这些选项。生成的`index.d.ts`描述的是**最近准备的平台**；按顺序准备并检查每个平台。不要同时将两个平台生成到同一输出目录中。 NativeScript 在运行时选择 `index.android.ts`/`index.ios.ts`。节点设置/插件/编译器模块永远不属于应用程序导入。

## NativeScript Vite 设置 {#nativescript-vite-setup}

可选的 `vue-router-ns/file-routing/vite` 条目生成相同的原生路由，并在 Vue 编译之前删除 `definePageMeta`。它需要 Vite 8 和 `@vue/compiler-sfc@^3.5` 作为开发依赖项。该插件在配置过程中检查活动的 Vite 版本；单独安装路由器无法解析 Vite 对等点。从 [NativeScript Vite Vue 配置](https://docs.nativescript.org/configuration/vite) 开始，然后添加插件：

```ts
// vite.config.mts
import { defineConfig, mergeConfig } from 'vite'
import { getCliFlags } from '@nativescript/vite'
import { vueConfig } from '@nativescript/vite/vue'
import { nativeFileRoutes } from 'vue-router-ns/file-routing/vite'

export default defineConfig(({ mode }) => {
  const flags = {
    ...getCliFlags(),
    ...JSON.parse(process.env.NATIVESCRIPT_BUNDLER_ENV ?? '{}'),
  }
  if (!flags.android && !flags.ios) throw new Error('Select an Android or iOS build')
  return mergeConfig(vueConfig({ mode }), {
    plugins: [
      nativeFileRoutes({
        platform: flags.android ? 'android' : 'ios',
        pagesDir: 'src/pages',
        outDir: 'src/generated/router',
        layoutsDir: 'src/layouts',
        middlewareDir: 'src/middleware',
        metadataFiles: true, // adjacent .route.json files; native HMR needs no macro
      }),
    ],
  })
})
```

将`bundler: 'vite'`和`bundlerConfigPath: 'vite.config.mts'`设置为`nativescript.config.ts`。在生成的 `import.meta.hot` 代码的 TypeScript 类型中包含 `vite/client`。也可以在独立的 `prepareFileRouting()` 呼叫中使用 `bundler: 'vite'`。 `installFileRouting`、原生布局、中间件和显式路由组合使用上面所示的相同应用程序 API。

在启用 HMR 的情况下运行 `ns run android` 或 `ns run ios --emulator`。使用相邻的 JSON 元数据，如下所示。生成的路由表和对现有中间件的编辑会更新已安装的原生路由器，而无需重建其打开的页面。

::: warning definePageMeta 和原生 Vite HMR
原生 Vite HMR 仍然需要 `@nativescript/vite` 8.0.20 的 JSON 元数据：原生 SFC 程序集绕过预编译器转换的单独问题仍然存在（[NativeScript#11556](https://github.com/NativeScript/NativeScript/issues/11556)）。 `definePageMeta` 适用于捆绑的 Vite 版本 (`--no-hmr`) 和 webpack。对于原生Vite HMR，去掉调用，使用`metadataFiles: true`；如果宏仍然存在，该插件会报告可操作的错误。 JSON 工作流程不需要依赖项补丁。
:::

使用库存 `@nativescript/vite` 8.0.20、Vite 8.3.4、Node 22.23.3、Android API 36 和 iOS 26 进行验证。原生夹具涵盖模板编辑、现有中间件替换、元数据编辑、添加/重命名/删除和无效元数据恢复。捆绑包检查不包括编译器/生成器代码和 Web 路由器。

测试的原生 Vite 汇编器还需要 SFC 中的非空脚本块；仅模板 SFC 装配仍然是平台的限制。该示例的页面包含脚本。 `@nativescript/vite` 8.0.20 包括 [NativeScript#11555](https://github.com/NativeScript/NativeScript/pull/11555)，它修复了 HMR 中的 Vue 包名称匹配和导航帮助程序导入。更新应用程序的依赖项和锁定文件以接收它。该示例保留 `install-links=true` 作为打包包来测试本地路由器，与其发布的布局相匹配；此接受不会验证原始工作区链接。

## 页面旁边的元数据 {#metadata-beside-the-page}

在插件和独立 `prepareFileRouting` 选项中启用 `metadataFiles: true`。 webpack和Vite均支持该可选格式；为了兼容性，它默认为 `false`。对于 `src/pages/products/[id].vue`，创建 `src/pages/products/[id].route.json`：

```json
{
  "name": "product",
  "layout": "default",
  "middleware": ["auth"],
  "props": true,
  "meta": { "requiresAuth": true }
}
```

字段匹配 `definePageMeta`；生成器验证 JSON 数据并生成类型化的路线记录，而无需将 JSON 或构建工具导入到应用程序中。每页使用一个元数据源：宏和 sidecar 一起使用是错误的，包括空宏。缺少的 sidecar 使用文件约定。无效的元数据保留最后生成的表直到更正；删除 sidecar 会恢复文件默认值。

属于**的边车精确选择SFC**：`product.android.vue`读取`product.android.route.json`； `product.vue` 读取为 `product.route.json`。 Sidecar 之间没有后备或合并。需要时，在平台变体中保留共享元数据的副本。编辑 JSON 会更新未来的匹配，同时打开的条目保留其路由快照和原生状态。

## 可选发现和导入 {#optional-discovery-and-imports}

`layouts/default.vue` 寄存器 `default`；嵌套的 `layouts/account/settings.vue` 寄存器 `account-settings`。 Discovery 不选择默认布局：显式设置 `defaultLayout` 或页面元数据。布局拥有单个原生 `Page`；其中路由的内容不得引入另一个 `Page`。请参见 [layouts](./layouts)。

中间件文件默认导出 `RouteMiddleware` 函数。 `middleware/auth.ts`寄存器`auth`； `middleware/01-audit.global.ts` 按确定的文件名顺序注册全局中间件。数字前缀可以表达顺序。命名中间件在被页面元数据选择时运行。显式 `router.addRouteMiddleware()` 仍然可用；发现不会默默地覆盖重复的名称。请参阅 [中间件和帮助程序](./middleware)。

两个目录都支持扩展名之前的 `.ios`/`.android` 变体（例如 `auth.global.android.ts`）。名称允许字母、数字、下划线和连字符，嵌套文件夹由 `-` 连接；模糊的名字会失败。隐藏/下划线条目将被跳过，符号链接将被拒绝。配置的目录必须存在。

对于 `autoImports: true`，只有页面的 `<script setup>` 中未绑定的顶级 `definePageMeta()` 调用可以省略其导入。生成的声明提供其类型。本地绑定和从其他模块的导入保留其含义。运行时助手始终使用显式导入。使用默认值 `autoImports: false`，改为写入 `import { definePageMeta } from 'vue-router-ns/file-routing'`。

## 原生示例和经过验证的支持 {#native-example-and-verified-support}

[文件路由示例](https://github.com/rafaelaugustos/vue-router-ns/tree/main/examples/file-routing) 包括集合/详细信息流、可编辑草稿、两个原生选项卡 导航栈、布局、身份验证中间件和类型化模态结果。它还将显式 `/about` 目的地与生成的路由相结合。 [现有的playground](https://github.com/rafaelaugustos/vue-router-ns/tree/main/examples/playground)保留显式路由配置。

<div class="clips">
  <Clip name="ios-file-routing" caption="iOS：原生列表/详细信息、模态结果和通过生成的路由进行的身份验证。" />
  <Clip name="android-file-routing" caption="Android：原生页面和框架上的约定相同。" aspect="9 / 20" />
</div>

| 层                      | 已验证配置                                                                |
| ----------------------- | ------------------------------------------------------------------------- |
| 路由器集成              | 实验可选子路径；显式路由 API 仍然可用                                     |
| NativeScript-Vue / Core | 3.1.2 / 9.1.3；所检查的包中的每个实例                                     |
| 生成器/编译器           | `@nativescript/webpack` 5.0.39、webpack 5.112、`@vue/compiler-sfc` 3.5.44 |
| 节点/示例类型           | 本地节点 20.19.4 和 CI 中的节点 22； TypeScript 6.0.3                     |
| Android                 | 运行时 9.1.1；本地 API 36，原生 CI 通道中的 API 34                        |
| iOS                     | 运行时 9.1.0； iOS 26模拟器，本地原生验收                                 |
| 支持其他构建器/框架     | webpack 和 Vite；原生 Vite HMR 使用 JSON 元数据。无 Nuxt 运行时           |

`scripts/native/conventions-watch.mjs android|ios` 通过实际的 NativeScript CLI 驱动示例，并在应用程序运行时编辑其源文件。它检查原生 Page 身份、草稿、Back、取消、身份验证重定向、模式结果、可访问性可见性/焦点目标以及监视恢复。它在退出时恢复其临时编辑。该装置不声明屏幕阅读器语音；路由器的单独可访问性覆盖范围仍然适用。

每个插件都使用其捆绑器的观察器。添加、重命名或删除页面，并仅编辑其元数据，更新未来的匹配，而无需重新创建打开的条目或其他 导航栈。无效的生成报告构建错误并保留最后的有效输出；更正源代码即可恢复编译。更改 Vue 脚本/模板内容使用 Vue 的现有 HMR 行为，并可能重新挂载组件/重置本地状态。添加、删除或重命名布局/中间件注册需要重新启动应用程序；编辑现有中间件更新未来的 导航守卫，无需重建路由器。 Vue 脚本编辑可以重新挂载组件；兼容的模板编辑保留测试的页面状态。

要返回显式路由，请将生成的导入替换为您自己的路由/布局表，显式注册中间件，并删除 `installFileRouting`、插件、其准备脚本和生成的声明。将 `definePageMeta` 替换为相应的路由字段并删除其呼叫。原生路由器及其导航 API 保持不变。

## 生成路线模块 {#generate-a-route-module}

使用生成器时安装 `@vue/compiler-sfc@^3.5` 作为 **开发依赖项**。它是一个可选的对等点；具有显式路由的应用程序不需要此工具。在编译应用程序之前运行此 Node 脚本：

```js
import { writeFileRoutes } from 'vue-router-ns/file-routing/generator'

await writeFileRoutes({
  pagesDir: 'src/pages',
  outFile: 'src/generated/routes.android.ts',
  platform: 'android',
  exclude: ['components'],
})
```

使用 `platform: 'ios'` 和 iOS 构建的单独输出。生成的模块中的导入指向相对于输出文件的选定 SFC。 NativeScript 可以解析共享 `./generated/routes` 导入到其平台文件；应用程序的 TypeScript 配置还必须解析所选输出（或显式导入）。

```ts
import { createRouter } from 'vue-router-ns'
import { routes } from './generated/routes.android'

export const router = createRouter({ routes })
router.push({ name: 'products-id', params: { id: 42 } })
```

输出包括`routes`、`FileRouteMap`、`FileRouteName`和`FileRouteParams<Name>`。惰性组件工厂具有显式的返回类型，避免了页面和路由器之间的推理循环。现有的 [路由器注册](./typed-routes) 也提供可组合项并链接生成的名称和参数。输出没有文件系统、编译器或生成器运行时导入。

## 文件约定 {#file-conventions}

| 文件                   | 路径              | 名称             | 参数                              |
| ---------------------- | ----------------- | ---------------- | --------------------------------- |
| `index.vue`            | `/`               | `index`          | 无                                |
| `products.vue`         | `/products`       | `products`       | 无                                |
| `products/index.vue`   | `/products`       | `products-index` | 无                                |
| `products/[id].vue`    | `/products/:id`   | `products-id`    | `id: string`                      |
| `settings/[[tab]].vue` | `/settings/:tab?` | `settings-tab`   | `tab?: string`                    |
| `files/[...path].vue`  | `/files/:path+`   | `files-path`     | `path: string[]`（一个或多个段）  |
| `any/[[...path]].vue`  | `/any/:path*`     | `any-path`       | `path?: string[]`（零个或多个段） |

名称保留 `index`，因此添加父页面不会重命名其现有索引目标。使用 `definePageMeta({ name: '...' })` 覆盖名称。文件名和文件夹允许使用 ASCII 字母、数字、`_` 和 `-`；参数使用单词字符。生成的路径中不支持混合段（例如 `product-[id]`、路由组和自定义正则表达式），并会生成源诊断。显式记录保留其现有的匹配器功能。包罗万象的参数必须放在最后。

文件夹本身不会创建原生页面或框架。最近的祖先**页面文件**，例如`products.vue`，成为`products/[id].vue`的路由父代。对于 `withParents: true`，路由器将实际父级 Page 推送到详细信息 Page 之前。索引文件永远不会成为父文件。当`products.vue`和`products/index.vue`同时存在时，路径导航至`/products`选择索引；命名导航可以选择父级。父级的自定义路径会传播到子级，除非子级声明自己的绝对路径； `withParents` 所需的父参数必须保持可用。

扫描器确定性排序，现有匹配器对目的地进行排名。重复的名称、等效的不区分大小写的模式（包括具有不同名称的参数）、重复的参数和不受支持的文件名会导致文件/行/列诊断失败。父级及其索引是有意的相同路径异常。

隐藏和 `_` 前缀的文件/目录和 `node_modules` 被跳过。 `exclude` 接受精确的相对文件或目录前缀，不带通配符。必须排除符号链接。可配置的页面目录可能是空的。

`page.ios.vue`/`page.android.vue` 在其平台上覆盖 `page.vue` 而不添加其他路由。其他版本中不存在仅限平台的页面。当存在变体时，必须指定平台。如果应用程序代码需要共享路由映射，请保持跨变体的名称/路径一致；每个平台生成的类型都描述其自己的表。

## 编译时页面元数据 {#compile-time-page-metadata}

```vue
<script setup lang="ts">
import { definePageMeta } from 'vue-router-ns/file-routing'

definePageMeta({
  name: 'product',
  layout: 'default',
  middleware: ['auth'],
  props: true,
  transition: 'fade',
  meta: { requiresAuth: true },
})
</script>

<template>
  <StackLayout><Label text="Product" /></StackLayout>
</template>
```

在路由器上注册名为[layout](./layouts)和[middleware](./middleware)。这里布局拥有原生 `Page`；如果没有布局，目的地必须拥有它。 `layout: false` 选择退出。对于原生模式，请使用 `modal: true` 或文字原生选项对象，例如 `modal: { fullscreen: true }`。原生工作表选项和过渡选项遵循其现有的平台合同。

`definePageMeta` 接受 `name`、`path`、`layout`、`middleware`、`meta`、`props`、`modal` 和 `transition`。顶级`layout`/`middleware`成为路由元数据；将应用字段放置在 `meta` 内。生成的类型检查正常的路线选项形状。路径/名称覆盖优先于文件约定。

值必须是文字字符串、有限数字、布尔值、null、数组或普通对象。支持 TypeScript `as`/`satisfies` 包装器。导入的常量、设置变量、调用、函数、对象扩展、获取器和计算属性将被拒绝而不执行。在路由器上注册功能 导航守卫/布局并引用它们的名称。对需要运行时构造的回调属性、重定向或原生转换对象使用显式路由。

作为顶级 `<script setup>` 语句调用一次宏。显式导入可能会产生别名。 webpack 和 Vite 构建插件会自动转换它；上述 Vite 原生 HMR 限制仍然适用。对于自定义构建器，请在 Vue SFC 编译器 **之前运行 `transformPageMeta(source, filename, { autoImports: false })`**，使用其返回的 `code` 和源 `map`。转换删除了调用及其宏导入，保留了其他内容。运行未转换的宏会引发设置错误。 Discovery 属于可选的设置 API，而不是低级生成器。

## 合并显式记录和生成记录 {#combine-explicit-and-generated-records}

```ts
import { mergeFileRoutes } from 'vue-router-ns/file-routing'

const router = createRouter({
  routes: mergeFileRoutes(routes, [
    { path: '/help', name: 'help', component: () => import('./Help.vue') },
  ]),
})
```

`mergeFileRoutes()` 保留文字类型并拒绝表间冲突的名称/模式。显式记录和生成记录之间不存在隐式覆盖优先级。在显式声明其替换之前排除文件。普通`addRoute()`/`removeRoute()`保持现有行为。

## 重新生成和保留页面 {#regeneration-and-retained-pages}

`generateFileRoutes()` 返回代码、页面树、源文件和目录/输出路径，无需写入。 `writeFileRoutes()` 仅当生成的代码更改时才以原子方式写入。失败的生成会保留最后的有效输出；构建者仍然负责编译和类型诊断。

`watchFileRoutes(options, { onGenerated, onError })` 是用于构建集成的可选节点观察器。它在创建/编辑/重命名/删除时序列化重新生成，报告失败，并在更正后恢复。等待其返回的句柄 `close()` 来停止它。回调必须报告错误而不抛出。观察者可用性遵循节点/文件系统支持。构建者负责对应用程序进行模块更新的编译、诊断、关闭和交付。

在已经接受生成模块 HMR 的应用程序中，在创建路由器后附加更新程序：

```ts
import { createFileRouteUpdater } from 'vue-router-ns/file-routing'

const fileRoutes = createFileRouteUpdater(router, routes)
// In the builder's HMR accept callback:
fileRoutes.update(nextModule.routes)
```

更新更改了 **未来路径/名称匹配**。现有的原生条目保留其 Page、路由快照、布局、导航守卫 和草稿，即使其文件被删除或重命名也是如此。 Back 仍然返回那些保留的条目；通过路径/名称定位已删除的目的地失败。保留条目中的相对位置继续使用其原始匹配记录，包括元数据，遵循现有的 `addRoute`/`removeRoute` 语义。使用路径或名称来解析更新的表。 Vue 脚本/模板 HMR 仍然是一个单独的组件操作，并遵循现有的页面 HMR 契约。更新程序不会重新创建路由器或重置其他 导航栈。

更新程序在更改表之前拒绝与显式目标和外部更改的注册发生冲突。如果 `addRoute`/`removeRoute` 已替换其记录之一，请使用当前实际生成的表重新创建更新程序。在更新生成的父级之前删除手动附加的子级。这些规则保持了直接注册的权威性。

生成的文件 ID 和路由名称与每个原生条目的恢复密钥分开。重命名文件可以改变其路由名称；需要时使用明确的稳定名称。已保存的路径、迁移和不可用目的地仍受 [restoration](./restore) 管理。生成新表不会迁移已保存的应用程序数据。

存储库的 `--env.filesTest` 夹具继续测试 iOS/Android 上的低级生成输出。单独的约定示例练习了上述公共插件和实时文件系统到设备 HMR。
