# 本地目的地（实验性） {#native-destinations-experimental}

`defineNativeDestination()` 允许路线显示现有的 UIKit `UIViewController` 或 AndroidX `Fragment`。将其用作路由的 `component`。导航仍然使用原生框架、页面和路由器的现有历史记录、导航守卫 和结果。

路由器拥有一个包含Page和子控制器/Fragment。您的 SDK 拥有屏幕的 UI。这与 [native 流](./native-flows) 不同：目的地占用历史条目；系统选择器则没有。

## 定义目的地 {#define-a-destination}

```ts
import { defineNativeDestination, createRouter } from 'vue-router-ns'

const Editor = defineNativeDestination<{ documentId: string }, { saved: boolean }>({
  id: 'vendor.document-editor',
  input: (route) => ({ documentId: String(route.params.id) }),
  ios(context) {
    const editor = makeUIKitEditor(context.input.documentId)
    editor.onSave = () => context.complete({ saved: true })
    editor.onCancel = () => context.cancel()
    return {
      native: editor,
      dispose() {
        editor.onSave = null
        editor.onCancel = null
      },
    }
  },
  android(context) {
    const editor = makeAndroidXEditor(context.input.documentId)
    editor.setOnSave(() => context.complete({ saved: true }))
    editor.setOnCancel(() => context.cancel())
    return {
      native: editor,
      dispose() {
        editor.setOnSave(null)
        editor.setOnCancel(null)
      },
    }
  },
})

const router = createRouter({
  routes: [
    { path: '/', component: Home },
    {
      path: '/documents/:id',
      name: 'document-editor',
      component: Editor,
      meta: { layout: false },
    },
  ],
})

const result = await router.pushForResult<{ saved: boolean }>({
  name: 'document-editor',
  params: { id: '42' },
})
```

上面的 `makeUIKitEditor` 和 `makeAndroidXEditor` 代表您的 SDK 工厂，而不是路由器出口。每个调用必须同步返回一个新的、无父对象的原生对象。省略的平台工厂在进入该路线之前会产生明显的导航错误。

输入映射器还接收路由 props 作为其第二个参数。上下文提供了 `route`、`input` 和 `page` getter。 `page`安装后可用，废弃后变为`null`。从 Page 的控制器或活动中显示其他 SDK 对话框以保留窗口所有权。

原生目标拥有其 Page，并且不能使用命名的 Vue 布局。当路由器有默认布局时，设置`meta.layout: false`。路线级模式也有效。

## 结果，导航守卫 和外部去除 {#results-guards-and-external-removal}

| 操作                               | 行为                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `context.complete(value)`          | 请求路由器返回键入的结果；如果 导航守卫 阻止导航，则会解决导航失败问题。 |
| `context.cancel()`                 | 向路由器返回请求但没有结果；运行 导航守卫。                              |
| `context.beforeLeave(guard)`       | 登记离开 导航守卫；返回一个注销函数。                                    |
| UIKit 导航弹出 / Android Page 返回 | 现有主机协调会删除历史记录条目并结算其待处理结果。                       |
| SDK 删除其 Android 片段            | 子 FragmentManager 侦听器观察删除并协调 Page。                           |
| SDK 独立删除其 UIKit 子项          | 在删除提交后，从 SDK 的删除回调中调用 `context.dismissed()`。            |

`dismissed()` 报告已经发生、不可逆转的变更。它**不会**执行离开守卫，也不能撤销 SDK 已完成的关闭。如果 SDK 允许拦截关闭请求，应在移除界面**之前**调用并等待 `cancel()` 或 `complete()`。

当条目有活动离开 导航守卫 时，UIKit 的交互式弹出被禁用，就像 Vue 页面一样。 UIKit 提交后，无法否决对 `popViewController` 的任意直接 SDK 调用。此适配器不会替换 SDK 委托或全局拦截 UIKit 方法。

来自已关闭的条目或位于另一个条目下方的条目的完成/取消回调，不执行任何操作。根目的地没有上一页可返回； `dismissed()` 拒绝删除非模态根的尝试。当屏幕必须关闭时，使用 Vue 主页或模式。

## 所有权和恢复 {#ownership-and-restoration}

iOS 适配器在 Page 的控制器中执行子控制器遏制。 Android适配器使用所属Page Fragment的**child** FragmentManager；它不会将 SDK 事务添加到 Activity 的导航返回 导航栈 中。

当 NativeScript 重建原生视图时，工厂可能会再次运行。 `dispose()` 在分离每个工厂实例后运行一次。在那里发布 SDK 监听器、订阅和应用程序引用。将可序列化的应用程序状态保留在原生实例之外；切勿重复使用已处理的控制器或片段。

现有的 [history 恢复](./restore) 重新创建路由并使用重建的输入调用其注册工厂。保持路由标识/路径和工厂`id`稳定，并在重命名时迁移已保存的路由。没有控制器、片段、回调或挂起结果 Promise 被序列化。这并不保证自动恢复 SDK 的私有 UI 状态或多窗口场景恢复。

## 原生依赖项和示例 {#native-dependencies-and-examples}

路由器不捆绑供应商 SDK。将其原生依赖项添加到您的应用程序中。 SwiftUI `UIHostingController`、Compose 桥或具有 NativeScript 桥无法使用的 API 的 SDK 可能需要编译的 Swift/Kotlin 包装器。该原型的示例直接使用UIKit和AndroidX。

可运行的 [接受装置](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/destinations-app.ts) 包含原生工厂、按钮、取消和 SDK 解除回调。构建包后，使用 `demo` 中的 `ns build ios --emulator --env.destinationsTest` 或 `ns build android --env.destinationsTest` 构建它。

遏制遵循[UIKit的子控制器合约](https://developer.apple.com/documentation/uikit/creating-a-custom-container-view-controller)和[AndroidX片段交易](https://developer.android.com/guide/fragments/transactions)。 [native验证报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-destinations.md)记录了测试的平台版本和限制。
