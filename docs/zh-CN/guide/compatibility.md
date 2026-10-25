# RC 范围和兼容性 {#rc-scope-and-compatibility}

`0.1.0-rc.3` 候选版本冻结了已记录的非实验性 API，同时我们验证它的稳定版本。显式 JavaScript/TypeScript 路由表仍为默认值。文件约定是可选的；两者都使用原生导航，无需 Vue Router或 Nuxt 运行时。

## 支持的基线 {#supported-baseline}

| 依赖性            | RC 要求                           | 验收基线                                        |
| ----------------- | --------------------------------- | ----------------------------------------------- |
| NativeScript Core | `^9.1.3`                          | 9.1.3                                           |
| NativeScript-Vue  | `^3.1.2`                          | 3.1.2                                           |
| Node.js           | `>=20.19.4`                       | Node 20.19.4 和 22.23.3 安装； Node 22 原生构建 |
| npm               | 与所选 Node 版本兼容              | 10.8.2 和 11.21.1                               |
| webpack（可选）   | webpack 5、NativeScript webpack 5 | webpack 5.112.0 / NativeScript webpack 5.0.38   |
| Vite（可选）      | Vite 8、NativeScript Vite 8.0.20+ | Vite 8.3.4 / NativeScript Vite 8.0.20           |

RC 将 beta 的 Core `>=8.9.0` 和 NativeScript-Vue `^3.0.0` 声明缩小到经过验证的基线。在升级路由器之前升级这些依赖项。兼容版本范围并不意味着每个中间依赖项版本都经过测试。

原生 CI 涵盖 Android API 34/35/36 和 iOS/iPadOS 18.6 模拟器。其他 iOS 26 次运行和物理设备可访问性检查记录在存储库的 [验证报告](https://github.com/rafaelaugustos/vue-router-ns/tree/main/test) 中。这些报告确定了其经过测试的修订版本；它们并不意味着每个版本都有新的真机验证。

## API 范围 {#api-scope}

RC 冻结显式路由和带类型的导航位置；推/替换/返回和结果； 导航守卫和导航生命周期； RouterView、RouterLink、选项卡、抽屉导航 和 Frame 分割导航；模态路由；可选的页面状态恢复；以及下面实验列表之外记录的原生集成。缺陷修复仍然是可能的。在稳定之前不可避免的不兼容修正必须记录在新候选中的迁移说明中。

**仍处于实验阶段并选择加入**：

- [多个原生窗口](./windows)：每个窗口一个路由器，在记录的平台基线上独立的任务/场景恢复和同一进程重新连接。
- [Native Suspense 组合](./suspense)：稳定的 Page 内的显式渲染器兼容性注册和异步内容。
- [路由数据加载](./data-loading)：每个条目的状态和取消，而不阻塞原生呈现。
- [文件路由](./file-routing)，包括其生成/构建工具契约。现有的显式路由不依赖于它。
- [自定义原生宿主](./native-hosts) 和 [原生控制器/Fragment 目标](./native-destinations)。对于不兼容的契约更改，必须更改宿主契约版本。
- `backPreview: 'core'`，这需要 [预测返回报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-predictive-back.md) 中记录的固定上游原型。发布的 Core 使用现有的后备。

多窗口所有权和恢复作为实验功能包含在内，其接受证据和平台限制记录在 [窗口指南](./windows) 和 [页面状态报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-page-state.md) 中。该路线图不是发布承诺。 rc.3 添加了 [iOS 抽屉导航 和自适应呈现](./drawer)、[共享页面操作](./page-actions)、[诊断报告查看器](./diagnostics-viewer) 和 [集成展示](./native-showcase)。现有的 Android 叠加行为仍然可用；自适应呈现和共享操作是可选的。请参阅 [功能图](./capabilities) 了解原生所有者和支持的组合。

## 已知限制 {#known-limits}

- 围绕通用原生导航继承的 NativeScript CSS `direction` 可能会在 iOS 18.6 上触发手势图崩溃。 `RouterDrawer` 使用自己的 `direction` 属性和有界 UIKit 处理；通用布局仍在 [#139](https://github.com/rafaelaugustos/vue-router-ns/issues/139) 中进行跟踪。 Core 复现用例在 `Application.run()` 之前隔离了 `requestLayout()` 内过早的控制器视图加载。使用 `viewIfLoaded` 的候选 Core 校正通过了 iOS/iPadOS 18.6 键盘和交互式 Back 案例，包括 Vue 和路由器对照用例。它还不是已发布依赖项的一部分；这仍然是应用程序的限制。推迟方向和选择加入研究补丁都不是经过认证的应用程序解决方法。
- 自动原生可访问性标志、标签和焦点声明不保证语音 VoiceOver/TalkBack 遍历。 [展示验收](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-showcase.md)和单独的功能报告确定了剩余的手动检查。

- 原生 Vite HMR 使用 `.route.json` 元数据。 `definePageMeta` 可与 webpack 和捆绑的 Vite 配合使用，但在原生 Vite HMR 期间不受支持。添加/删除布局或中间件注册需要重新启动应用程序；脚本修改可能重新挂载页面。请参见 [文件路由](./file-routing)。
- 使用 npm 10，保持工作的 NativeScript Vite 锁定文件：它自己的可选对等依赖树在无锁定文件安装时可能会失败。路由器的 npm 10 安装崩溃已在 beta.15 中修复。请参阅 [安装](./install)。
- 进程死亡永远不会保留 JavaScript Promise。保留小型应用程序拥有的状态并在恢复后开始新的操作。在支持的已发布依赖项上重新创建 Android Activity期间，路由器会保留 Frame 页面应用程序，从而允许重新绑定挂起的原生流。删除路线或永久关闭其所有者仍会取消该流。请参见 [原生流程](./native-flows) 和 [状态恢复](./restore)。
- Material 标签页和底部面板需要其在已发布的应用程序中的原生依赖性，包括发布版本。可用性检测函数报告存在的情况；不会自动安装这些依赖。 Spotlight 索引/排名和外部 SDK 行为仍然是系统/提供商的责任。

## 发布验证 {#release-validation}

`main` 上的新版本仅在完整的 CI 和原生合约工作流程通过同一提交后才会发布。最终的 npm tarball 在发布之前安装到新的explicit-route、webpack 和 Vite 项目中； tarball 和安装日志作为工作流程工件保留。失败或取消的所需套件会阻止发布。实验性上游测试不能替代对已发布依赖项的测试。

RC 构建使用 npm 的 `next` 标签。与测试版一样，`latest` 也遵循最新的预发布版本，直到第一个稳定版本出现。使用精确的版本并提交锁定文件以实现可重现的应用程序构建。

请参阅[稳定版与 1.0 就绪评审](./stable-readiness)，了解发布条件、证据和剩余工作。
