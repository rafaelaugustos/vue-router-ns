# Page 行动 {#page-actions}

在路由页面中定义一次操作，并在原生标头和上下文菜单中重用其状态和回调。 `usePageActions`与NativeScript的`ActionBar`、现有的路由菜单和键盘命令组成；它不会取代原生导航控制器或后退按钮。

<Clip name="page-actions" caption="实际原生应用程序中的共享标头/菜单操作、禁用状态、本地化和错误。" />

```vue
<script setup lang="ts">
import { ref } from 'nativescript-vue'
import { usePageActions, vRoutePreview } from 'vue-router-ns'

const title = ref('Save')
const canSave = ref(true)
const errorMessage = ref('')
const actions = usePageActions(
  [
    {
      id: 'save',
      title,
      enabled: canSave,
      busyTitle: 'Saving…',
      image: 'square.and.arrow.down',
      async run({ signal }) {
        // Your application implements persistence and honors cancellation.
        await saveDraft({ signal })
      },
    },
    { id: 'details', title: 'Details', run: ({ router }) => router.push('/details') },
  ],
  {
    onError: (error) => {
      errorMessage.value = String(error)
    },
  },
)
// Keep the options object stable while only action state changes.
const menu = { to: '/details', actions: actions.menu(['save', 'details']) }
</script>

<template>
  <Page>
    <ActionBar title="Editor">
      <PageActionItem :actions="actions" action="save" ios.position="right" />
      <!-- Ordinary ActionItems can coexist here. -->
    </ActionBar>
    <StackLayout>
      <Label v-route-preview="menu" text="Hold for actions" />
      <Label :text="errorMessage" textWrap="true" />
    </StackLayout>
  </Page>
</template>
```

`PageActionItem`是由路由器插件注册的，也可以导入。将其放在所属路由页面的 ActionBar 内。 Refs 和 getters 保持标题本地化，无需重建注册表。上面的 `saveDraft` 是应用程序代码，而不是路由器 API。

## 定义和执行 {#definition-and-execution}

`usePageActions(source, { onError? })` 接受数组、ref 或 getter。 ID 在该注册表中必须是唯一且非空的；文字 ID 由 TypeScript 推断。

| 操作字段                        | 含义                                                    |
| ------------------------------- | ------------------------------------------------------- |
| `id`、`run({ router, signal })` | 稳定 ID 和同步或异步应用程序回调。                      |
| `title`、`busyTitle?`           | 字符串、ref 或 getter；运行时，忙碌标题会取代正常标题。 |
| `enabled?`、`visible?`          | 布尔值、ref 或 getter；两者都默认为 true。              |
| `destructive?`                  | 布尔值、ref 或吸气剂。仅演示；确认仍然是应用程序代码。  |
| `image?`                        | SF 符号名称、ref 或 getter，仅适用于 iOS 上下文菜单。   |

返回的 `get(id)` 和 `list()` 公开已解析状态（`id`、`title`、`enabled`、`visible`、`busy`、`image`、`destructive`）。 `busy` 是包含运行 ID 或 `undefined` 的只读 ref。 `menu(ids?)` 生成 `RouteMenuOptions.actions` 的绑定；选定的 ID 在调用时被捕获，同时它们的状态保持活动状态。如果 ID 集发生更改，则重新生成绑定。

每个注册表一次允许一个回调。当它运行时，它的所有操作在每个表面上都被禁用。重复点击会返回 false，而不是排队。单独的注册表是独立的。

- `await actions.execute(id)` 在回调完成时返回 true，在不可用时返回 false，并拒绝普通失败。 True表示回调完成，**未导航成功**：需要时检查`run`内部路由器的导航失败结果。
- `await actions.dispatch(id)` 是标题和菜单使用的事件适配器。它通过 `onError(error, id)` 报告一次故障并解决 false。如果没有处理程序，开发和生产中就会记录失败；还包含并记录抛出错误处理程序。
- 在处理信号中止后以 `AbortError` 拒绝的回调解析为 false。忽略取消并完成的回调仍解析为 true，包括成功弹出其自己的页面的操作。

## Page 寿命和导航 {#page-lifetime-and-navigation}

新调度要求所属页面为当前页面、已加载页面、位于所选选项卡中、未被模式覆盖且处于挂起导航之外。标题和菜单回调在执行之前重新检查。注册表不能附加到不同的页面或窗口。使用提供的 **页面范围路由器** 进行导航，以便现有的 导航守卫、结果和原始 导航栈 继续适用。路由器不会实现您的共享、编辑、删除、持久化或确认逻辑。

页面/主机的资源清理和 HMR 替换会中止信号并撤销旧的绑定。用详细信息或模式覆盖页面，或者更改选项卡，会阻止新的调度，但不会中止正在运行的操作。异步业务代码必须遵循 `signal`，包括 `await` 之后的副作用之前；路由器无法撤消被忽略的请求。资源清理后仍报告真正的晚期故障。支持等待`router.pushForResult()`。

对于回收行，当源项更改时提供 **fresh 选项对象**，例如 `v-route-preview="menuFor(item)"`。重新绑定、卸载和分离会关闭/使上一个菜单无效，因此旧的原生回调和预览提交无法对新项目进行操作。当菜单打开时，保持选项对象稳定以进行实时标题/启用的更新。当正在运行的操作必须在重新绑定后继续以该项目为目标时，捕获应用程序代码中的项目标识。

## 原生演示 {#native-presentation}

| 表面                 | 支持的演示                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 标头、iOS 和 Android | 一个 NativeScript ActionItem，其原生文本按钮为 `actionView`。反应性标题、可见性、禁用的辅助功能状态和破坏性文本颜色。 `buttonClass` 设置按钮的样式。 |
| iOS 上下文菜单       | UIAction 标题、SF 符号、禁用和破坏性属性。 iOS 14+ 上的开放菜单更新； iOS 13 读取初始状态并始终重新检查选择。                                        |
| Android 上下文菜单   | 原生 PopupMenu 标题、可见性和启用状态，包括打开时的更新。没有图标映射或破坏性颜色。                                                                  |

标头适配器是纯文本的。 NativeScript 将自定义 ActionView 直接放置在 Android ActionBar 中，因此此适配器不支持 `android.position="popup"`。将普通的 ActionItem 用于其他原生标题演示。 SF 符号未映射到材质图标。未安装工具栏、搜索控制器或​​导航代理，并且 `backAction` 仍属于其现有所有者。请参阅 [native 栏](./native-bars) 和 [上下文菜单](./context-menus)。

## 可选键盘绑定 {#optional-keyboard-binding}

重用现有注册表而不是安装另一个键盘调度程序：

```ts
const commands = useNavigationCommands([
  {
    id: 'save',
    title: () => actions.get('save')!.title,
    enabled: () => actions.get('save')!.enabled,
    shortcut: { input: 's', modifiers: [isIOS ? 'meta' : 'ctrl'] },
    action: () => actions.dispatch('save'),
  },
])
```

从 `vue-router-ns` 导入 `useNavigationCommands`，从 `@nativescript/core` 导入 `isIOS`。安装现有的 `NavigationCommandScope`，如 [键盘命令](./keyboard) 中所示。它的焦点、文本输入、IME 和系统快捷键规则仍然有效。没有什么会自动注册快捷方式。

存储库包括 `test/native-page-actions.md` 中可重现的原生输入检查和限制。
