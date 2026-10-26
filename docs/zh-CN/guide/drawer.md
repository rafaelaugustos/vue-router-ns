# 原生 抽屉导航 {#native-drawer}

有关所有权、平台边界和 rc.2/rc.3 区别，请参阅 [native 功能和容器选择](./capabilities)。

`<RouterDrawer>` 在现有原生 导航栈 周围放置一个起始边缘菜单。 Android使用AndroidX `DrawerLayout`； iOS 使用 UIKit 视图、平移手势和动画。两者都保持内容和 抽屉导航 插槽安装，而不添加路由。

::: info 在 rc.3 中添加
iOS 实现和自适应表示是 `0.1.0-rc.3` 的一部分。之前的 `0.1.0-rc.2` 仅支持 Android 上的叠加 抽屉导航。
:::

相同的模板适用于两个平台：

```vue
<RouterDrawer ref="drawer" :width="280">
  <template #drawer>
    <StackLayout class="menu">
      <Button text="Inbox" @tap="router.openLink('/')" />
      <Button text="Settings" @tap="router.openLink('/settings')" />
      <Button text="Account" @tap="router.openLink('/settings/account')" />
    </StackLayout>
  </template>

  <RouterTabs>
    <RouterTab name="inbox" title="Inbox" icon="tray.fill">
      <RouterView name="inbox" />
    </RouterTab>
    <RouterTab name="settings" title="Settings" icon="gearshape.fill">
      <RouterView name="settings" initial="/settings" />
    </RouterTab>
  </RouterTabs>
</RouterDrawer>
```

<Clip name="android-drawer" aspect="9 / 20" caption="抽屉导航 打开设置；系统Back在弹出页面之前关闭抽屉导航。 Android 16 模拟器。" />

默认插槽内容为：`<RouterTabs>`、`<TabView>`、`<RouterView>` 或 `<RouterSplitView>`。 `drawer` 插槽是窗格。打开或关闭菜单不是导航，不会创建路线条目；目的地是窗格导航到的任何位置，并且每个目的地都保留自己的名称 导航栈。通过 `openLink` 获取目的地可以让 `links.frame` 策略选择选项卡以及 导航栈。突出显示 `router.currentRoute` 中的当前目的地。

再次选择目的地时，抽屉导航 不会重置目的地的历史记录。它的按钮决定操作：使用 `openLink` 或 `push` 导航，或使用 `router.backToRoot({ frame: 'inbox' })` 显式返回到 导航栈 的根。选择当前路线仍会关闭该窗格。 `RouterView` 上的 `backToRootOnReselect` 适用于其选项卡的重新选择事件，而不适用于任意 抽屉导航 按钮。

## 打开、关闭、返回 {#open-close-back}

- `drawer.open()`、`drawer.close()`、`drawer.toggle()` 和 `drawer.isOpen` 位于组件的 ref 上； `v-model:open`、`opened` 和 `closed` 事件遵循原生状态，因此从边缘滑动也会更新它们。
- Android 后退按钮以及 Android 14 及更高版本上的后退滑动可在弹出任何页面之前关闭打开的 抽屉导航。这通过 `router.claimSystemBack()`，任何原生容器都可以使用：`claimSystemBack({ owns: () => isOpen, back: close })` 返回释放声明的内容。
- 成功导航将关闭 抽屉导航，除非 `closeOnNavigate` 是 `false`。拒绝导航的 导航守卫 会使其保持打开状态。
- 抽屉导航之上的模态或底部面板首先接收Back，包括其离开导航守卫和结果。如果将 抽屉导航 与 `:closeOnNavigate="false"` 保持打开状态，则 Back 在关闭模态后将返回到 抽屉导航。

## 自适应呈现 {#adaptive-presentation}

选择使用 `presentation="auto"`。 抽屉导航 测量其 **own 可用宽度**，因此旋转、较窄的父级和窗口大小调整可以更改演示文稿，而无需更换组件、其两个插槽、框架、页面或 Vue 实例。

```vue
<RouterDrawer
  ref="drawer"
  presentation="auto"
  :breakpoint="840"
  :width="280"
  v-model:open="menuOpen"
  @presentationChange="mode = $event"
>
  <template #drawer><!-- Destination buttons --></template>
  <RouterView />
</RouterDrawer>
```

