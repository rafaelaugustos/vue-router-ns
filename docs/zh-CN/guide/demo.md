# 按功能划分的示例和视频 {#examples-and-videos-by-feature}

尝试 [Fieldnotes，集成的原生示例](./native-showcase)，在一个应用程序中跟踪 抽屉导航、搜索、共享操作、导航守卫 和模态结果。

有关所有权、平台边界和 rc.2/rc.3 区别，请参阅 [native 功能和容器选择](./capabilities)。

这些剪辑来自 [`demo/`](https://github.com/rafaelaugustos/vue-router-ns/tree/main/demo) 中的 NativeScript-Vue 示例，在模拟器和仿真器上运行。 Airbnb NS 在住宿应用程序中结合了导航功能；邮件应用程序和重点装置演示了单独的 API。两个应用程序都使用本地示例数据。

剪辑是静音的，可见时循环播放，并且具有播放控件。启用“减少运动”后，它们会等待您按下播放键。

选择一个特征，观察结果，然后复制相应的片段。示例使用 NativeScript 组件和演示路由表。在路由页面中，获取`router`，`<script setup>`里面有`useRouter()`；在应用程序配置中，使用 `createRouter()` 返回的实例。从 `vue-router-ns` 导入路由器组件。模板片段属于指定的组件，不会替换初始应用程序设置。

[安装](./install) · [从元素转换](./transitions#card-with-routerlink) · [完整演示](https://github.com/rafaelaugustos/vue-router-ns/tree/main/demo)

<a id="airbnb-ns"></a>

## Airbnb NS：一款住宿应用 {#airbnb-ns-an-accommodation-app}

<Clip name="ios-airbnb" :width="320" caption="Airbnb NS：原生选项卡、卡片缩放和手势消除、上下文菜单预览和收藏夹。编辑自 iPhone 17 / iOS 26 模拟器录音；动画以其原始速度播放。" />

27 秒的录制显示了使用 `vue-router-ns` 0.1.0-rc.2 的应用程序。它有一个葡萄牙语发现提要，带有水平轮播、永久收藏夹、原生选项卡和隐藏底部栏的详细信息页面。

| 在应用程序                 | 路由器功能                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| 点击停留照片并通过手势返回 | `RouterLink zoom`，并带有 `SharedTransition` 回退                                                        |
| 长按一张卡片               | `RouterLink menu`：UIKit预览和收藏的动作； Android 弹出菜单                                              |
| 探索并收藏                 | 命名为`RouterView` 导航栈，原生`RouterTabs`，徽章和公共彩色属性                                          |
| 在支持的原生宿主           | 上打开一个停留 `meta.tabBarVisibility: 'hidden'`                                                         |
| 应用搜索过滤器             | 通过 `pushForResult()` 返回其值的工作表                                                                  |
| 加载详细信息并保持转换响应 | 实验性离线路由加载器和 `<Deferred>`                                                                      |
| 重新打开浏览会话           | `restore` 和 `usePageState()` 的历史记录、垂直阅读位置、类别和图库照片；该应用程序保留所选选项卡和过滤器 |

录音覆盖前四行；搜索和冷会话恢复是单独的流程。目录和照片捆绑在一起，预订按钮显示虚构的摘要。行程、消息和个人资料是占位符。

[demo 设置](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/README.md#airbnb-inspired-navigation-demo) 后，从 `demo/` 运行：

```sh
npm run airbnb:ios
# or: npm run airbnb:android
```

[路由表](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/airbnb/router.ts) · [原生选项卡](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/airbnb/App.vue) · [停留页面](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/airbnb/pages/Stay.vue) · [完整的源和平台限制](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/README.md#airbnb-inspired-navigation-demo)

## 产品数据、错误和重试 {#product-data-error-and-retry}

声明一个类型化路由加载器并在一个原生 Page 内渲染挂起/错误/成功。 Back 并重试保留原生导航；应用程序缓存可以跨条目共享请求。 [完整示例和视频](./data-loading)。

## 从卡片中打开页面 {#open-a-page-from-a-card}

<Clip name="ios-zoom" caption="卡以 UIKit 缩放打开消息并接收返回转换。 iOS 26模拟器。" />

点击的元素可以是 UIKit 原生缩放的来源。给`RouterLink`一个独生子女； Android 和没有缩放 API 的运行时使用正常过渡。

```vue
<RouterLink :to="{ name: 'message', params: { id: 1 } }" zoom>
  <StackLayout padding="24" borderRadius="16" backgroundColor="#dbeafe">
    <Label text="Ana" color="#1e3a8a" />
    <Label text="Lunch on Friday?" color="#1e3a8a" />
  </StackLayout>
</RouterLink>
```

[完整示例：卡、包含 `zoomFrom` 的列表、目的地和路线](./transitions#card-with-routerlink)。 Zoom 需要 iOS 18+ 和运行时支持。在演示中，从卡中打开“设置”→“缩放”。

## 具有独立历史记录的选项卡 {#tabs-with-independent-histories}

打开消息，切换选项卡，然后返回到同一消息。再次点击所选选项卡可返回其根目录。 [配置原生选项卡](./tabs)。

<div class="clips">
<Clip name="ios-tabs" caption="iPhone 上的 UIKit 选项卡，包括重新选择 root。" />
<Clip name="android-tabs" aspect="9 / 20" caption="Android 上的材质选项卡具有相同的导航。" />
</div>

<Clip name="ipad-tabs" :width="480" aspect="3 / 4" caption="UIKit 的侧边栏在 iPad 上选择同名的 导航栈。" />

```vue
<RouterTabs sidebar>
  <RouterTab name="inbox" title="Inbox" icon="tray.fill">
    <RouterView name="inbox" initial="/" backToRootOnReselect />
  </RouterTab>
  <RouterTab name="settings" title="Settings" icon="gearshape.fill">
    <RouterView name="settings" initial="/settings" backToRootOnReselect />
  </RouterTab>
</RouterTabs>
```

在应用程序根目录中。 `sidebar` 启用 iPad 侧边栏；每个 `RouterView` 保留其自己的 导航栈。使用 `{ frame: 'settings' }` 导航也会选择该选项卡。 [完整源码](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/App.vue)。

## 推送、返回和列表/详细信息 {#push-back-and-list-detail}

底部的路径是现场路由器导航栈。打开另一条消息会添加一个条目； Back 到收件箱可删除一次导航中的详细信息。宽窗口使列表可见。 [导航](./navigating) · [列表和详细信息](./split-view)。

<div class="clips">
<Clip name="ios-navigation" caption="推送两条消息并返回iPhone的收件箱。" />
<Clip name="ipad-split" :width="360" aspect="3 / 4" caption="将消息推送到详细信息窗格，同时收件箱在 iPad 上保持可见。" />
</div>

```ts
await router.push({ name: 'message', params: { id: 1 } })
await router.push({ name: 'message', params: { id: 2 } })
await router.backToRoot()
```

在宽窗口中，将收件箱 `RouterView` 替换为：

```vue
<RouterSplitView name="inbox" list="/" :breakpoint="840" :listWidth="320" />
```

断点下方，列表和详细信息使用单列导航。在其上方，当详细信息打开时，列表保持可见。 [完整源码](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Message.vue)。

## 两个平台上的工作表 {#sheets-on-both-platforms}

Compose 在 iOS 上使用带有棘爪的 UIKit 板材，在 Android 上使用材料 底部面板。两者都托管一个带有自己的原生导航栏的路由页面。 [模态和结果](./modals)。

<div class="clips">
<Clip name="ios-sheet" caption="打开、展开和关闭 iPhone 上的撰写表。" />
<Clip name="android-sheet" aspect="9 / 20" caption="打开材料表并使用系统 Back 将其关闭。" />
</div>

```ts
router.push('/compose', {
  modal: {
    ios: { detents: ['medium', 'large'], grabber: true },
    android: { sheet: { state: 'expanded', height: 520 } },
  },
})
```

点击“撰写”，拖动工作表，然后使用“取消”或 Back 将其关闭。按照 [guide](./modals) 中的说明将材料添加到 Android 发布版本。 [完整源码](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Inbox.vue)。

## 导航前预览 {#preview-before-navigating}

长按会显示消息预览和操作。点击预览可打开路线。 [上下文菜单](./context-menus)。

<Clip name="ios-context-menu" caption="UIKit 的原生预览和生成的消息页面。" />

```vue
<RouterLink to="/messages/1" :menu="{ preview: MessagePreview, props: { id: 1 } }">
  <Label text="Lunch on Friday?" padding="24" />
</RouterLink>
```

从 `demo/src/components/MessagePreview.vue` 导入 `MessagePreview`。预览不会向 导航栈 添加页面；点击预览即可提交导航。 Android 呈现一个没有实时预览的菜单。 [完整源码](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Inbox.vue)。

## 守卫和形态恢复 {#guards-and-form-restoration}

帐户需要会话。 导航守卫 重定向到登录，输入姓名会激活离开 导航守卫。在 Android 上，该表单状态也可以在操作系统杀死后台进程后继续存在。 [守卫](./guards)·[恢复](./restore)。

<div class="clips">
<Clip name="ios-guards" caption="保留保留输入的姓名；离开允许页面关闭。" />
<Clip name="android-restore" aspect="9 / 20" caption="输入名称，将演示置于后台，终止其进程，然后重新打开并恢复表单。" />
</div>

```ts
import { Dialogs } from '@nativescript/core'
import { ref } from 'nativescript-vue'
import { onBeforeRouteLeave, usePageState } from 'vue-router-ns'

const name = ref('')
onBeforeRouteLeave(() => Dialogs.confirm('Discard this draft?'), {
  when: () => name.value.trim() !== '',
})
usePageState<{ name: string }>('form', {
  save: () => ({ name: name.value }),
  restore: (saved) => {
    name.value = saved.name
  },
})
```

将 `name` 绑定到 `<TextField v-model="name" />`。进程死亡后的持久化还需要[`restore.save`和`restore.load`](./restore)。身份验证 导航守卫 位于 [`demo/src/router.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/router.ts) 中。 [完整源码](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Login.vue)。

## 原生搜索和 抽屉导航 {#native-search-and-drawer}

搜索过滤当前页面而不添加路由。 Android 抽屉导航 通过路由器的链接策略获取目的地，并在弹出页面之前关闭。 [原生搜索](./native-bars)·[抽屉](./drawer)。

<div class="clips">
<Clip name="ios-search" caption="该页面拥有其原生搜索字段和查询。" />
<Clip name="android-drawer" aspect="9 / 20" caption="从抽屉导航中选择设置，然后关闭带有系统Back的抽屉导航。" />
</div>

```ts
import { computed, ref } from 'nativescript-vue'
import { useNativeSearch } from 'vue-router-ns'

const query = ref('')
const messages = [{ subject: 'Lunch on Friday?' }, { subject: 'Release notes' }]
const search = useNativeSearch({ query, placeholder: 'Search messages' })
const filtered = computed(() =>
  messages.filter((message) =>
    message.subject.toLowerCase().includes(query.value.toLowerCase()),
  ),
)
```

使用`filtered`作为`ListView`的`:items`并从`ActionItem`调用`search.activate()`。对于 抽屉导航，在应用程序根目录中声明 `const menuOpen = ref(false)` 并通过按钮切换它：

```vue
<RouterDrawer v-model:open="menuOpen">
  <template #drawer>
    <StackLayout>
      <Button text="Inbox" @tap="router.push('/')" />
      <Button text="Settings" @tap="router.push('/settings')" />
    </StackLayout>
  </template>
  <RouterView />
</RouterDrawer>
```

这个最小的示例有一个 导航栈。完整的演示结合了 抽屉导航 和选项卡；在 iOS 上，内容仍然可见，并且 抽屉导航 被省略。 [完整源码](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/App.vue)。

## 选择文件约定 {#choose-file-conventions}

单独的集合示例使用生成的路由、原生布局、身份验证中间件和类型化的模式结果。两种创作风格都使用相同的原生路由器。 [可选设置和来源](./file-routing)。

<div class="clips">
<Clip name="ios-file-routing" caption="在 iOS 上生成的路由：详细信息、模态结果和受保护帐户。" />
<Clip name="android-file-routing" aspect="9 / 20" caption="Android 原生页面上的相同收集流程。" />
</div>

```text
src/pages/
  index.vue          → /
  messages/[id].vue  → /messages/:id
  compose.vue        → /compose
```

选择 [webpack 或 Vite](./file-routing) 插件来生成此表。 [layouts](./layouts) 和 [middleware](./middleware) 示例展示了如何添加约定；在 TypeScript 中声明 `routes` 仍然是一个独立的选项。 [完整源码](https://github.com/rafaelaugustos/vue-router-ns/blob/main/examples/file-routing/README.md)。

## 从另一个页面接收结果 {#receive-a-result-from-another-page}

<Clip name="ios-modal-result" caption="回复打开模式；发送通过 pushForResult 将文本返回到原始消息。 iOS 26模拟器。" />

在消息中打开回复。发送时，回复将显示在打开模式的页面上。

```ts
import { ref } from 'nativescript-vue'
import { useRouter } from 'vue-router-ns'

const router = useRouter()
const reply = ref<string>()
async function compose() {
  reply.value = await router.pushForResult<string>('/compose')
}
```

在 Compose 中，调用 `router.back({ result: text.value })`。关闭而不发送解析为 `undefined`。类型描述了页面之间的契约。 [指南](./modals)·[完整源代码](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Message.vue)。

## 在正确的选项卡中打开链接 {#open-a-link-in-the-correct-tab}

<Clip name="ios-deep-link" caption="系统下发vueroutens://settings/account。选择“设置”，其 导航守卫 打开登录。 iOS 26模拟器。" />

在应用程序配置中，使用与 `RouterTabs` 相同的 导航栈 名称。

```ts
const router = createRouter({
  routes,
  links: {
    schemes: ['https', 'vuerouterns'],
    hosts: ['vue-router-ns.rafaelaugusto.dev'],
    frame: (to) => (to.path.startsWith('/settings') ? 'settings' : 'inbox'),
  },
})

await router.openLink('vuerouterns://messages/1')
```

注销时也尝试 `vuerouterns://settings/account`：导航守卫 应该在“设置”中打开登录。操作系统 URL 传递需要原生方案/域关联配置； `openLink()` 测试应用程序内的调度。 [设置和通知示例](./deep-links)。

## 应用程序图标上的快捷方式 {#shortcuts-on-the-app-icon}

<Clip name="ios-shortcuts" caption="长按演示图标并选择新消息以通过原生快速操作打开其路线。 iOS 26模拟器。" />

应用程序准备就绪后发布目的地，如 `demo/src/app.ts` 中。

```ts
router.setShortcuts([
  {
    id: 'compose',
    title: 'New message',
    to: '/compose',
    icon: { ios: 'square.and.pencil' },
  },
  { id: 'settings', title: 'Settings', to: '/settings' },
])
```

长按启动器/SpringBoard 中的应用程序图标，然后选择“新消息”。该路由使用相同的导航守卫。使用 `setShortcuts([])` 删除注销时的动态快捷方式。 [限制和固定快捷键](./deep-links)。

## 附上系统文档 {#attach-a-system-document}

<Clip name="ios-document-picker" caption="Attach 打开 iOS 文档选择器。取消返回到选择器已取消的表单，而不添加路线。" />

在路由页面的设置中，准备选取器并通过附加按钮调用 `attach()`。

```ts
import { ref } from 'nativescript-vue'
import { createDocumentPicker, useNativeFlow } from 'vue-router-ns'

const attachments = ref<string[]>([])
const picker = useNativeFlow(createDocumentPicker())
async function attach() {
  const outcome = await picker.run({ types: ['application/pdf'], multiple: true })
  if (outcome.status === 'completed') attachments.value = outcome.value.uris
  else if (outcome.status === 'failed') console.error(outcome.error)
}
```

选择 PDF 或取消。页面停留在相同的历史条目；取消保留之前的选择。 URI 不保证永久权限：读取和持久访问属于应用程序。 [完整的拾取器和生命周期](./native-flows)。

## 将焦点返回到打开模态框的按钮 {#return-focus-to-the-button-that-opened-a-modal}

启用 VoiceOver 或 TalkBack 后，打开和关闭“回复”。焦点应返回到启动按钮。

```ts
import { useNavigationFocus, useRouter } from 'vue-router-ns'

const router = useRouter()
const focus = useNavigationFocus({ initial: 'heading', return: 'reply' })
async function reply() {
  focus.remember('reply')
  await router.pushForResult('/compose')
}
```

```vue
<Label id="heading" text="Message" accessible="true" />
<Button id="reply" text="Reply" @tap="reply" />
```

将控件放置在页面内。这是辅助功能焦点，而不是键盘焦点。默认 `motion: 'system'` 遵循减少运动。 [完整示例和限制](./accessibility)。

## 构建一个具有可预测返回方式的 导航栈 {#build-a-stack-with-a-predictable-way-back}

当入口点需要特定历史记录时，使用目的地列表。

```ts
await router.setStack(['/', '/messages/1', '/messages/2'])
await router.back()
await router.backToRoot({ animated: false })
```

`setStack`后，Back打开消息1；最后一个命令返回到收件箱，没有动画。警卫可以中断顺序，并保留已完成的步骤。 [设置导航栈](./stack)。

## 更完整的示例 {#more-complete-examples}

- [键盘命令](./keyboard)：Cmd/Ctrl、Escape 和页面范围。
- [键入的路线](./typed-routes)：由TypeScript检查的名称和参数。
- [本地目的地](./native-destinations)：集成UIViewController和Fragment（实验性）。
- [预测返回](./android-back)：Android手势预览和取消。
- [Diagnostics](./diagnostics)：观察故障、转换和历史记录。

这些视频是原生导航的录音。焦点示例包括 VoiceOver/TalkBack 步骤：无声视频不演示屏幕阅读器公告。

## 运行相同的应用程序 {#run-the-same-app}

安装 [NativeScript CLI](https://docs.nativescript.org/setup/)，然后从存储库根目录构建本地路由器：

```sh
npm install
npm run build
cd demo
npm install
ns run ios
# or: ns run android
```

该演示从本地 `dist` 目录解析 `vue-router-ns`。更换路由器时，在单独的终端中使用 `npm run dev`。每个页面使用的API请参见[demo README](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/README.md)。
