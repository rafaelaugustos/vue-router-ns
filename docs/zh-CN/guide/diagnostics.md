# 导航诊断 {#navigation-diagnostics}

有关所有权、平台边界和 rc.2/rc.3 区别，请参阅 [native 功能和容器选择](./capabilities)。

[打开可视化报告查看器](./diagnostics-viewer)以导入导出的JSON，比较导航栈并检查相关时间线，而无需连接到应用程序。

启用有界时间线以及路由器逻辑历史与其原生帧的只读比较：

```ts
const router = createRouter({
  routes,
  diagnostics: __DEV__ ? { maxEvents: 500 } : false,
})

const inspector = router.diagnostics
inspector?.snapshot()
inspector?.events
inspector?.export() // versioned JSON string
```

`diagnostics` 默认为 `false`。 `true`使用容量为500个事件； `maxEvents` 必须是 1 到 10,000 之间的整数。禁用的收集器是 `undefined`：它不会读取时钟、检查原生窗口、注册诊断原生侦听器或保留事件缓冲区。收集使用路由器现有的生命周期事件。

## 阅读时间线 {#reading-the-timeline}

事件具有单调递增的`id`、不透明的`routerId`、以毫秒为单位经过的`time`、`phase`和`status`。跨度在 `start`/`end` 上具有匹配的 `spanId` 值；他们的末端带有`duration`和`outcome`。与导航相关的跨度共享 `navigationId`。重定向以 `redirected` 结尾，新请求的值为 `parentNavigationId`。交错的请求必须通过 ID 关联，而不是假定为嵌套的。

| 相位           | 观察到的内容                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------- |
| `navigation`   | 通过完成、拒绝或失败解决的路由器请求。根后面是`noop`。                                       |
| `queue`        | 等待已提交的原生操作。                                                                       |
| `guard`        | 每次 导航守卫 调用； `detail` 标识 `leave`、`beforeEach`、`beforeEnter` 或 `beforeResolve`。 |
| `load`         | 组件分辨率，包括已加载记录的 `cached` 详细信息。                                             |
| `mount`        | 同步`$navigateTo`/`$showModal`工作，包括Vue设置和原生视图创建。                              |
| `transition`   | 通过Frame/模态完成信号提交，包括其安装工作。                                                 |
| `native`       | Frame 完成、外部启动的 `pop` 或其他原生同步。                                                |
| `page`、`host` | Page 链接/取消链接和主机连接/资源清理。                                                      |
| `hmr`          | 重新加载请求，在覆盖、应用或重新链接到替换 Page 时推迟。                                     |
| `result`       | 条目结果的结算，不带其值。                                                                   |
| `issue`        | 观察到的不变违规。                                                                           |

这些是路由器请求完成测量。它们排除了已解决的请求到达路由器之前的工作，例如操作系统输入传送或等待初始准备就绪。 `transition` 与 `mount` 重叠；不要将它们的持续时间加在一起。当显示第一个像素、测量 FPS 或替换原生分析器时，原生完成不会建立。订户工作可能会影响测量的持续时间。

计时使用单调时钟（`performance.now`，具有 Android/iOS 正常运行时间回退），与挂钟的更改无关。导出包括一个挂钟 `startedAt`，用于与平台日志大致关联。使用 [NativeScript 调试和原生分析工具](https://docs.nativescript.org/guide/debugging) 来调查渲染、CPU 使用情况和保留的原生对象。

## 比较原生历史和逻辑历史 {#comparing-native-and-logical-history}

`snapshot()` 返回冻结的、分离的数据。每个 导航栈 都有一个稳定的 ID、开发人员提供的 `name`、模态/繁忙状态、逻辑条目和原生宿主。条目包括其路由模式、生命周期 `active` 状态和 `awaitingResult`。 `active` 表示 导航栈 内未覆盖；它并不能证明其选项卡/窗口当前处于焦点状态。

每个主机报告其角色（`main`、`list`、`detail`）、加载状态、可选窗口 ID 和原生条目 ID。未知的原生页面具有 `null` ID。分割视图占位符被省略。一旦Frame属于NativeWindow，窗口ID就可用；较旧的核心可以省略它。 ID 是进程本地诊断身份，而不是恢复密钥、原生句柄或多窗口导航 API。单独的路由器收集器保持独立；实现的路由模型参见[窗口所有权和重构](./windows)。

快照的 `issues` 检测到有序 导航栈 不匹配、未知的原生页面、已资源清理的条目仍原生存在以及丢失/关闭的主机。当最新请求或原生操作正在进行时，比较会等待。时间线记录同步过程中发现的新问题；显式快照还可以在原生事件到达之前检测到更改。收藏家观察这些情况，并不修复历史。 `duplicate-result` 检测重复的结果结算信号。检查失败会报告代码，但不会复制底层错误。

## 订阅和导出 {#subscribing-and-exporting}

```ts
const stopListening = inspector?.subscribe((event) => {
  // Feed an app-owned viewer/logger. Keep this callback quick.
  consume(event)
})

const json = inspector?.export()
const data = inspector?.toJSON()
stopListening?.()
```

该包提供独立的 JSON 格式和原生演示的检查器。可选的 [报告查看器](./diagnostics-viewer) 可以在没有专用 NativeScript-Vue 开发工具扩展的情况下读取这些导出。您还可以通过 Chrome DevTools 中应用程序拥有的参考来检查收集器。不会自动安装进程全局检查器或网络传输。

`toJSON()` 返回 `{ version: 1, routerId, clock: 'monotonic', startedAt, droppedEvents, events, snapshot }`。最旧的事件将被满负荷丢弃；保留的跨度末端可能失去了起点。 `clear()` 清空缓冲区和丢弃计数器，同时保留 ID 和时钟原点。

`stop()` 释放实时快照源和订阅，冻结最后一个快照并仅保留有界的纯数据报告。它对于该收集器来说是永久性的，并且不会停止导航。应用程序卸载会自动停止； Vue 在处理根组件之前调用此钩子，以便最终快照仍然可以描述最后一个活动的 导航栈。当页面卸载时，显式取消订阅页面拥有的侦听器。

## 隐私和原生演示 {#privacy-and-native-demo}

路由由其匹配的 **pattern** 表示，例如 `/messages/:id(\\d+)`。解析的参数/路径值、查询、哈希、元数据、属性、结果、原生对象、异常消息和 导航栈 永远不会导出。路由模式和 导航栈 名称是应用程序定义的标识符：将用户数据排除在这些定义之外。收集器没有复制任意路由/页面数据的选项。

在调试演示中，打开 **设置 → 导航诊断**。将 350 毫秒 导航守卫 与 80 毫秒同步页面设置进行比较，插入非托管原生 Page 以观察不匹配和恢复情况，并复制经过编辑的 JSON 报告。原生检查与垫片测试分开记录；时序示例是诊断装置，而不是性能保证。
