# 模态和结果 {#modals-and-results}

用`modal: true`标记路线，或通过`ModalOptions`（`fullscreen`，`animated`，`cancelable`，`ios.presentationStyle`…）：

```ts
{ path: '/compose', component: Compose, modal: { fullscreen: true } }
```

<div class="clips">
<Clip name="ios-sheet" caption="Compose 在带有中型和大型棘爪的原生工作表中打开。 iOS 26模拟器。" />
<Clip name="android-sheet" aspect="9 / 20" caption="Compose 在材质 底部面板 中打开；系统 Back 将其驳回。 Android 16 模拟器。" />
</div>

`router.push('/compose')` 将其呈现在自己的框架内，因此它有一个 ActionBar 和自己的 导航栈。模态内的页面被推送。模式第一页的 `router.back()` 将其关闭。向下滑动、点击外部或按 Android 后退按钮也可以通过离开其页面的 导航守卫 来关闭它。路由器跟随并运行`afterEach`。

`push` 还以 `modal` 作为选项，以模态方式呈现任何路线，无论其记录如何。

## iOS 上的表 {#sheets-on-ios}

iOS 工作表可以停在中等高度、全高度或屏幕的一小部分，显示抓取器，并保持后面的页面可用，就像地图一样。在模态选项的 `ios` 中进行设置：

```ts
{
  path: '/filters',
  component: Filters,
  modal: {
    ios: {
      detents: ['medium', 'large'], // or a fraction of the screen: 0.4 (iOS 16)
      selectedDetent: 'medium', // the height it opens at
      largestUndimmedDetent: 'medium', // the page behind stays usable up to here
      grabber: true,
      cornerRadius: 24,
    },
  },
}
```

工作表在呈现之前进行配置，因此它会以正确的高度打开。 `push` 可以通过 `modal.ios` 下的相同选项，与记录合并。 Android 忽略它们；它有自己的[底部面板](#bottom-sheets-on-android)。

## Android 上的底页 {#bottom-sheets-on-android}

Android 没有制动装置。 Material 的 底部面板 具有静止状态：在窥视高度处折叠，在屏幕的一部分处展开一半，或展开到其内容。在模态选项的`android`中设置`sheet`，将路径集中呈现，材质默认为`true`：

```ts
{
  path: '/filters',
  component: Filters,
  modal: {
    ios: { detents: ['medium', 'large'] },
    android: {
      sheet: {
        peekHeight: 320, // the collapsed height, in device-independent pixels
        state: 'expanded', // or 'collapsed' (the default) or 'halfExpanded'
        fitToContents: false, // needed for the half-expanded state
        halfExpandedRatio: 0.6,
        skipCollapsed: true, // hiding from expanded skips the collapsed stop
        height: 520, // the content's height; by default, as tall as the content
      },
    },
  },
}
```

该路线仍然有自己的 Frame，因此页面会推入工作表内，`pushForResult()` 可以工作，而第一页上的 `router.back()` 会关闭它。将工作表拖走、轻按外部或按回按可通过离开 导航守卫 将其关闭：当 导航守卫 处于活动状态时，工作表无法拖走，并且外部轻按或返回会询问 导航守卫。 Material 没有用于拒绝隐藏手势的回调：持有的工作表仍然可以折叠，但无法拖动到其隐藏状态。 `cancelable: false` 使用户根本无法关闭它。 `push` 将其 `modal.android.sheet` 与唱片合并，如 `ios`。

对于长工作表内容，请使用原生 `ScrollView`。工作表的 `height` 限制了其可见区域，原生嵌套滚动允许其内容在其中滚动。 Back 首先关闭打开的键盘，然后再对工作表的历史记录进行操作。

该工作表使用路由器的 Back 处理，因此 导航守卫 在关闭之前运行。不支持 Material 的交互式预测背板动画。有关检查的行为和平台限制，请参阅 [native 验证报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-bottom-sheets.md)。

在其页面中，`useNativeHost()` 报告 `kind: 'bottom-sheet'`，`native` 是 Frame。

::: warning 添加材质以发布版本
NativeScript Android 运行时仅在调试版本中包含 `com.google.android.material`。在发货前将其添加到 `App_Resources/Android/app.gradle`：

```groovy
dependencies {
  implementation "com.google.android.material:material:1.12.0"
}
```

如果没有它，`push` 会拒绝并显示错误，而不是呈现一个简单的对话框。 `supportsBottomSheets()` 在运行时告诉你。
:::

## 获取结果 {#getting-a-result-back}

<Clip name="ios-modal-result" caption="回复打开模式；发送通过 pushForResult 将文本返回到原始消息。 iOS 26模拟器。" />

页面可以向打开它的人返回一个值。这适用于模式和普通页面：

```ts
// Message.vue
const reply = await router.pushForResult<string>('/compose')
if (reply) send(reply)
```

```ts
// Compose.vue
router.back({ result: text.value })
```

如果页面以任何其他方式关闭（滑动、后退按钮）或 导航守卫 阻止页面打开，则承诺以 `undefined` 解析。

## 解雇和平台版本 {#dismissal-and-platform-versions}

`cancelable: false` 防止用户解雇（例如 Android 回到模态根）；代码仍然可以通过 导航守卫 调用 `router.back()`。模态根上方的页面仍然可以在 导航栈 内返回。

高度为 `'medium'` 和 `'large'` 的板材需要 iOS 15+；分数高度要求 iOS 16+。演示文稿必须支持表格。 Android 忽略 `ios` 选项，iOS 忽略 `android` 选项。 `pushForResult<T>()` 不会在运行时验证结果：`T` 描述了页面之间的契约。
