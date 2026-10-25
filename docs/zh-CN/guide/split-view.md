# 列表和详细信息 {#list-and-detail}

有关所有权、平台边界和 rc.2/rc.3 区别，请参阅 [native 功能和容器选择](./capabilities)。

`RouterSplitView` 当有足够的空间时并排显示列表及其详细信息。在一个狭窄的窗口中，详细信息涵盖了列表。它在两种布局中使用相同的路线和导航方法：

```vue
<RouterSplitView name="inbox" list="/messages">
  <template #empty>
    <Label text="Select a message" horizontalAlignment="center" verticalAlignment="middle" />
  </template>
</RouterSplitView>
```

<Clip name="ipad-split" :width="480" aspect="3 / 4" caption="当消息推送到详细信息 导航栈 时，收件箱保持可见。 iPadOS 26模拟器。" />

`list` 路线是固定的首页。推入此 导航栈 的每条非模态路由都会成为一个详细信息，无论其路径或嵌套在路由表中如何。 `modal` 的航线仍单独开通。命名的分割视图可以与普通的 `RouterView` 一起存在，包括在不同的选项卡中。

```ts
// Inside either pane, useRouter() is bound to the whole split stack.
await router.push('/messages/42')
await router.push('/messages/42/edit')

// From elsewhere, name the stack.
await router.push('/messages/42', { frame: 'inbox' })
```

## 布局和状态 {#layout-and-state}

布局遵循组件的可用宽度（以与设备无关的像素为单位），而不是设备类型或全屏尺寸。因此，改变可用宽度的旋转、窗口大小调整和折叠可以改变布局。默认断点为 840，列表列宽为 320：

```vue
<RouterSplitView list="/messages" :breakpoint="900" :listWidth="300" />
```

两个原生框架均保持安装状态。调整大小不会重新创建页面、运行导航 导航守卫 或更改所选路线。列表滚动位置、本地组件状态、未保存的详细信息字段和详细信息的原生背面 导航栈 保持不变。在展开布局中，`onPageActivated` 的列表和顶部详细信息均处于活动状态；模式会停用两者。 `router.currentRoute` 仍然是最重要的详细信息，直到用户返回到列表。

当扩展布局没有选定的详细信息时，`empty` 插槽会出现在详细信息列中。它不是路线或历史条目。

## Android 可折叠布局 {#android-foldable-layouts}

![原生折叠感知分割](/media/android-fold-hinge.png)

Android 模拟器：原生窗格将操作系统报告的铰链区域留空。

在 `App_Resources/Android/app.gradle` 中安装可选的 AndroidX Java 回调桥：

```groovy
dependencies {
  implementation 'androidx.window:window-java:1.5.1'
}
```

添加依赖项后重建原生应用程序。对于 RTL，在 Android 清单的 `<application>` 上启用 `android:supportsRtl="true"`，就像其他原生 Android 布局一样。 `foldAware` 默认为 `true`；当桥可用时，每个安装的分割视图都会从其自己的活动中观察 `WindowLayoutInfo`。它在卸载或卸载时删除侦听器，并在加载时再次订阅。没有进程范围的前台 Activity 或设备模型启发式选择其所有者。

分离折叠或完全闭锁铰链优先于`breakpoint`和`listWidth`。垂直功能将列表和详细信息放置在两个物理区域中；该列表位于 RTL 的右侧。水平功能将列表置于详细信息之上。该间隙不包括铰链，NativeScript 的整数网格长度向外倒圆。仅与一个可用侧相交的视图使用紧凑导航将两个框架保留在该侧。

平坦、不分离、不遮挡的折叠不会改变布局。如果没有相关功能，没有可选的依赖项，并且在 iOS 上，则应用通常的基于宽度的布局。要明确选择退出：

```vue
<RouterSplitView list="/messages" :foldAware="false" />
```

相同的框架和页面在姿势变化后仍然存在；导航历史记录、草稿和滚动状态保留附加到其原始条目。 `empty` 插槽占据详细区域。这是用于单个相交折叠功能的两窗格布局，而不是 Android 活动嵌入或附加原生窗口。包含应用程序仍然拥有其 Android 配置更改和进程恢复策略。