| API                   | 行为                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `presentation`        | `overlay`（默认）、`permanent` 或 `auto`。                                                                          |
| `breakpoint`          | 自动永久呈现的最小容器宽度；默认 840 DIP。没有设备型号检测。                                                        |
| `width`               | 请求的窗格宽度。永久呈现将其限制在容器的一半处，除非单独的垂直折叠确定这两个区域。                                  |
| `foldAware`           | 默认 `true`。在永久模式下使用现有的可选 AndroidX WindowManager 集成。如果没有这种依赖性，基于宽度的自适应仍然有效。 |
| `drawer.presentation` | 只读解析的 `overlay` 或 `permanent`。                                                                               |
| `presentationChange`  | 更改时发出解析模式。第一个测量的布局可以解析`auto`；读取当前模式的句柄。                                            |

`open`、`drawer.isOpen`、`opened` 和 `closed` 描述的是**覆盖模式**。常驻面板在 `isOpen=false` 时仍然可见；`open()`、`close()`、`toggle()` 不会改变它，尝试设置 `v-model:open=true` 会被归一化为 `false`。常驻面板没有遮罩或抽屉拖动操作，不接管系统返回，`closeOnNavigate` 也不会隐藏它。菜单和内容均可接受触摸及无障碍遍历。

进入永久模式会取消飞行中的 抽屉导航 动画/手势并使模型标准化。先前设置的开放叠加会发出 `closed` 一次；从未解决的空缺不会发出迟来的 `opened`。返回覆盖层开始关闭，其隐藏窗格无法访问。模式更改不会导航、运行 导航守卫、消除路线模式或解决待处理的路线结果。在 iOS 上，可以立即更改模式，包括“减少运动”；普通的叠加动画保留其现有的策略。

