# 交互式转换：所有权和限制 {#interactive-transitions-ownership-and-limits}

交互式手势不仅仅是带有进度值的动画。原生宿主决定哪些控制器或页面参与、手势是否可以启动、何时提交以及何时可以处理这些页面。路由器必须保持其历史、导航守卫 和结果承诺与该决定一致。

此 rc.3 调查是否 **不** 添加了统一的交互转换 API。它记录了已发布的基线（NativeScript Core 9.1.3、NativeScript-Vue 3.1.2、iOS 运行时 9.1.0 和 Android 运行时 9.1.1），并将其与实验性上游工作分开。

<Clip name="interactive-transitions" aspect="402 / 874" caption="实际 iOS 26 模拟器：反转和提交手势、缩放、导航守卫 和源删除。" />

## 能力矩阵 {#capability-matrix}

| 表面                               | 所有者和进度                                                  | 提交/取消                                                     | 路由器集成和限制                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 编程 `push` / `back`               | Core Frame 或选定的原生宿主拥有过渡； `transition` 选择其动画 | 无公共搜索/反向句柄                                           | 守卫在路由器导航之前运行。等待导航完成；不要将诊断持续时间解释为手势进度。                                                      |
| iOS Frame 边缘 Back                | UIKit 导航控制器拥有交互过渡                                  | UIKit 由真实手势决定                                          | 路由器调和了承诺的本土历史。活动页面在开始前保持 导航守卫 手势。 `useBackGesture()` 是 iOS 上的 `null`。                        |
| iOS 18+ `zoomFrom`                 | UIKit `preferredTransition`，当由运行时暴露时                 | UIKit 控制缩放和交互式消除                                    | 路由器提供弱源视图和同步准入谓词。丢失/卸载的源返回 `nil`。显式 Frame 默认过渡可以覆盖缩放。                                    |
| Core `SharedTransition` 交互式解雇 | Core 的 iOS 共享转换实现拥有其识别器/动画器                   | 原生流行；没有路由器拥有的可逆会话                            | 离开 导航守卫 不能否决此解雇。请勿将其用于依赖于该 导航守卫 的未保存编辑流程。 Android 上的共享元素并不意味着等效的交互式解雇。 |
| Android 14+ 预测 Back              | AndroidX 回调提供进度；路由器的默认预览显示以前的原生 Page    | 取消重置演示；版本运行路由器 Back 和 导航守卫                 | `useBackGesture()` 观察进度。它不获取历史记录或原生 Fragment 事务的所有权。根/模态根和受保护页面的行为不同。                    |
| 实验 Android Core 预览             | 提议版本 1 Frame `beginBackPreview` 会话                      | 仅演示 `update/cancel/finish/dispose`； `finish` 永远不会弹出 | 需要下面固定的候选者。已发布的 Core 回退到现有预览。不是 AndroidX FragmentManager 预测弹出实现。                                |
| UIKit 拆分/自定义主机              | 每个主机拥有其控制器和生命周期                                | 取决于该主机                                                  | Frame 证据不会为拆分列、多个窗口或第三方主机建立奇偶校验。                                                                      |

请参阅 [缩放/共享元素](./transitions)、[Android Back](./android-back)、[导航守卫](./guards) 和[native 托管](./native-hosts) 以获取支持的 API。

## 观察不是控制 {#observation-is-not-control}

Android 的进度回调可以驱动页面拥有的装饰性 UI。他们不授权调用 `popBackStack`、处理页面或解析模态结果。通过 `backPreview: false`，应用程序可以将 `useBackGesture()` 中的内容制作成动画；它仍然将导航委托给路由器。

UIKit 的转换协调器公开交互/完成上下文。调查夹具对其进行采样并附加完成观察者，而无需替换导航控制器委托或手势识别器。 `percentComplete` 是 **而不是** 一个记录的跨平台、连续采样的进度合约：Apple 的描述将其与进入非交互阶段的过渡联系在一起。未来的观察者需要一个明确的可用性模型，而不是在每个主机上制造 `0…1` 值。

Android Frame 实现使用自己的条目历史和 Fragment 替换；它没有在导航栈后面建立FragmentManager。仅添加 `addToBackStack` 以获得 AndroidX 搜索将更改更新、清除历史记录、模式和游戏合同。这是上游架构工作，而不是动画库适配器。

## 防护和生命周期排序 {#guard-and-lifecycle-ordering}