原生证据和复制命令位于[可折叠验证](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-folding.md)中。另请参见 [AndroidX WindowManager](https://developer.android.com/jetpack/androidx/releases/window) 和 [FoldingFeature 语义](https://developer.android.com/reference/androidx/window/layout/FoldingFeature)。

## 历史和背部 {#history-and-back}

历史在两种布局中的运作方式相同。使用 `push()` 选择另一个项目会添加详细信息；它不会放弃之前的选择。鉴于：

```text
/messages → /messages/42 → /messages/42/edit
```

Back 首先返回到 `/messages/42`，然后返回到列表。在展开的布局中，最后一个背面会清除详细信息列。 Native back和router back保持同步，保留导航守卫可以防止页面被删除。

- `push(list)`和`backToRoot()`通过导航守卫返回现有列表。
- `replace()` 替换顶部细节。在列表中，它打开第一个详细信息。
- `clearHistory: true` 清除详细历史记录并保留列表。
- `setStack()` 将列表保留为第一个条目，在省略时将其添加到前面。
- `pushForResult()` 像往常一样从详细信息或模态返回结果。
- `restore` 将组合列表/详细历史记录保存并恢复为名为 导航栈 的历史记录。
- `backToRootOnReselect` 在 `TabViewItem` 内部工作，就像在 `RouterView` 上一样。

## 原生行为 {#native-behavior}

列表和详细信息均使用原生 Frame。详细信息中的透明原生根 Frame 提供其返回目的地；此实现细节永远不会出现在 `router.stack` 或保存状态中。紧凑模式将细节 Frame 放在列表上；扩展模式将其放在旁边。在调整大小期间，页面永远不会在框架之间传输。

第一个详细信息跨窗格打开，因此此处不使用列表中的共享元素和 iOS 缩放过渡。详细信息页面之间的转换正常工作，包括 Android 预测后预览。从第一个细节返回列表使用 Frame 的正常返回转换。

`name` 和 `list` 在组件安装时读取。要创建不同的分体 导航栈，请安装具有不同 Vue `key` 的新组件。

## 选择加入 UIKit 列 {#opt-in-uikit-columns}

使用`RouterUIKitSplitView`作为原生窗口**的**根，让`UISplitViewController`管理主/辅列。需要iOS 18或更高版本以及Core的`SplitView`；测试的Core版本是9.1.3。选择 Android 上的现有自适应组件，或者在选项卡内嵌入拆分或其他布局时：

```vue
<script setup lang="ts">
import { supportsUIKitSplitView } from 'vue-router-ns'
const nativeColumns = supportsUIKitSplitView()
</script>

<template>
  <RouterUIKitSplitView
    v-if="nativeColumns"
    name="inbox"
    list="/messages"
    :primaryWidthFraction="0.32"
  />
  <RouterSplitView v-else name="inbox" list="/messages" />
</template>
```

路由器插件注册这两个组件。每个都使用相同的路由表、原生页面、导航守卫、结果并保存为 导航栈 格式。在创建窗口时做出选择；它不是安装的 导航栈 之间的运行时切换。

UIKit 拥有折叠/展开及其系统侧边栏控件。扩展列使用 UIKit 的平铺布局。 `primaryWidthFraction` 是可用宽度的首选部分，受 UIKit 的限制。显示或隐藏主列仅更改显示：选择一个项目仍会调用 `push()`，添加详细信息并保留以前的选择。 Back 通过这些详细信息返回并最终清除详细信息列。原生 Back、受保护的解雇、模态和 `restore` 保留上述历史语义。列适应保持相同的页面及其本地状态。

对于实际的 iPad 窗口大小调整，允许 `App_Resources/iOS/Info.plist` 中的多任务处理并支持所有 iPad 方向：

```xml
<key>UIRequiresFullScreen</key>
<false/>
```

全屏兼容模式可以缩放应用程序的表面，而无需为其提供较小的 UIKit 窗口。有关区别和测试版本，请参阅 [native 接受矩阵和复制命令](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-uikit-split.md)。

该组件公开 `name`、必需的 `list` 和 `primaryWidthFraction`（默认 `0.32`）。它的空细节是空白的；它没有 `empty` 槽、断点、补充或检查器列。它必须拥有窗口根：不要将其包装在 `RouterDrawer`、`RouterTabs`、Page 或其他布局中。主栏是该窗口的侧边栏；将 `RouterDrawer` 单独用于 Android 布局。现有的 `RouterSplitView` 在两个平台上仍然可用。
