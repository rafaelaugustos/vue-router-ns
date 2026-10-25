# Android 预测回 {#android-predictive-back}

在 Android 14 及更高版本上，路由器在向后滑动期间显示上一页。当前页面会随着手指缩小并显示出下面的页面。取消会恢复两个页面；释放完成动作并通过路由器返回，包括其导航守卫。

预览在同一 导航栈 中的页面之间进行，包括模态内的页面。模态框的首页仍然使用正常关闭，而不预览下面的 导航栈。应用程序首页中的 Back 仍离开应用程序。具有活动离开 导航守卫 的页面不会启动预览。如果之前的原生视图不可用，则正常的后退导航仍然有效。

## 定制 {#customizing}

默认情况下启用预览。要将动画替换为您自己的动画，请在路由器上禁用它：

```ts
const router = createRouter({
  routes,
  backPreview: false,
})
```

`useBackGesture()` 在有或没有预览的情况下仍然可用。它将进度传递给滑动将关闭的页面：

```vue
<script setup lang="ts">
import { computed } from 'nativescript-vue'
import { useBackGesture } from 'vue-router-ns'

const gesture = useBackGesture()
const scale = computed(() => 1 - (gesture.value?.progress ?? 0) * 0.1)
</script>

<template>
  <Page>
    <GridLayout :scaleX="scale" :scaleY="scale">...</GridLayout>
  </Page>
</template>
```

当用户拖动时，它是 `{ progress, edge }`，`progress` 从 0 到 1。其余时间它是 `null`：一旦取消或释放滑动，在 iOS 上，在第一页（返回离开应用程序的位置）上，在模式的第一页上`cancelable: false`，虽然离开 导航守卫 处于活动状态，但放手不会简单地关闭页面。释放可通过路由器返回，就像后退按钮一样，包括 导航守卫。

## 启用它 {#enabling-it}

在 `AndroidManifest.xml` 中的 `<application>` 上设置 `android:enableOnBackInvokedCallback="true"`，以接收 Android 14 和 15 上的预测回溯进度，即使面向 API 36 也是如此。面向 API 36 的应用程序的默认选择仅适用于在 Android 16 或更高版本上运行时。

另请参阅 [Android 预测性回溯文档](https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture)。

## 实验Core拥有预览 {#experimental-core-owned-preview}

默认保留现有路由器预览。要测试 [建议的 Core API](https://github.com/NativeScript/NativeScript/pull/11558)，请明确选择加入：

```ts
const router = createRouter({ routes, backPreview: 'core' })
```

Frame 主机功能检测版本 1 `beginBackPreview()` 会话。 Core 9.1.3 不公开此 API：通过已发布的依赖项，`'core'` 使用现有预览版。测试候选者需要构建建议的 Core 修订版；路由器不会自动修补已安装的软件包或安装未发布的 Core。其他自定义主机保留自己的预览实现。

候选者保持先前的 Page 分离并显示临时的原生位图。 Frame拥有其在航行、卸载、分离和活动娱乐过程中的资源清理权。守卫和路由历史记录仍然属于路由器。主动离开 导航守卫 会在预览开始之前抑制预览；全局/异步导航守卫在释放后运行并且可以拒绝导航。新的导航会使旧的手势失效。

![Core 真实 Android 返回手势](/media/android-core-back-preview.png) 期间的原型

这会牺牲同步捕获时间和内存以获得更清晰的原生视图所有权。快照是静态的，大小限制为 16 MiB，无法访问，并在使用后释放。 SurfaceView/TextureView 内容、安全窗口、自定义/共享过渡和不支持的捕获会回退到现有预览。模态 Frame 仅预览其之前的 Page。

候选人还在活动重新创建后修复了现有的 Core 附件竞赛。该更正属于上游提案；仅此路由器选项无法修复已发布的 Core。参见[Android 14/15/16比较和再现命令](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-predictive-back.md)。模拟器测量并不是物理设备性能的保证，并且默认情况下不会单独打开该原型的强度。
