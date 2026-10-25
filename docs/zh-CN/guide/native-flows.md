# 系统选择器和原生流程 {#system-pickers-and-native-flows}

有些目的地不是页面：文档选择器、另一个应用程序的活动、共享表。系统拥有它们，它们可以比屏幕旋转更长久，并且它们的任何内容都不属于后面的 导航栈。 **native flow** 为他们提供了一个类型化的输入、一个类型化的结果和三个结果之一，仅一次解决。

<Clip name="ios-document-picker" caption="Attach 打开 iOS 文档选择器。取消返回到选择器已取消的表单，而不添加路线。" />

```ts
import { createDocumentPicker, useNativeFlow } from 'vue-router-ns'

const picker = useNativeFlow(createDocumentPicker())

async function attach() {
  const outcome = await picker.run({
    types: ['application/pdf', 'image/*'],
    multiple: true,
  })
  if (outcome.status === 'completed') attachments.value = outcome.value.uris
}
```

`run` 解析为 `{ status: 'completed', value }`、`{ status: 'cancelled', reason }` 或 `{ status: 'failed', error }`。原因：当系统UI被关闭时为`'user'`，当`before`选项说不时为`'guard'`，当同一页面再次运行流程时为`'replaced'`，当页面首先离开其导航栈时为`'disposed'`，在这种情况下，稍后到达的结果将被丢弃。 `running`是ref，从发布到结果都是`true`。启动流程的页面保持活动状态，并且没有任何内容进入历史记录：`onPageDeactivated` 不会针对路由器不拥有的系统 UI 触发。

在启动之前而不是之后运行检查：`picker.run(input, { before: () => session.user !== '' })` 使用 `'guard'` 取消，而不是尝试拦截系统未宣布的解雇。

## 文档选择器 {#the-document-picker}

`createDocumentPicker()` 通过原始页面的 AndroidX 活动结果注册表打开 `ACTION_OPEN_DOCUMENT`，或者在 iOS 14 及更高版本上从该页面自己的控制器打开 `UIDocumentPickerViewController`。需要已安装的页面。 `types` 接受 MIME 类型，包括 `image/*`、`audio/*`、`video/*`、`text/*` 和 `*/*`； `multiple` 允许多个文档。

结果包含 URI 字符串：Android 上的 `content://` 和 iOS 上的 `file://`。 URI 不是文件系统路径或永久访问授权。读取/复制数据、Android 持久 URI 权限和 iOS 安全范围 URL 访问/书签属于应用程序。当您需要原始原生结果对象来管理该访问时，请使用自定义适配器。

单独的手柄可以在Android上独立运行。 UIKit 每个窗口有一个演示槽：同时第二个文档选择器解析为 `failed`，而不是留下待处理的 Promise。等待解雇后再呈现另一个控制器。对同一句柄的新调用将替换先前的尝试；异步 导航守卫 无法通过较新的调用启动较旧的调用。

## 编写流程 {#writing-a-flow}

一个流有`kind`，可选`supported()`和`start(input, context)`。上下文提供了原始 `page`、相关性 `id`、`complete`、`cancel` 和 `fail`。从`start`返回一个清理函数：它运行在**的每个终端结果**上，包括成功、取消、失败和资源清理。释放代表/侦听器并解除拥有的原生 UI。

在Android上，呼叫`context.launchActivity(intent, (resultCode, intent) => { ... })`。它向原始 Activity 的 AndroidX 注册表进行注册，启动一次，并在流程稳定后删除注册。解析原生结果并调用 `complete`、`cancel` 或 `fail`。解析器异常变成失败结果。注册不使用全局选择的前台 Activity。

`requestCode` 和 `onActivityResult(handler)` 保留用于旧适配器。它们保留的数字范围不能保证不相关的插件使用相同的代码；新适配器应使用 `launchActivity`。

```ts
const share: NativeFlow<string, void> = {
  kind: 'share',
  start(text, context) {
    const controller =
      UIActivityViewController.alloc().initWithActivityItemsApplicationActivities(
        [text],
        null,
      )
    controller.completionWithItemsHandler = (_, completed) =>
      completed ? context.complete() : context.cancel()
    context.page?.ios.presentViewControllerAnimatedCompletion(controller, true, null)
  },
}
```

## 轮换和进程死亡 {#rotation-and-process-death}

AndroidX 适配器将尝试的注册密钥存储在活动的已保存实例状态中，并在重新创建 **后重新绑定该密钥，同时原始页面和 JavaScript 尝试保持活动状态**。它不会启动外部活动两次。使用 `disposed` 取消在不更改配置的情况下销毁所有者的操作。

Page 生命周期优先。路由器在 `Activity.recreate()` 期间保留 Frame 页面应用程序，允许挂起的流重新绑定到替换活动并接收其结果一次。删除路线或永久关闭其所有者仍会通过 `cancelled/disposed` 取消；迟到的结果无法再次解决该尝试或完成新的尝试。

Promise 没有在进程死亡后幸存下来。在 [页面状态](./restore#page-state) 或应用程序存储中保留应用程序拥有的“选取器已打开”标记，然后决定是否在重新启动后重试或恢复先前授予的访问权限。路由器不会将旧结果重播到新流中。保留标记不会保留文档权限本身。

`useNativeFlow` 对其页面进行尝试。当其所有者关闭时，较低级别的 `startNativeFlow` 调用者必须调用返回的 `dispose()`。系统UI不会创建路由器条目或触发路由器页面停用；正常的平台后台/前台事件仍然适用。
