# 在多个原生窗口中导航 {#navigation-in-multiple-native-windows}

此功能是实验性的，需要支持的 Core 9.1.3+ / NativeScript-Vue 3.1.2+ 依赖项以及平台的多窗口配置。

路由器拥有 Frame 页面后面的 Vue 应用程序，并在其路由保留在原生历史记录中时保留它们。 Android 活动娱乐已通过已发布的 Core 9.1.3 和 NativeScript-Vue 3.1.2 进行验证；不需要依赖补丁。 Page和布局HMR仍然使用原生Page替换。验证了进程死亡后原始 Android 任务和 UIKit 场景会话的恢复。 iPad 场景在同一运行过程中断开/重新连接也得到验证：原始页面、Vue 状态、导航守卫 和待处理的导航结果仍然存在。原生套件使用仅模拟器驱动程序请求真实的 UIKit 场景断开连接；这与后台恢复和冷恢复是分开的。

## 每个窗口一个路由器 {#one-router-per-window}

每台`NativeWindow`拥有一台路由器。其命名视图、模态 导航栈、导航队列、导航守卫 和结果是独立的。两个窗口都可以有一个名为 `inbox` 的视图​​。

```ts
const router = createRouter({ routes, window: request.window })
```

路由器可以从第一个安装视图的`getNativeWindow()`推断其窗口。引导辅助窗口时传递 `window`，以便在加载第一页之前了解所有权和恢复情况。 `router.window` 对于该所有者来说是只读的 ref；它在传统模式下保持未定义状态。将另一个路由器绑定到同一窗口，或者在不同窗口中安装一个路由器的视图都是错误的。

## 在新窗口中打开路线 {#opening-a-route-in-a-new-window}

```ts
router.openWindow(
  { name: 'message', params: { id: 42 } },
  { data: { documentId: 'message:42' } },
)
```

位置由呼叫者的路线类型解析。在 Android 上，绑定路由器使用 Core 的窗口标志和序列化元数据通过其实时拥有的 Activity 启动显式 Intent。其他情况使用`Application.openWindow()`。源 导航栈 保持在原位，其离开 导航守卫 不运行。新窗口的初始导航运行其自己的 导航守卫。这是操作系统请求，而不是确认新场景出现的 Promise；原生配置或操作系统可能会拒绝它。缺少 NativeWindow API 会引发错误。

应用程序通过`Application.setWindowContentResolver`提供新内容。 `getWindowRoute(request.data)`读取`openWindow`提供的解析路径； `__vueRouterNS` 数据密钥被保留。其他数据必须可由平台序列化。

```ts
import { Application } from '@nativescript/core'
import { createApp, h } from 'nativescript-vue'
import { createRouter, getWindowRoute, RouterView } from 'vue-router-ns'
import App from './App.vue'
import { routes } from './routes'

// Register this before starting the primary app. Return undefined to keep
// its usual root. Other application-owned window roles can be handled here too.
Application.setWindowContentResolver((request) => {
  if (request.window.rootView) return request.window.rootView
  const initial = getWindowRoute(request.data)
  if (request.isPrimary && !initial) return undefined

  const router = createRouter({ routes, window: request.window })
  const app = createApp({
    render: () => h(RouterView, { initial: initial ?? '/' }),
  }).use(router)
  const vm = app.mount()
  request.window.on('close', () => app.unmount())
  return vm.$el.nativeView
})

const router = createRouter({ routes })
createApp(App).use(router).start()
```

辅助根已挂载并返回到其窗口；它不会再次调用 `start()`。 NativeScript-Vue 的导航页面应用程序继承主应用程序的上下文，而路由器包装器提供每个页面的窗口绑定路由器和路由。共享主应用程序的应用程序服务；独立的每个窗口插件/提供上下文不会自动传播到导航页面。

该解析器归应用程序所有。将其与现有的窗口处理结合起来，而不是默默地替换另一个插件的解析器。初始 URL/通知传送仍然是应用程序集成工作；请参阅[深层链接](./deep-links)。

## 原生配置 {#native-configuration}

在Android上，启动Activity必须支持多个实例：常用模板的`singleTask`/`singleInstance`模式重用一个Activity。使用您的内核/运行时支持的配置，例如兼容 Android 版本上的 `standard` 或 `singleInstancePerTask`。在 iPadOS 上，在场景清单中启用 `UIApplicationSupportsMultipleScenes` 并使用场景生命周期。手机或预览版可能不支持打开另一个场景。