通过[可选的折叠依赖性](./split-view#android-foldable-layouts)，分离/遮挡垂直特征将永久窗格放置在起始侧区域中，并将内容放置在其他区域中，不包括铰链。水平铰链使两者在更大的可用区域中彼此并排。 `foldAware=false` 选择退出。折叠几何形状不会迫使 `auto` 低于其断点；覆盖模式保留现有的全容器 抽屉导航 行为。当应用程序需要低于该阈值的铰链分离导航时，请使用永久模式。

适配时保留安装一个`RouterDrawer`。请勿在带有 `v-if` 的两个带键 `RouterView` 树之间切换。 抽屉导航 在现有 导航栈 周围添加了一个菜单； [`RouterTabs sidebar`](./tabs) 要求 UIKit 将其选项卡目的地显示为 iPad 侧边栏，而 [`RouterSplitView`](./split-view) 拥有列表/详细导航安排。永久 抽屉导航 是 iOS 上的自定义持久菜单，而不是 `UISplitViewController` 或 UIKit 的选项卡侧边栏。 `RouterUIKitSplitView` 仍然拥有窗口根并且不能被该组件包装。

<Clip name="adaptive-drawer" aspect="834 / 1210" caption="真实 iPad 输入：覆盖和永久模式、保留草稿和选项卡、RTL 和模态结果。" />

构建包后从 `demo` 运行 `ns run ios --env.adaptivedrawerTest` 或 `ns run android --env.adaptivedrawerTest`。 [验收报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-drawer-adaptive.md) 将自动原生输入/状态检查与出色的语音屏幕阅读器和真正的多窗口检查区分开来。

## 导航期间旋转 {#rotation-during-navigation}

在 iPadOS 18.6 模拟器上，测试在页面推进动画、程序触发的返回或交互式返回手势进行期间请求改变方向，观察到的是**导航结束后才开始界面旋转**。在这一执行顺序下，测试中的页面、Vue 实例、草稿以及原生和逻辑导航历史均得以保留；确认返回时，页面只卸载一次；取消返回手势时，页面仍然保留。这证明了导航期间收到旋转请求时的状态保持能力，但不保证 UIKit 同时执行两种动画。

在 iPadOS 26.0 上，即使 UIKit 取消了原本用于确认返回的长距离滑动，同一测试场景仍保持了状态一致。应以原生系统实际确认或取消的结果为准，不要假定旋转期间手势会保持原样继续执行。

当前测试驱动从常驻侧栏旁的内容边缘发起滑动时，未能启动交互式导航，因此这一方向仍存在明确的测试覆盖缺口。本次测试也未验证实体 iPad 或 Stage Manager。具体场景、实际执行顺序及剩余限制，请参阅[旋转验收报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-drawer-rotation.md)。

[独立返回对照测试](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-back-content-edge.md)在未使用 Vue 或 RouterDrawer 的 NativeScript Core 9.1.3 Frame 中也复现了内容区域右移后的限制。在 iPadOS 26.0 上，UIKit 对照测试区分了默认导航与暴露自定义转场回调的 delegate。常驻模式下应保留明确的返回操作。本次调查不代表已经验证该方向上返回手势期间的旋转行为。

## 样式与平台 {#styling-and-platforms}

该窗格是 `GridLayout`，类别为 `router-drawer`，背景为白色；为你的槽的根提供自己的背景和填充。 `width` 是与设备无关的像素。 `DrawerLayout` 附带 AppCompat，因此无需在构建中添加任何内容；可选材质`NavigationView`未使用，您自己的视图是菜单。

小型原生宿主位于此包中，并使用 NativeScript 运行时附带的 AndroidX 依赖项。它不需要单独的 抽屉导航 插件或核心补丁。有关已测试的 Android 和依赖版本，请参阅 [native 验证报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-drawer.md)。

在iOS上的覆盖模式下，该窗格覆盖iPhone和iPad上的内容。它的宽度被限制为留下 44 点带，以便在窗口狭窄时消除遮罩。在永久模式下，相同的 UIKit 视图彼此并排放置。在Android上，同一个AndroidX主机以永久模式布局两个内容子项；它不会使模态 抽屉导航 锁定在内容上打开。

`RouterUIKitSplitView` 必须拥有窗口根：不要将其放置在 抽屉导航 内。 `RouterSplitView`，组成Frame 导航栈，可以是抽屉导航内容。请参见 [拆分导航](./split-view)。

### iOS 手势和辅助功能 {#ios-gestures-and-accessibility}

- 在 导航栈 根处，从起始边的前 24 个点向内拖动以打开。拖动打开的窗格或点击遮罩以关闭。反向或中断的阻力稳定为一致的打开/关闭状态。
- 在推送的页面上，边缘属于UIKit的交互Back。主动离开 导航守卫 可以禁用该手势，如 [导航守卫](./guards) 中所述。 抽屉导航 不会取代导航控制器的代理或绕过 导航守卫。保持 ActionBar 菜单按钮可用。
- 打开会关闭键盘，将覆盖的内容与 VoiceOver 遍历隔离开来，并请求窗格中的焦点。如果仍然连接，则关闭会恢复先前的焦点目标。 Accessibility Escape 关闭该窗格。减少运动会跳过滑动动画。
- 呈现的原生模态保持在抽屉导航之上。从该模态返回时，`closeOnNavigate=false` 会将 抽屉导航 保留在原位。
- `opened`/`closed` 和 `v-model:open` 反映稳定状态，而不是中间拖动进度。调整大小会保留内容及其原生 导航栈。

[iOS 验证报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-drawer-ios.md) 将自动辅助功能状态检查与手动 VoiceOver 检查分开。

### 可运行的验收示例 {#runnable-acceptance-example}

[`demo/src/testing/drawer-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/drawer-app.ts) 包括路由器设置、三个独立选项卡、菜单按钮、可编辑草稿、条件 导航守卫 和模态结果。按照 [demo setup](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/README.md) 进行操作，构建软件包，然后从 `demo` 运行 `ns run ios --env.drawerTest` 或 `ns run android --env.drawerTest`。

<Clip name="ios-drawer" aspect="393 / 852" caption="原生iOS 抽屉导航：手势，保留导航栈、导航守卫和模态结果。 iPhone模拟器。" />

## 方向、输入和可达性 {#direction-input-and-accessibility}

窗格从起始边缘打开：LTR 中为左侧，RTL 中为右侧。 iOS遵循UIKit的有效布局方向； Android 使用 `START`。要从系统语言自动定向，请在应用程序的 `App_Resources/Android/src/main/AndroidManifest.xml` 中的 `<application>` 上启用 [`android:supportsRtl="true"`](https://developer.android.com/guide/topics/manifest/application-element#rtl)。您还可以在 抽屉导航 上显式设置 `direction="rtl"`。旋转保持相同的原生容器和安装的页面。

`direction` 接受 `ltr` 或 `rtl`；省略它遵循平台。在 iOS 上，该 prop 设置容器的语义方向并让 UIKit 继承它，从而保持原生导航视图自己的手势配置完整。

保留一个 ActionBar 按钮来打开 抽屉导航。通过Android手势导航，系统可以像Back一样消耗边缘滑动；该按钮仍然可用。 Back 在提交手势时关闭窗格；它不会预览或弹出 抽屉导航 后面的页面。

`DrawerLayout` 在打开时隐藏可访问性遍历所覆盖的内容。菜单内容属于应用程序：更喜欢本地 `Button` 目的地，为每个目的地提供清晰的标签，并使用 `accessibilityState="selected"` 公开当前目的地。仅具有点击处理程序的自定义布局也需要键盘和辅助功能激活；单独标记它并不能提供这些操作。
