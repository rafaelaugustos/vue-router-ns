# 原生键盘命令 {#native-keyboard-commands}

要跨标题、菜单和键盘共享状态、异步执行和错误处理，请参阅 [页面操作](./page-actions)。

命令是选择加入的并且属于路由页面。在内容周围的 Page 内渲染 `NavigationCommandScope`。它是一个原生的 GridLayout：正常布局属性（`rows`、`columns`、padding）起作用。它的 iOS 13+ UIView 参与焦点响应者链，并且在其内部轻按即可将键盘焦点移动到那里，而无需从下面的行或控件中获取触摸；在聚焦控件获得机会后，Android 通过 ViewCompat 侦听未处理的原生键。

```vue
<script setup lang="ts">
import { NavigationCommandScope, useNavigationCommands } from 'vue-router-ns'

const commands = useNavigationCommands([
  {
    id: 'back',
    title: 'Go back',
    shortcut: { input: '[', modifiers: ['meta'] },
    action: 'back',
  },
  {
    id: 'close',
    title: 'Close modal',
    shortcut: { input: 'Escape' },
    action: 'closeModal',
    allowInTextInput: true,
  },
  {
    id: 'compose',
    title: 'Compose',
    shortcut: { input: 'n', modifiers: ['meta'] },
    action: (router) => router.push('/compose'),
  },
])
</script>

<template>
  <Page>
    <ActionBar title="Messages" />
    <NavigationCommandScope :commands="commands">
      <Label text="Use the keyboard or the normal native controls." />
    </NavigationCommandScope>
  </Page>
</template>
```

显式选择平台绑定，例如 `isIOS ? 'meta' : 'ctrl'`。支持的输入是带有修饰符的字符：`Escape`、`ArrowLeft`、`ArrowRight`、`ArrowUp`、`ArrowDown`、`Enter` 和 `Tab`。修饰符为 `meta`、`ctrl`、`alt` 和 `shift`。使用 refs 或 getter 保持标题本地化；命令列表本身可能是 ref/getter。 ID 和快捷方式在一个注册表中必须是唯一的。每个注册表安装一个作用域。

`commands.list()` 解析当前标题和启用状态； `execute(id)` 返回是否已调度启用的命令，而不是返回其导航是否成功。导航失败/导航守卫 保留路由器的正常行为。当该操作运行时，重复调度将被禁用。 `focus()` 选择此窗格的命令响应程序并拒绝从文本编辑器窃取焦点。当没有编辑器拥有焦点时，点击其内容也会选择范围。

`back` 在非模态根处被禁用。 `closeModal` 通过所有正常离开 导航守卫 关闭整个模态 导航栈，并在可取消模态之外禁用。应用程序定义的操作接收页面绑定类型的路由器，因此它们以 导航栈 为目标，而无需咨询进程全局 Frame。下一个/上一个选项卡或目标是应用程序操作：原生 导航栈 没有转发历史记录。该演示包括使用页面自己的 NativeWindow 进行下一个/上一个选项卡绑定。

## 编辑和转义 {#editing-and-escape}

除非明确标记为 `allowInTextInput`，否则命令在文本编辑器中被禁用。即使使用该标志，标准选择/复制/粘贴/剪切/撤消/重做绑定也会被拒绝； IME 组合始终保持不变。可打印的键需要修饰符。平台系统快捷方式仍属于操作系统；不注册系统保留的组合。

Escape 首先属于聚焦的原生控件/IME。对于启用的路由器转义绑定，在注册的操作运行之前，活动页面拥有的搜索将被取消。应用程序覆盖层可以注册自己的 Escape 操作并决定何时委托；否则，显式 `closeModal` 绑定将通过模态 导航守卫。未安装未注册的 Escape/back 绑定。 Android 观察所属的 Page，因此包含工具栏搜索字段。内容范围之外的 UIKit 搜索字段保留 UIKit 自己的响应者行为。

在 iPad 上，启用的命令公开原生 `UIKeyCommand` 发现标题。 Android 没有 UIKit 风格的发现覆盖； `list()` 可以填充应用程序帮助视图。隐藏的选项卡、覆盖的页面和已资源清理的主机无法发送命令。多个窗口具有独立的原生响应器/视图树；命令绑定到实际视图，而不是全局最后创建的 Activity。模态呈现明确地针对原始页面。

这不会增加对在活动重新创建或场景重新连接中保留路由器历史记录的支持；在 #46 中单独跟踪。请参见 [导航守卫](./guards)、[native 搜索](./native-bars) 和 [UIKit 按键命令](https://developer.apple.com/documentation/uikit/uikeycommand)。