1. 在 **原生 iOS 解雇开始之前，必须知道页面离开 导航守卫 的活动状态**。异步问题无法追溯持有 UIKit 已经拥有的手势。使用受保护的原生 Back 按钮或路由器 Back 询问用户。
2. 当页面离开 导航守卫 处于活动状态时，Android 会抑制预览。全局/异步导航守卫释放后仍可拒绝导航；预览必须恢复演示。
3. 取消的手势保留条目、Page和待定结果。完成的弹出操作会删除该条目并一次性确定其结果。取消不得表示为临时弹出然后第二次推送。
4. 新的导航、主机卸载、更改的顶部/目标和源删除使手势开始时所做的假设无效。完成回调必须在改变任何内容之前验证原始条目/会话。
5. 原生模态的解除和内部 Frame 的弹出是不同的操作。弹出内部细节不得解决模态结果或改变呈现的 导航栈。

SharedTransition 的交互解除限制仍然是明确的。全局 导航守卫 并不是否决任意原生 UIKit 转换的一揽子承诺。

## 决策和可能的适配器边界 {#decision-and-possible-adapter-boundary}

保留 rc.3 的现有 API。不要从此证据中引入 `router.transition.progress`、`seek()` 或通用 `cancel()` 方法。

未来的**主机能力**提案应区分：

- **Observation：** 可选进度、交互结束和原生完成通知，每个通知都标有主机/窗口、条目标识和会话 ID。未知的进展仍然无法实现。完成必须区分提交、取消和中断。
- **演示控制：** 主机拥有的可选版本化会话。它可能会更新/取消/完成演示，但永远不会改变路由器历史记录。入场同步； 导航守卫/历史记录/结果仍然属于路由器所有。
- **Cleanup:** 一个终端结果；处理有关主机卸载、条目替换、取消或失败准入的侦听器/临时原生视图。过时的回调无法弹出更新的条目。仅在需要时订阅；避免运输路由器中出现永久的 JS 帧循环。
- **Fallback:** 当主机/运行时无法提供合同时的普通原生导航，不承诺视觉奇偶校验。减少运动会抑制可选变换，同时保留相同的导航/结果。

可选的 Jolt 适配器可以对应用程序拥有的装饰进行动画处理或实现明确支持的演示会话。它不得接管 UIKit 的委托，不得将 Android 预览视为片段查找，或成为运行时依赖项。适配器实施被推迟，直到主机功能和资源清理得到证明。

## 证据和上游状态 {#evidence-and-upstream-status}

选择加入的 iOS 夹具和 Android 跑步者位于 [`scripts/native/transitions`](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/transitions)。 [验证报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-interactive-transitions.md)确定了版本、场景和差距。这些是原生模拟器/仿真器检查，而不是物理设备性能结果。

Core 提案 [NativeScript #11558](https://github.com/NativeScript/NativeScript/pull/11558) 在 2026 年 10 月 24 日检查时仍处于打开状态且未合并。其固定候选者是 `fadb58f034e403933028f86746280375ea9811ff`；这项工作不会更改演示的已发布依赖项。现有的 [候选证据](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-predictive-back.md) 涵盖单独的 API 34/35/36 矩阵和 Frame 娱乐修复。不得将其描述为出厂时的 Core 行为。

Reduce Motion 在导航/手势准入时读取（`motion: 'system'`、`'reduced'` 或 `'full'`）。原生控件仍然是手势的可用替代方案。自动输入和辅助功能标签不会建立 VoiceOver/TalkBack 语音、辅助技术的焦点恢复或物理设备上可接受的运动。

## 主要参考文献 {#primary-references}

- [苹果：变焦交互入场](https://developer.apple.com/documentation/uikit/uiviewcontroller/transition/zoomoptions/interactioncontext)
- [Apple：协调器百分比语义](https://developer.apple.com/documentation/uikit/uiviewcontrollertransitioncoordinatorcontext/percentcomplete)
- [Android：进度回调和自定义动画](https://developer.android.com/guide/navigation/custom-back/support-animations-views)
- [Android：片段过渡要求](https://developer.android.com/guide/fragments/animate)

[Host 功能后续#145](https://github.com/rafaelaugustos/vue-router-ns/issues/145) 仍处于 rc.3 发布门之外。

## 观察提案 v0 {#observation-proposal-v0}

[#145提案和原型](https://github.com/rafaelaugustos/vue-router-ns/tree/main/research/transition-observation)观察普通UIKit Back，无需更换代表或投票。原生取消/提交和取消订阅/当前替换控件已记录证据，而条目身份映射、模式内部 Back 和几个生命周期/主机案例仍然存在差距。我们决定将其保留在研究中：没有新的公共观察者、持续进步的承诺或 Jolt 适配器。参见[原生报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-transition-observation.md)。
