# 缩放和共享元素 {#zoom-and-shared-elements}

点击一张卡片，让页面从其中延伸出来。在Back上，它缩小为相同的元素。这是 UIKit 的原生缩放，当运行时公开 `UIViewControllerTransition` 时，可在 iOS 18+ 上使用。 Android 和没有该 API 的运行时使用正常转换或显式回退。

<Clip name="ios-zoom" caption="卡以 UIKit 缩放打开消息并接收返回转换。 iOS 26模拟器。" />

## 带有 RouterLink 的卡 {#card-with-routerlink}

另存为`Inbox.vue`。 `RouterLink` 的单个子元素是源元素；不需要 ref 或 JavaScript 动画。

<<< ../../snippets/ZoomCard.vue

## 目的地和设置 {#destination-and-setup}

将目的地保存为 `Message.vue`：

<<< ../../snippets/ZoomMessage.vue

注册两个页面并在应用程序中安装路由器，如[安装指南](./install)中所示：

```ts
import { createRouter } from 'vue-router-ns'

export const router = createRouter({
  routes: [
    { path: '/', component: () => import('./Inbox.vue') },
    {
      path: '/messages/:id',
      name: 'message',
      component: () => import('./Message.vue'),
      props: true,
    },
  ],
})
```

在应用程序根目录中使用 `<RouterView />`。首先尝试单个 导航栈：展开的拆分中的第一个详细信息出现在另一个窗格中，而不从列表中缩放。

## 包含 zoomFrom 的列表行 {#list-row-with-zoomfrom}

将 `Inbox.vue` 替换为该版本，以使用 `itemTap` 提供的视图。上面的目标还具有用作后备的共享转换所需的标记。

<<< ../../snippets/ZoomList.vue

### 寻找什么 {#what-to-look-for}

- 点击一行：消息应在同一个 导航栈 中打开。
- 当缩放可用时，页面从行开始增长。 Back 应该返回源。
- 启用减少运动后，路由器请求无动画转换。
- 在Android上，具有相同`sharedTransitionTag`的标签参与共享转换。
- 正常的横向动画不演示缩放。检查运行时 API 可用性并避免在此框架上出现 `Frame.defaultTransition`。

[demo Inbox](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Inbox.vue) 使用带有后备功能的 `zoomFrom`。要重现视频，请从演示中的卡打开“设置”→“缩放”。本页面使用单个导航栈； [参见其来源](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Transitions.vue)。

## 转换参考 {#transition-reference}

`transition` 采用 NativeScript 的 `SharedTransition`，它将在两个平台上共享 `sharedTransitionTag` 的视图从一个页面更改为下一个页面：

```vue
<!-- in the list -->
<Image :src="photo.thumb" :sharedTransitionTag="`photo-${photo.id}`" />

<!-- in the photo page -->
<Image :src="photo.full" :sharedTransitionTag="`photo-${photo.id}`" />
```

```ts
import { PageTransition, SharedTransition } from '@nativescript/core'

router.push(`/photos/${photo.id}`, {
  transition: SharedTransition.custom(new PageTransition()),
})
```

返回倒转播放。它的交互式解雇（仅限 `interactive: { dismiss }`、iOS）是一种原生弹出，就像向后滑动一样：路由器跟随它，但离开 导航守卫 无法阻止它。

在 iOS 18 及更高版本上，`zoomFrom` 将动画交给 UIKit 的缩放：页面从视图中拉出，并在关闭时通过后退按钮、边缘滑动或向下拖动缩小回视图中。当离开 导航守卫 处于活动状态时，拖动会被保持，就像向后滑动一样。

```ts
function open({ index, view }: ItemEventData) {
  router.push(`/photos/${photos[index].id}`, { zoomFrom: view })
}
```

`zoomFrom` 采用视图、模板 ref 的元素或组件，并且 `<RouterLink zoom>` 缩小其自己的子级。如果页面关闭时视图已消失，则页面将关闭而不缩放。在不适用缩放的情况下（18 之前的 Android、iOS、`animated: false`），页面将获得通常的过渡，因此传递这两个过渡会为每个平台提供自己的过渡：

```ts
router.push(to, {
  zoomFrom: view, // iOS 18
  transition: SharedTransition.custom(new PageTransition()), // everywhere else
})
```

帧 (`Frame.defaultTransition`) 上设置的默认过渡将从 UIKit 取回动画，因此在缩放位置不要设置它。

在设计自定义手势适配器之前，请参阅 [交互式转换所有权和限制](./interactive-transitions)。
