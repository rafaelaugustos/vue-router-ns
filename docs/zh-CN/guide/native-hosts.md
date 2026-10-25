# 原生宿主 {#native-hosts}

::: warning 实验
主机合同是新的，并且可能在测试版本之间发生变化。更改会增加 `NATIVE_HOST_VERSION` 并列在更改日志中。请参阅 [版本控制策略](#versioning-policy)。
:::

**host** 是路由器在其中驱动 导航栈 的原生容器。`<RouterView>` 将 NativeScript `Frame` 交给路由器； `<RouterSplitView>` 递了两个；模态路由在原生模态中获取一个框架。每个都经过相同的合同，因此路由器保留匹配、导航守卫、结果、历史记录和协调的一种实现，而主机拥有演示、手势和原生句柄。

合同的存在使得可以添加原生 抽屉导航、工作表和平台控制器，而无需分叉路由器或在每个适配器内重新实现 导航守卫。内置主机为第一批用户：`createFrameHost(frame)`、`createFrameHost(frame, { modal: true })` 和 `createSplitFrameHost(list, detail, options)`。

## 主机的作用 {#what-a-host-does}

```ts
import type { NativeHost } from 'vue-router-ns'
```

| 成员                         | 角色                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `version`                    | 它实现的合约版本。必须等于 `NATIVE_HOST_VERSION`。                                                                  |
| `kind`                       | 诊断和错误的简称，如 `'frame'`。                                                                                    |
| `capabilities`               | 它本身可以做什么。请参阅 [功能](#capabilities)。                                                                    |
| `native`                     | 集装箱，`null` 一次资源清理。                                                                                       |
| `loaded`                     | `false` 而容器还无法显示页面，就像选项卡 iOS 从未显示过一样。它的推动等待；其他导航栈则没有。                       |
| `attach(delegate)`           | 在第一次推送之前调用一次。主机保留代表并通过它进行报告。                                                            |
| `pages()`                    | 页面按原始顺序从下到上，无论路由器是否安装它们。每次更改后，路由器都会据此进行协调。                                |
| `visible()`                  | 可选。当前屏幕上的页面，当可以有多个页面时。 `onPageActivated` 紧随其后。                                           |
| `push(component, options)`   | 将组件作为新页面安装在顶部。使用 `delegate.changed()` 报告完成情况。抛出或拒绝会使导航失败。                        |
| `back(target, options)`      | 返回到 `target`，这是 `pages()` 的页面，删除上面的内容。 `null` 关闭主机。使用 `changed()` 或 `closed()` 进行报告。 |
| `holdDismissal(hold)`        | 可选。当离开 导航守卫 处于活动状态时，保留用户自己的解雇。使用 `delegate.dismissAttempted()` 报告尝试。             |
| `previewBack(top, below, …)` | 可选。 Android 14+预测返回：滑动时显示`below`，落地时调用`commit`。参见 [`BackPreview`](./android-back)。           |
| `ownsSystemBack()`           | 可选。当前窗口的系统后台是否登陆到该主机上。                                                                        |
| `willAnimate(options)`       | 可选。 `false` 当下一页出现在尚未出现在屏幕上的窗格中时，因此会跳过缩放和共享元素。                                 |
| `parts()`                    | 可选。 [diagnostics](./diagnostics) 的原生容器，每个容器都有一个角色、一个原生句柄、`loaded` 及其页面。             |
| `dispose()`                  | 停止监听并释放句柄。当 导航栈 关闭时调用。安全地拨打两次电话。                                                      |

路由器传递给 `attach()` 的委托有五种方法：每次原生更改后的 `changed()`、主机自行离开时的 `closed()`、保留解雇的 `dismissAttempted()`、系统支持主机声明的 `backPressed()` 以及启动交互式返回的 `backGesture()`。报告其未进行的更改（例如 iOS 滑动）的主机将获得与 `<RouterView>` 相同的处理：路由器对其进行镜像，处理留下的页面，并运行 `afterEach`。

## 能力 {#capabilities}

路由器会询问而不是猜测。需要主机缺乏功能的导航会因显式错误而被拒绝，因此不受支持的 `clearHistory` 看起来永远不会起作用。

| 能力                   | 含义                                                                                                           | 不带                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `replace`              | `replace` 将页面本地放置在顶部，与推送的步骤相同。                                                             | `router.replace()` 拒绝。                 |
| `clearHistory`         | `clearHistory` 以与推送相同的步骤本地删除下面的每个页面。                                                      | `push(to, { clearHistory: true })` 拒绝。 |
| `pinnedRoot`           | 第一页保留，就像拆分视图的列表一样。 `clearHistory` 保留它，后面永远不会删除它，并且 `setStack` 为其添加前缀。 | 第一页是普通条目。                        |
| `close`                | 主机整体可以关闭，就像模态一样。 `back(null)` 关闭它。 根目录下的                                              | Back 不执行任何操作。                     |
| `cancellableDismissal` | 主机可以保留用户启动的解雇，直到离开 导航守卫 运行完毕。                                                       | 守卫只能看到路由器启动的导航。            |
| `multipleVisible`      | 屏幕上可以显示多个页面。 `visible()` 说的是哪个。                                                              | 仅顶部页面处于活动状态。                  |

转换、`animated` 和缩放源是演示：主持人可能会忽略它们。主机收到的选项是 `NativeHostPushOptions` (`initial`、`animated`、`transition`、`replace`、`clearHistory`) 和 `NativeHostBackOptions` (`animated`)。

## 挂载主机 {#mounting-a-host}

`<RouterView>` 对 Frame 执行此操作。对于您自己的容器，以名称挂载主机并使用 `{ frame: name }` 导航到那里，就像命名视图一样：

```ts
import { mountNativeHost } from 'vue-router-ns'

const unmount = mountNativeHost(router, 'sidebar', host, '/menu')
await router.push('/menu/settings', { frame: 'sidebar' })
unmount()
```

名称与 `<RouterView>` 共享，并且必须是唯一的。卸载关闭导航栈：待处理结果与`undefined`结算，让导航守卫不运行，主机被资源清理。

## 到达原生容器 {#reaching-the-native-container}

在路由页面内，`useNativeHost()` 向主机提供页面 导航栈 所在的主机。您自己输入容器：

```ts
import { useNativeHost } from 'vue-router-ns'
import type { Frame } from '@nativescript/core'

const host = useNativeHost<Frame>()
host.kind // 'frame', 'modal-frame', 'split-frame' or your own
host.capabilities.close
host.native?.ios // the UINavigationController, on iOS
```

一旦页面离开其 导航栈 或主机消失，`native` 就是 `null`。当您需要它时阅读它而不是保留它：句柄属于主机，并且模态框的框架不会在模态后继续存在。

## 编写主机 {#writing-a-host}

最小的完整主机是合约套件运行的内存示例：[`test/hosts/memory.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/hosts/memory.ts)。它根本没有原生容器；它使用 `createNativeView` 挂载页面，将它们保存在一个数组中，并报告稍后的刻度，就像转换一样。基于 Frame 的主机可以重用 `createFrameHost()` 并将其包装，这就是内置模态和拆分主机的组合方式。

路由器依赖什么：

- `pages()` 是事实。包括路由器未挂载的页面；诊断将它们报告为 `unknown-native-page`，而不是路由器猜测。
- 每次原生更改完成后调用 `delegate.changed()` 一次，并且 `pages()` 反映它。也称其为路由器自己的推和后退：这就是路由器知道它们完成的方式。
- 不要伪造你做不到的事情。在`capabilities`中声明。
- 彻底资源清理。在 `dispose()`、`native` 和 `null` 之后，侦听器消失，之后的平台事件将被忽略。
- 使用适配器传送原生依赖项。需要 Android Material 或 Swift 包装器的主机将其打包为自己的插件；路由器不受它的影响。

在请求支持之前针对主机运行合约套件。它位于 [`test/host-contract.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/host-contract.ts) 中，检查顺序、外部弹出、取消和并发导航、资源清理、不支持的操作和结果是否已解决一次。它针对 Frame 主机、拆分主机和内存主机运行。它无法取代设备检查：系统手势、进程死亡和可访问性需要真实的平台，记录在 [验证报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-validation.md) 中。

## 版本控制策略 {#versioning-policy}

- `NATIVE_HOST_VERSION` 是 `1`。主机声明它实现的版本，而路由器会拒绝具有显式错误的不同版本，而不是根据它不共享的假设来运行它。
- 虽然是实验性的，但合同可能会在测试版中发生变化。任何不兼容的更改都会影响版本，并在更改日志中列出，并一起更新内置主机、内存示例和合约套件。
- 添加可选成员或功能不会提升版本。未实现可选成员的主机将保留其当前行为。
- 当合约离开实验状态时，版本将遵循此包的 semver：仅在主要版本中不兼容的主机更改。
