# 上下文菜单预览 {#context-menu-previews}

要跨标题、菜单和键盘共享状态、异步执行和错误处理，请参阅 [页面操作](./page-actions)。

长按一行，看看它通向哪里，然后决定。在 iOS 上，`UIContextMenuInteraction` 显示带有操作菜单的目的地预览，点击预览会将其提交到导航中。 Android 没有实时预览，因此相同的选项变成了弹出菜单：首先是路线，然后是操作。

```vue
<script setup lang="ts">
import { vRoutePreview, type RoutePreviewOptions } from 'vue-router-ns'
import MessagePreview from '../components/MessagePreview.vue'

function menuFor(item: Message): RoutePreviewOptions {
  return {
    to: { name: 'message', params: { id: item.id } },
    preview: MessagePreview,
    props: { id: item.id },
    actions: [
      { title: 'Reply', image: 'arrowshape.turn.up.left', run: () => reply(item) },
      {
        title: 'Archive',
        image: 'archivebox',
        destructive: true,
        run: () => archive(item),
      },
    ],
  }
}
</script>

<template>
  <ListView :items="messages" @itemTap="open">
    <template #default="{ item }">
      <GridLayout v-route-preview="menuFor(item)" columns="auto, *">
        <!-- the row -->
      </GridLayout>
    </template>
  </ListView>
</template>
```

<Clip name="ios-context-menu" caption="长按预览消息；点击预览可打开其路线。 iOS 26模拟器。" />

`v-route-preview` 适用于任何视图，包括列表行；每次按下时都会再次读取选项，因此回收的行会预览现在显示的项目。 `<RouterLink>` 通过其 `menu` 属性在没有 `to` 的情况下采用相同的选项：

```vue
<RouterLink to="/messages/1" :menu="{ preview: MessagePreview, props: { id: 1 } }">
  <Label text="Lunch on Friday?" />
</RouterLink>
```

## 选项 {#options}

| 选项               | 含义                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `to`               | 目的地，与 `router.push`（或 `replace`）一起提交。 `clearHistory`、`withParents`、`frame`、`transition` 和 `zoom` 也适用。 |
| `preview`、`props` | UIKit 预览中显示的组件，与这些属性一起安装。                                                                               |
| `canPreview`       | 截至发稿时已调用。 `false` 将受保护的内容排除在预览之外；行动仍然显示。                                                    |
| `size`             | 与设备无关的像素。如果没有高度，则按照源的宽度测量内容。                                                                   |
| `actions`          | `{ title, image?, destructive?, to?, run? }`。 `image`是iOS上的SF符号； `to` 在 导航守卫 中导航，`run` 执行任何操作。      |
| `openTitle`        | Android：弹出窗口的第一项，默认“打开”。                                                                                    |

## 预览不是什么 {#what-a-preview-is-not}

预览在其自己的 Vue 应用程序中呈现，并在菜单关闭时被处理。它不是 导航栈 条目：没有 导航守卫 为其运行，`afterEach` 不会触发，没有任何内容被持久化，并且没有结果承诺得到解决。提交会运行通常的导航，因此页面会刷新；预览永远不会被重复用作页面。

授权属于`canPreview`。将重定向到登录名的 导航守卫 仍在提交时运行，并且按受保护的行仅显示在此之前的操作。

## 平台 {#platform}

| 平台    | 演示                                                                                                                              |
| ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| iOS 13+ | `UIContextMenuInteraction` 在视图上，`UIAction` 的 `UIMenu`，布局视图控制器中的预览，大小适合内容。提交使用流行风格，然后是导航。 |
| Android | `PopupMenu` 的标题。独立视图使用长按手势；列表行使用列表自己的项目长按，因此手势永远不会使该行吞掉其点击。                        |

交互遵循行的 `loaded` 和 `unloaded`，这就是列表回收如何为每个视图保留一个交互。原生检查位于存储库的 `test/native-context-menus.md` 中。
