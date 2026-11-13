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

## 实验性录制契约 {#experimental-recording-contract}

单独启用录制，以保留原生状态与逻辑状态的中间观测：

```ts
const router = createRouter({
  routes,
  diagnostics: {
    maxEvents: 500,
    recording: { maxRecords: 500, maxBytes: 1024 * 1024 },
  },
})
const inspector = router.diagnostics!
inspector.checkpoint() // e.g. after an app-owned tab selection
const capture = inspector.recording() // readonly v2 object; no live sampling
const recordingJSON = JSON.stringify(capture)
const legacyJSON = inspector.export() // unchanged v1, for the current viewer
```

[查看器](./diagnostics-viewer#replay-v2-observations)导入 v1 和 v2、验证录制，并提供同步离线回放及已观测分歧分析。读取录制不会执行导航守卫、请求数据、在应用中导航或恢复原生对象。

`recording: true` 使用上述默认值。`maxRecords` 接受 1–10,000，`maxBytes` 接受 1,024–8,388,608。两个限制均作用于独立的 v2 缓冲区；`maxEvents` 继续限制 v1。`retainedBytes` 统计记录数组紧凑 UTF-8 序列化后的字节数，包括方括号和逗号。报告的小型外层结构、格式化空白、导出副本以及快照的临时内存分配不在此预算内。这是保留容量限制，不是堆内存限制。

v2 外层结构包含 `captureId`、`routerId`、`clock`、`startedAt`、`stopped`、`epoch`、`limits`、`retainedBytes`、`droppedRecords`、`clearedRecords`、`overhead` 和 `records`。每条记录都有递增的 `sequence`、所属的 `epoch` 和单调递增时钟下的 `time`。事件记录保留 v1 关联 ID。检查点包含完整的 `snapshot`、`observations`、`boundary` 以及可选的触发事件 `eventId`。各检查点相互独立：丢弃较早的检查点不会使后面的检查点失效。

收集器在初始化、事件、原生协调前后逻辑状态更新、显式检查点、清空和停止时进行观测。原生历史来自 host 页面观测，而非操作名称推断。只有检查点时刻被观测：不存在连续录制或检查点之间的插值。外部标签切换会在下一个观测边界被记录；如果切换时刻很重要，请在选择后调用 `checkpoint()`。不会添加轮询或原生监听器。

`active` 仍表示条目的生命周期状态。`hostVisible` 描述 host 内部可见页面，不保证页面未被其他模态或窗口遮挡。`selected` 和 `tab` 在可用时记录所属标签和原生选中索引。`routerFocused` 标识 router 的目标栈；`inputFocused` 始终未知。空观测值必须保持未知。稳定的条目/栈/host/窗口/标签 ID 只在所属捕获中有意义；不要通过相同的局部 ID 合并独立捕获。

丢弃前缀会增加 `droppedRecords`。清空会推进 `epoch`，通过 `clearedRecords` 统计被清空的记录，写入清空缺口并观测一个新检查点。序列号和身份不会重置。过大的记录变为大小缺口；检查失败变为检查失败缺口，不含异常数据或部分状态。很小的缓冲区可能仅保留缺口或事件：这不代表空栈。保留的时段可能缺失一个端点。停止会冻结录制；导航可以继续。

不要依据忙碌中的检查点或协调之前的边界诊断稳定分歧。后续可比较的检查点可以显示**保留观测中首次**出现的不一致，但不能指出确切原因或起始时刻；缺失记录会扩大不确定范围。数据省略策略与 v1 相同。`overhead` 测量 v2 收集器的同步工作，不包括监听器、导出和渲染。录制增加检查及序列化开销，可能影响导航耗时；这不是 FPS 测量。

<Clip name="diagnostic-recording" :width="480" aspect="3 / 4" caption="真实 iOS 18.6 捕获：成功导航、守卫拒绝、取消、模态生命周期、故意制造的原生分歧及恢复、保留限制、清空与停止。fixture 标签为英文；无合成回放。" />

十项原生检查通过。收集器工作耗时和文件大小是 fixture 测量结果，不保证设备性能。请参阅[验证报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-diagnostic-recording-stage1.md)和[可复现驱动](https://github.com/rafaelaugustos/vue-router-ns/blob/main/scripts/native/recording/README.md)。
