# 辅助功能焦点和运动 {#accessibility-focus-and-motion}

NativeScript 已经在原生导航后宣布了 Page，并尝试恢复其最后的以辅助功能为中心的背面视图。除非页面选择明确聚焦，否则路由器会保留该行为。 UIKit 和 TalkBack 继续拥有辅助功能遍历、语音、文本大小调整和键盘输入焦点。

## 明确的焦点目标 {#explicit-focus-targets}

```vue
<script setup lang="ts">
import { useNavigationFocus, useRouter } from 'vue-router-ns'

const router = useRouter()
const focus = useNavigationFocus({ initial: 'heading', return: 'reply' })
async function reply() {
  focus.remember('reply')
  await router.pushForResult('/compose')
}
</script>

<template>
  <Page>
    <ActionBar title="Message" />
    <StackLayout>
      <Label id="heading" text="Message subject" accessible="true" textWrap="true" />
      <Button id="reply" text="Reply" @tap="reply" />
    </StackLayout>
  </Page>
</template>
```

`useNavigationFocus({ initial?, return? })` 在路由页面设置期间注册一次。目标是稳定的视图 ID、NativeScript 视图/模板引用或返回这些视图的 getter（或者在不可用时为 null/未定义）。目标必须是此页面的已加载、可见、可访问的后代。选择有意义的标题或控件；路由器不会将不可访问的容器变成可访问元素。

在 Android 上，保留没有 `accessible` 的 `ListView` 行：核心使可访问视图可聚焦，然后 `ListView` 停止为该行提供 `itemTap`。该行上的 `accessibilityLabel` 足以让 TalkBack 将其作为一项读取，并且该行仍然是有效的焦点目标。保留 `accessible` 为 iOS，它不会影响 `UITableView` 抽头。

成功的原生转换请求一个目标：推送时为 `initial`，返回时为 `return`。页面的原生公告将一直保留，直到 Frame 历史记录确认转换，然后替换为 UIKit 布局更改通知或 Android 可访问性焦点操作。除了核心之外，没有额外的公告。防护拒绝和取消的原生转换不请求焦点。丢失、删除或资源清理的目标将回退到 NativeScript 的正常页面公告/恢复。没有目标请求键盘焦点或打开 IME。 `accessibilityAnnouncePageEnabled="false"` 仍然禁用自动公告。

在模态或结果导航之前立即调用 `focus.remember(target?)` 以识别其起始页面和元素。如果没有参数，它使用配置的返回目标。当屏幕上有详细信息页面时，这也适用于可见的拆分列表：关闭模式会恢复初始列表元素，而不是逻辑 导航栈 中恰好位于最后一个的窗格。如果没有明确的启动器，模式将返回到 导航栈 的首页。 `focus.focus('initial' | 'return')` 是一个显式的立即可访问性焦点尝试，并返回一个布尔值；当异步内容在转换后变得可用时使用它。

选择加入的页面隐藏覆盖的内容以使其无法访问，并在可见/资源清理时恢复其原始隐藏状态。 RouterSplitView 还隐藏其覆盖/空的窗格，同时保持两个扩展窗格均可访问。调整大小并不宣布新路线。之前的 Android 预览页面在整个预测手势（包括取消）期间会暂时排除在遍历之外，之后会恢复其原始状态。

不要在每个 `onPageActivated` 上放置自定义公告：该挂钩先于原生转换完成，并且还会激活两个扩展的分割窗格。在页面中保留文本换行、可缩放字体和原生控件；此可组合项不实现替代的可访问性树。

## 减少运动 {#reduced-motion}

`createRouter({ routes, motion: 'system' })` 是默认值。在每次路由导航或向后预览开始时，它会读取 UIKit 减少运动或 Android 的动画师启用设置（使用 Android 26 之前的持续时间比例回退）。

| 策略      | 路由器行为                                                                       |
| --------- | -------------------------------------------------------------------------------- |
| `system`  | 尊重当前操作系统首选项。无需重新启动。                                           |
| `reduced` | 省略路由器拥有的预览/缩放/共享过渡；请求无动画的推送、后退和模式呈现。           |
| `full`    | 保留正常路由器/原生转换选项可用。 UIKit/Android 仍可能执行其自己的可访问性策略。 |

减少运动不会改变路线、导航守卫、模态结果或历史记录。被绕过的共享转换状态被释放。该路由器之外的原生交互手势和转换继续遵循平台行为。选择退出 `full` 的应用程序应提供经过深思熟虑的应用程序首选项。

## 验证 {#validation}

请参阅存储库的 `test/native-accessibility.md` 以了解原生断言和未完成的手动 VoiceOver/TalkBack 检查。在实际应用程序中测试脏模式、取消滑动、分割宽度、不可用的目标和大文本。请参阅 [NativeScript 可访问性](https://docs.nativescript.org/guide/accessibility)、[UIKit 布局更改](https://developer.apple.com/documentation/uikit/uiaccessibility/notification/layoutchanged)、[导航守卫](./guards) 和[过渡](./transitions)。