使用 [NativeScript 多窗口指南](https://docs.nativescript.org/guide/multi-window) 进行完整的原生设置。 `openWindow` 转发请求；它无法更改已安装的清单、权利或设备功能。当您的应用程序中多窗口 UI 不可用时，提供普通的 `push()` 操作。

当打开另一个窗口时，包括在原始 Activity 完成之后，绑定的 Android 路由器使用其幸存的 Activity 类。这避免了 [NativeScript #11526](https://github.com/NativeScript/NativeScript/issues/11526) 中 `router.openWindow()` 的 Core 启动器限制；直接调用 `Application.openWindow()` 保留 Core 的行为。

## 分离、重新连接和关闭 {#detach-reconnect-and-close}

Back 和预测手势由其原始活动/窗口处理。模态呈现的目标是该窗口中的页面，而不是 NativeScript-Vue 的全局模态目标。非活动窗口不能占用活动窗口的背面。

临时 `detached` 事件保留逻辑 导航栈 和结果承诺，释放 Activity 手势回调并保存当前快照。 `attached` 将回调绑定到替换活动。永久的`close`拆掉了拥有的导航栈/听众，并与`undefined`结算了出色的结果；它不能等待异步离开导航守卫。重新连接现有窗口时保持同一路由器；在新的 JS 进程启动后重建窗口时创建一个新的路由器。

在iOS上，当场景返回时，路由器还会重建保留的Frame的原生控制器导航栈。否则，Core 9.1.3 会重新创建空控制器，同时保留 JavaScript 历史记录。该范围兼容层使用 Core 的 Frame/Page 生命周期元数据和公共 UIKit 导航栈 API；它不修补依赖项或使用私有 Apple API。其临时挂钩在重建或路由器资源清理后被移除。

## 按窗口持久化 {#persistence-by-window}

```ts
const router = createRouter({
  routes,
  window: request.window,
  restore: {
    key: String(request.data?.documentId ?? request.window.id),
    save: (state, scope) => {
      ApplicationSettings.setString(`router:${scope!.key}`, JSON.stringify(state))
    },
    load: (scope) =>
      JSON.parse(ApplicationSettings.getString(`router:${scope!.key}`, 'null')),
  },
})
```

从 `@nativescript/core` 导入 `ApplicationSettings`。 `save` 的可选第二个参数和 `load` 的参数是 `RestoreContext`: `{ windowId, key }`。它们是为作用域路由器提供的，在传统模式中被省略。现有回调仍然有效；多窗口商店必须使用上下文来保持快照分离。 `key` 默认为 `primary` 作为自动推断的主窗口，在进程死亡时保留现有的单窗口存储；显式提供的 Windows 默认为原生 ID。当所有权绑定时捕获默认值，并且如果另一个窗口成为主窗口则不会更改。为每个显式窗口提供应用程序文档/会话密钥，以使其在进程重新启动时保持稳定。

范围快照包括 `windowKey`；加载时忽略不匹配的密钥。没有它的旧快照仍然可读。关闭窗口仅保存该窗口的上下文 `null`。进程级退出保存现有的作用域历史记录，而不是清除每个窗口；传统模式保留其现有的退出时清除行为。

在内容解析器中选择传入路由与恢复历史记录策略。新的 `openWindow` 请求通常从其请求的路由开始，并跳过旧的快照；操作系统重建通常会恢复保存的窗口。使用原生请求的已保存状态/会话信息和应用程序元数据来区分这些情况。使用 `usePageState()` 进行选择加入、版本化页面状态；待处理的 Promise 和原生对象无法在进程死亡后幸存。

### 原始任务和场景会话 {#original-tasks-and-scene-sessions}

在 Android 10 / API 29 及更高版本上，路由器在拥有原生窗口时注册一个 Activity 生命周期观察者。它使用进程令牌标记从其自己的活动中保存的捆绑包。当稍后的进程恢复其中一项任务时，预创建回调会在原生恢复运行之前删除过时的 Core Frame/root 标识符和 AndroidX FragmentManager 状态。同一进程内的活动娱乐不受影响。观察者保持窗口元数据、ActivityResult 状态、应用程序数据和其他保存状态提供者完好无损，并在最后一个路由器所有者被释放时取消注册。这是 Core 9.1.3 恢复路径的兼容性适配器，使用已知的 Core/AndroidX 捆绑密钥；它不会修补已安装的依赖项。

即使保留了任务 ID，主原生窗口 ID 也可以在 Android 进程重新启动时发生更改。保留文档密钥，而不是将生成的窗口 ID 视为应用程序身份。在低于 API 29 的 Android 上，此适配器不可用：使用应用程序拥有的重建到新窗口，或保留单窗口流程。那里不支持自动重建原始的多个任务。

UIKit 可能会以不同的顺序重新连接已保存的会话。首次打开应用程序文档键时，保留从每个场景的持久窗口 ID 到应用程序文档键的映射，并在 **之前在内容解析器** 中查阅该映射，确定第一个到达的场景是您的默认文档。冷连接可能没有原始 `openWindow()` 有效负载。仅通过 `request.isPrimary` 或到货单分配单据可以交换其历史记录。当其会话被永久丢弃时删除映射。 `demo/src/testing/windows-app.ts` 中的原生夹具演示了这种应用程序拥有的映射，并根据原始场景 ID 验证恢复的文档。

## 链接传送到窗口 {#links-delivered-to-a-window}

启用 `links` 后，温暖的 Android 意图和 iOS 场景 URL、用户活动和快速操作仅进入拥有事件活动/场景的路由器。关闭路由器会删除其侦听器并禁用 Core 无法取消注册的旧委托回调。

对于新的辅助窗口，Core 在 **发出其初始意图/场景事件之后调用内容解析器**。创建路由器时传递为`links: { initial: request }`，或者以`router.openLink(url, { source: 'launch' })`转发URL；呼叫等待恢复和第一个原生宿主。从 `request.android?.intent` 或 `request.ios?.connectionOptions` 读取 URL。在 Android 上，当 `request.android?.savedInstanceState` 存在时，不重放旧意图。在此切换之前应用您选择的新鲜链接与已保存历史记录策略。新的传入链接通常位于恢复的历史记录之上； `clearHistory: true` 开始了新的 导航栈。

路由器不会猜测无主通知应针对哪个文档窗口。应用程序选择路由器/窗口并调用其 `openLink()`。
