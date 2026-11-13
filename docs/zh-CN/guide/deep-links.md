# 深层链接 {#deep-links}

路由是路径，因此无论您的应用程序在何处接收链接（URL 处理程序、通知负载），都将路径传递给路由器：

<Clip name="ios-deep-link" caption="系统下发vueroutens://settings/account。选择“设置”，其 导航守卫 打开登录。 iOS 26模拟器。" />

```ts
router.push('/messages/42')
```

这在冷启动时是安全的：在首页打开之前请求的导航会等待它，并且 导航栈 位于顶部，因此返回仍然会落在您的主页上。

## 包含父路由 {#bringing-the-parents-along}

嵌套页面的链接可以将其父页面带入，因此 back 会沿着应用程序的层次结构向上移动，而不是跳回家：

```ts
router.push('/settings/account', { withParents: true })
// stack: / → /settings → /settings/account
```

父级来自嵌套在路由表中的 `children`，只有具有组件的才成为页面：

```ts
{
  path: '/settings',
  component: Settings,
  children: [{ path: 'account', name: 'account', component: Account }],
}
```

已经在顶部的父级将被跳过，仅最后一页有动画，并且 导航守卫 为每个页面运行。对于`clearHistory`，父级和页面成为整个导航栈。 `<RouterLink>` 也采用 `withParents`。

## 接收操作系统 URL {#receiving-operating-system-urls}

选择使用 `links`，路由器会获取平台交给应用程序的 URL，旁边是应用程序已有的任何处理程序：Android 启动和新意图、iOS `openURL`、通用链接活动和场景连接。

```ts
const router = createRouter({
  routes,
  links: {
    schemes: ['https', 'myapp'], // others are ignored
    hosts: ['example.com'], // for http and https links
    map: (link) =>
      link.path.startsWith('/m/')
        ? { name: 'message', params: { id: link.path.slice(3) } }
        : { path: link.path, query: link.query, hash: link.hash },
    frame(location) {
      const settings = location.path.startsWith('/settings')
      // RouterTabs selects the tab that owns this stack.
      return settings ? 'settings' : 'inbox'
    },
  },
})
```

`links: true` 将每个 URL 作为路径。每个URL都变成一个`IncomingLink`：一个小写的`scheme`，一个`http`和`https`的`host`（对于像`myapp://messages/42`这样的自定义方案，`://`之后的所有内容都是路径），`path`，解析后的`query`、`hash` 及其来源：`'launch'`、`'resume'` 或 `'app'`。匹配器按照 `push` 的方式解码参数。如果没有`map`，链接的路径、查询和哈希就是位置；与任何路由都不匹配的 URL 将被忽略，除非有一个包罗万象的路由采用它。从 `map` 返回 `null` 以忽略链接。损坏的转义百分比/UTF-8、缺少 Web 主机、凭据、空格和协议相关 URL 为 `malformed`。 params 被解码一次；查询`+`是一个空格，重复的键是数组，没有`=`的键是`null`。查询值是不受信任的字符串：验证 `map` 中的应用程序特定格式；返回 `null` 或抛出拒绝目标为 `unmatched`。

链接以 `push(path, { withParents: true })` 的方式通过 导航守卫 着陆，因此经过身份验证的路由仍将其发送到登录。设置 `options` 以更改每个链接或每个具有功能的链接。冷启动时，链接会等待第一页，当 `restore` 重建 导航栈 时，它会落在它的顶部：首先保存历史记录，然后是链接。对于 `frame`，它会等待 `<RouterView>` 显示其首页，最多十秒。 [`RouterTabs`](./tabs) 自动选择目标选项卡。对于普通的 `TabView`，将其 `selectedIndex` 设置在 `frame` 内，以便在导航之前出现一个已卸载的选项卡。

平台可以在启动时和恢复时移交相同的 URL。匹配的启动/恢复对将在 1.5 秒内进行重复数据删除。两个温暖的交付是分开的水龙头，甚至靠近。已经位于顶部的页面会产生 `duplicated` 导航失败，就像 `push` 一样。通知提供程序可以提供 `deliveryId` 来删除同一事件的重复数据，即使在其回调之间有其他链接到达时也是如此；为每个有意的用户点击使用一个新的 ID。路由器在其生命周期内会在内存中保留最新的 256 个 id。

### 您自己的通知、小部件和链接 {#notifications-widgets-and-links-of-your-own}

`openLink` 与指向目的地的其他任何东西都是同一扇门：

```ts
const result = await router.openLink(notification.data.url, {
  deliveryId: notification.eventId, // optional, one id per user action
})
result.location // where it pointed, when it matched a route
result.failure // what a guard said, when it stopped it
result.ignored // 'scheme', 'host', 'unmatched', 'malformed' or 'repeat'
```

`resolveLink(url)` 只解析 URL 的目标，不执行导航；`onLink` 则接收所有交给路由器的链接，无论是否成功导航。要在登录后恢复链接，可以采用演示应用的做法：守卫重定向到登录页，并将目标保存在 `query.next` 中，登录页随后用该目标替换自身。也可以使用 `onLink`：当 `failure` 或当前路由表明登录拦截了导航时，保存 `result.location`，登录后再用 `push` 打开它。

## 导航 Intent（实验性） {#navigation-intents}

当应用的不同入口需要共享目标请求时，可以使用带版本号的 `NavigationIntent`。`resolveIntent` 只进行验证和解析，不导航、不执行守卫、不加载组件，也不选择标签页。`openIntent` 会再次验证，并复用现有链接的就绪等待与守卫执行流程。映射和路由重定向回调应保持纯函数行为。

```ts
import type { NavigationIntent } from 'vue-router-ns'

const request = {
  version: 1,
  source: 'internal',
  destination: { route: { name: 'message', params: { id: '42' } } },
  target: { frame: 'inbox' },
  delivery: { scope: 'account-session-17', id: 'tap-123' },
  expiresAt: Date.now() + 60_000,
} satisfies NavigationIntent

const preview = router.resolveIntent(request)
if (preview.status === 'resolved') {
  const result = await router.openIntent(request)
  if (result.status === 'handled') {
    console.log(result.location.fullPath, result.failure)
  } else {
    console.log(result.reason)
  }
}
```

`destination` 可以是 `{ route: ... }` 或 `{ url: 'myapp://messages/42' }`。路由使用绝对路径或字符串名称，以及可序列化的 params、query 和 hash。URL 复用现有 scheme/host 筛选与映射，其链接来源为 `'app'`。Intent 的 `source` 是应用定义的标签，并不能证明来源或权限。通知提供方回调、搜索与拖放适配器仍由应用负责；下文的通知 helper 负责验证目标数据。

仅接受普通 JSON 数据：不允许原生/Vue 对象、函数、访问器、symbol 或未知字段。请求会被复制并递归冻结。限制为紧凑 UTF-8 JSON 16 KiB、每个字符串 8,192 个字符、每个对象 32 个字段、每个数组 64 项、深度 7 和 1,024 个值。来源标签最多 128 个字符；投递和目标标识符最多 256 个字符。请先解析外部 JSON 并验证应用特定内容，再交给 router。结构验证不代表授权；正常守卫仍需检查权限。

接收请求的 router 负责执行。`target.windowId` 断言该窗口的身份，不会查找或打开其他窗口。`target.frame` 选择其具名栈。省略时，URL 请求先使用现有链接的 frame 策略，再回退到默认栈；路由请求使用默认栈。不会通过全局当前 Frame 来选择窗口。`options` 接受 `replace`、`withParents` 和 `clearHistory`，默认包含父级历史。先应用 URL 策略选项，再由 intent 的显式选项覆盖。解析过程不调用 frame 或 options 回调。

导航会等待就绪和历史恢复；尚未挂载的具名栈沿用十秒挂载期限。请求保留重叠导航的正常取消行为，不提供 FIFO 队列。`expiresAt` 会在接收时及就绪/栈等待后、进入导航前检查；它不会取消已经进入守卫的导航。等待后也会重新检查路由是否已删除以及窗口是否已关闭。执行错误仍会使 Promise 拒绝。

`delivery` 通过 `scope` 和 `id` 在同一 router 生命周期内跨来源标签去重。应用应管理账户/会话范围，为每次有意操作生成新 id，也可以省略该字段。最多保留 256 个进行中的请求，超出时返回 `busy`。最近 256 个已结束投递的 id 保留在内存中，包括被守卫拒绝或在等待中失效的尝试。重复请求返回 `repeat`；这是有界去重，并非持久化的恰好一次投递保证。现有链接的投递 id 保留独立的兼容命名空间。Intent 不触发 `onLink`；现有链接保持监听器及 launch/resume 去重行为。

预览返回 `resolved` 或 `ignored`。执行返回 `handled`，包含请求的 `location` 和可选的 `failure`，或返回带 `reason` 的 `ignored`。Handled 表示正常流程已经结束：守卫可能重定向、中止或取消，请求的页面不一定出现。忽略原因包括 `invalid`、`version`、`expired`、`unmatched`、`scheme`、`host`、`repeat`、`busy`、`wrong-window`、`owner-closed` 和 `target-unavailable`。不会把 payload 或投递标识符加入诊断数据。

请求不会持久化，也不会选择新窗口。下文介绍显式的内存内登录恢复；认证仍由应用负责。[原生测试应用](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/intents) 检查真实 Frame、守卫及系统 URL 投递；[验收报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-navigation-intents-stage1.md) 区分原生证据与单元测试覆盖。

<Clip name="navigation-intents" :width="640" aspect="3 / 4" caption="真实 iPad 模拟器：无导航预览、名称/URL 目标、重复投递和守卫结果、模态销毁及系统 URL 投递。应用标签为英文。" />

## 登录后恢复（实验性） {#resume-after-login}

在展示应用自己的登录页之前，或现有链接守卫重定向到登录页之后，使用 `suspendIntent(request, policy)`。它返回带句柄的 `suspended`，或 `ignored`。挂起操作会解析并复制请求，但不会导航、执行守卫、创建 Page 或检测认证。应用自行决定何时显示、替换或关闭登录页。

```ts
import type { NavigationIntent, SuspendedIntent } from 'vue-router-ns'

let authScope = {}
let authenticated = false
let pending: SuspendedIntent | undefined
const policy = {
  scope: () => authScope,
  authorize: () => authenticated,
  maxAge: 120_000,
}

async function requireLogin(request: NavigationIntent) {
  const result = router.suspendIntent(request, policy)
  if (result.status === 'ignored') return result
  pending = result
  await router.push('/login', { frame: 'inbox' })
  return result
}

async function completeLogin() {
  authenticated = true
  return pending?.resume()
}

function cancelLogin() {
  pending?.cancel()
  pending = undefined
}

function accountChanged() {
  authenticated = false
  authScope = {}
  cancelLogin()
}
```

真实认证提供方确认成功后，更新应用的认证状态并调用 `resume()`。不要根据不可信 payload 设置示例中的布尔值。`scope()` 在预期登录流程中必须返回同一个稳定对象；退出登录、切换账户或开始新认证流程时应替换它。`authorize(location, intent)` 只能在该目标仍获授权时同步返回 true。两个回调都必须保持纯函数行为；异步或抛出错误的权限检查会拒绝操作。会话身份和回调只保留在内存中，不会序列化到请求里。

每个 router 保留一个待完成的认证流程。新的有效挂起请求或被接受的 `openIntent` 会替换它；格式错误或重复投递不会。投递身份在登录和恢复期间保持占用，因此重复回调不会产生另一次尝试。授权后，所有 `resume()` 调用都返回同一个 Promise，即使它已经完成或拒绝。授权前调用会返回 `unauthorized`，并保留待处理请求。`cancel()` 会阻止后续准入；取消登录或会话变化时应调用它。正常导航到登录页不会自动取消待处理流程。

只读 `state` ref 报告 `pending`、`resuming`、`settled` 或 `cancelled`，并可包含 `reason`。范围变化返回 `scope-changed`；较新的 intent 返回 `superseded`；显式取消返回 `cancelled`。`maxAge` 为不超过 300,000 毫秒的正整数，默认五分钟；请求本身更早的过期时间优先。计时器会释放已过期的待处理工作。恢复时会重新检查过期、路由删除、所属窗口关闭和权限。与普通 intent 的准入检查不同，恢复操作会在异步守卫、组件加载和守卫重定向后继续检查，包括重定向后的目标。

正常守卫和导航失败仍然适用。若在守卫执行期间失效，导航会报告常规取消失败。已经提交的父页面和已经开始的原生过渡不会回滚；取消会阻止剩余的准入。挂起句柄不提供持久化的恰好一次投递保证。它表示该 router 生命周期内的一次幂等尝试。不提供请求持久化、自动认证提供方集成或推断账户身份。

若目标应替换登录页，请在请求中传入 `options: { replace: true }`，并明确指定同一个具名栈。应用负责权限、登录路由策略及退出登录后的受保护历史清理。现有 `openLink` 及其监听器仍然可用；在守卫重定向到登录页之后，监听器可以保留原始 URL。[原生验收](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-intent-resume-stage2.md) 演示了这种组合。

<Clip name="intent-resume" :width="640" aspect="3 / 4" caption="真实 iPad 模拟器：系统 URL 打开应用登录页，登录后只恢复一次；取消、账户切换、过期以及守卫期间退出登录会阻止过时导航。认证使用测试应用控制的状态，没有外部提供方；界面标签为英文。" />

## 通知目标 {#notification-destinations}

`notificationIntent(payload, context)` 将应用定义的 JSON 目标转换为冻结的 `NavigationIntent`，其中包含 `source: 'notification'`。该函数不解析路由，也不执行导航。负载只接受 `version: 1`、`destination`（路由或 URL）及可选的 `expiresAt`；投递标识、窗口/栈目标和导航选项由应用单独提供。

```ts
import { notificationIntent } from 'vue-router-ns'

// The provider adapter extracts this app-defined JSON field from an OPEN action.
const payload = {
  version: 1,
  destination: { route: { name: 'message', params: { id: '42' } } },
  expiresAt: Date.now() + 60_000,
}
const intent = notificationIntent(payload, {
  delivery: { scope: session.deliveryScope, id: response.openEventId },
  target: { frame: 'inbox' },
})
if ('status' in intent) {
  showIgnored(intent.reason)
} else {
  const preview = router.resolveIntent(intent)
  // Use suspendIntent(intent, policy) instead when app-owned login is needed.
  const result = await router.openIntent(intent)
}
```

示例中的 `session`、`response` 和 `showIgnored` 由应用定义。只从提供方的数据中提取经过审核的目标字段；将原生字典转换为普通 JSON 数据，并在解析文本前限制长度。未知字段、getter、函数、无效路由及超出 intent 限制的请求（包括最终数据总量 16 KiB）返回 `invalid`。不支持的版本返回 `version`；已过期的请求返回 `expired`。路由解析与执行仍会拒绝不存在的路由、禁止的 URL 和错误的所属窗口，并再次检查有效期。目标中不应包含凭据或提供方的私有元数据。

只处理用户明确执行的打开操作；收到通知、后台更新或关闭通知都不应触发导航。原生完成回调应独立于登录和挂载等待及时结束。此 helper 不安装 delegate、SDK、权限提示或后台接收器。提供方响应处理仍由应用负责；[Apple 的通知响应指南](https://developer.apple.com/documentation/usernotifications/handling-notifications-and-notification-related-actions) 描述了测试应用使用的原生回调。

提交前，应用必须通过自己的策略将响应绑定到预期账户。来源标签或路由并不能证明来源、接收者或访问权限。不要从不可信负载复制 `delivery`、`target` 或 `options`：负载中的这些字段会被拒绝。为预期账户/会话使用稳定 scope，为一次打开操作分配一个 id，并在该操作的重复回调中复用它。一个消息 id 可能对应多次有意点击；每次回调生成新 id 则无法去重。如果提供方不能区分点击，应在其适配器中明确制定策略。helper 本身不占用 id；接收 router 的 `openIntent` 或 `suspendIntent` 会在有界内存记录中保留它。

登录使用上文相同的 `suspendIntent` 流程。应用终止后的通知投递会等待挂载和历史恢复；这不代表待处理登录能够跨进程保存。复用、聚焦或新建窗口仍由应用明确选择。[原生测试及限制](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-notification-intents-stage3.md) 覆盖应用运行和终止时的真实 iOS 本地通知点击、登录后恢复、重复响应处理及被拒绝的目标。远程推送服务、Android 原生通知投递和 Spotlight 不属于本阶段。

<Clip name="notification-intents" :width="640" aspect="3 / 4" caption="真实 iPad 模拟器：应用运行或终止时打开 iOS 通知，登录后恢复导航，拒绝无效或过期目标，并保留独立草稿。使用本地通知和受控认证状态；界面为英文。" />

## 主屏幕快捷方式 {#home-screen-shortcuts}

<Clip name="ios-shortcuts" caption="长按演示图标并选择新消息以通过原生快速操作打开其路线。 iOS 26模拟器。" />

在视频中，在离开应用程序之前已选择收件箱。在 iOS 演示中，从“设置”切换到“收件箱拆分”时从快捷方式打开“撰写”可能会被原生演示者拒绝。首选用于交叉表条目的页面目标；该剪辑演示了相同选项卡模式。

在应用程序打开之前可以提供相同的目的地：Android 动态快捷方式和 iOS 快速操作，均通过一次调用：

```ts
router.setShortcuts([
  {
    id: 'compose',
    title: 'New message',
    to: '/compose',
    icon: { android: 'ic_compose', ios: 'square.and.pencil' },
  },
  { id: 'account', title: 'Account', to: { name: 'account' } },
])
```

每个快捷方式都带有版本化的有效负载。版本 2 保留了字符串路由 `name`、参数、查询和哈希；更改路径同时保留其名称可以使现有快捷方式保持有效。将路线名称也视为稳定的标识符；如果名称更改，请保留旧名称下的重定向或重新发布受影响的快捷方式。未命名的目的地保留其路径。版本 1 路径有效负载仍然可读。删除目的地会产生 `unmatched`；不支持的有效负载版本会产生 `malformed`。激活使用与 `push` 相同的 导航守卫 和重复导航行为，包括旧的固定快捷方式。 `link.shortcut` 字段标识快捷方式。

当应用程序数据发生变化时，再次调用`setShortcuts`。 `setShortcuts([])` 删除了 Android 上的动态快捷方式并禁用过时的路由器拥有的固定副本，并删除了 iOS 快速操作。 Android 拥有固定图标，因此路由器无法从用户的启动器中删除它们。静态清单快捷方式无法通过这种方式禁用：将它们保留为公共入口点并在 导航守卫 中强制执行身份验证。 Android的静态和动态快捷键共享其原生配额； iOS 有四个快速操作插槽。额外的动态项目被省略并带有开发警告。被拒绝的 Android 更新会抛出异常，而不是报告未发布的 id。

`supportsShortcuts()` 检查一般可用性。请求固定 Android：

```ts
import { supportsPinnedShortcuts } from 'vue-router-ns'

if (supportsPinnedShortcuts()) {
  const requested = router.pinShortcut({
    id: 'account',
    title: 'My account',
    to: { name: 'account' },
    icon: { android: 'ic_account' },
  })
  // requested means the launcher accepted the request; the user still chooses.
}
```

### 静态 Android 快捷键 {#static-android-shortcuts}

静态条目是应用程序资源，经过审核并随应用程序一起提供。使用 `router.shortcutURL('account', { name: 'account' })` 生成 URL，并将输出复制到 XML，并将 `&` 转义为 `&amp;`。对于没有参数的命名路由，有效负载可以是：

```xml
<!-- App_Resources/Android/src/main/res/xml/shortcuts.xml -->
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut android:shortcutId="static-account"
    android:enabled="true"
    android:shortcutShortLabel="@string/shortcut_account"
    android:icon="@drawable/ic_account">
    <intent android:action="android.intent.action.VIEW"
      android:targetPackage="com.example.app"
      android:targetClass="org.nativescript.router.ShortcutEntryActivity"
      android:data="vue-router-ns://shortcut/static-account?to=%7B%22name%22%3A%22account%22%7D&amp;v=2" />
  </shortcut>
</shortcuts>
```

在 `res/values/strings.xml` 中定义标签，并将此元数据放入 `AndroidManifest.xml` 中的启动器活动中：

```xml
<meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts" />
```

Android 强制 `NEW_TASK | CLEAR_TASK` 使用静态快捷方式。要保留正在运行的应用程序，请将 [entry Activity example](https://github.com/rafaelaugustos/vue-router-ns/blob/main/examples/shortcuts/Android/src/main/java/org/nativescript/router/ShortcutEntryActivity.java) 复制到 `App_Resources/Android/src/main/java/org/nativescript/router/ShortcutEntryActivity.java` 并将其注册到主活动之外：

```xml
<activity android:name="org.nativescript.router.ShortcutEntryActivity"
  android:exported="true" android:taskAffinity=""
  android:excludeFromRecents="true" android:theme="@android:style/Theme.NoDisplay" />
```

临时活动在使用 `SINGLE_TOP | CLEAR_TOP | NEW_TASK` 将有效负载转发到 `com.tns.NativeScriptActivity` 之前退出其窗口。如果您的应用程序使用自定义 Activity，请调整该 Java 目标。这是明确的应用程序拥有的原生集成；该包不会重写资源。请参阅 [Android 的快捷任务行为](https://developer.android.com/develop/ui/compose/system/shortcuts/managing-shortcuts)。

使用应用程序的实际包/活动和资源名称。静态 ID 必须与动态 ID 不同。内部`vue-router-ns`方案使用显式意图目标；不要将其注册为公共深度链接方案。请参阅 [Android 的快捷方式资源和固定要求](https://developer.android.com/develop/ui/compose/system/shortcuts/creating-shortcuts)。

### 可选系统搜索 {#optional-system-search}

实验性 `vue-router-ns/system-search` 入口点仅使用 Core Spotlight 明确选择的内容进行索引。它通过 `links.activity` 消耗生成的 `NSUserActivity`，因此窗口选择、导航守卫 和原生导航保持不变：

```ts
import { createSystemSearch } from 'vue-router-ns/system-search'

const search = createSystemSearch({
  domain: 'com.example.app.public-guides',
  resolve(id) {
    const guide = publicGuides.get(id)
    return guide ? router.resolve({ name: 'guide', params: { id } }).fullPath : null
  },
})
const router = createRouter({ routes, links: { activity: search.url } })

if (search.supported) {
  await search.index([
    { id: 'getting-started', title: 'Getting started', keywords: ['help'] },
  ])
}
await search.remove(['getting-started']) // deleted content
await search.remove() // sign-out: remove this domain's index
```

原生标识符包含有效负载版本、域和内容ID。它不包含路由参数。 `resolve` 将稳定的 id 映射到今天的目的地；对于已删除或无法访问的项目，请返回 `null`。索引操作在不可用时解析为 `false` 并拒绝原生错误。原生可用性并不保证 Spotlight 会显示项目或对项目进行排名。 `description`、`keywords` 和 `expiresAt` 是可选元数据。请参阅 [Apple 的 Core Spotlight 索引指南](https://developer.apple.com/documentation/CoreSpotlight/adding-your-app-s-content-to-spotlight-indexes)。

选择公共标签和不透明 ID。快捷方式有效负载、索引标题和描述可能会在会话结束后持续存在并出现在系统表面上：切勿将凭据或机密放入其中。注销时删除帐户特定条目，即使删除后仍保留 导航守卫。该模块不会自动索引路线、向 Siri 捐赠活动或提供小部件/应用程序意图；这些需要单独的应用程序拥有的集成。

### 接收窗口并选择策略 {#receiving-windows-and-choosing-a-policy}

默认情况下，系统事件转到主窗口的路由器。使用 NativeScript 的窗口 API，传递 `links.window` 即可仅接收该 Activity 或场景的事件。 `links.initial` 接受 `WindowContentRequest` 的链路承载字段：通常在 **Core 发出初始原生事件之后创建辅助路由器**，因此它需要显式切换。

```ts
Application.setWindowContentResolver((request) => {
  if (request.window.rootView) return request.window.rootView
  if (request.isPrimary) return undefined // the primary app starts normally
  const router = createRouter({
    routes,
    links: { window: request.window, initial: request, schemes: ['myapp', 'https'] },
  })
  const app = createApp({ render: () => h(RouterView) }).use(router)
  return app.mount().$el.nativeView
})
```

温暖的场景URL、用户活动和快速动作留在该场景中； Android 新意图保留在其接收活动中。卸载应用程序会分离其接收器。如果应用程序稍后分配窗口，则 `window` 选项也可以是 getter。它限制传入事件的范围；窗口拆卸、活动重新创建和保存窗口状态仍然是应用程序的生命周期职责。

默认策略**重用OS**选择的窗口；接收链接不会聚焦到另一个窗口或创建一个窗口。对于通知，应用程序可以选择现有会话，聚焦其原生场景/任务，然后调用该会话的 `router.openLink`。创建窗口，调用`Application.openWindow({ data: { href } })`；在内容解析器中，在挂载之前将 `request.data.href` 交给新路由器的 `openLink`。请勿同时经过与初始路线相同的目的地。 `openLink` 等待挂载。选择目标显式地将通知和文档窗口策略保留在应用程序中，而不是从当前聚焦的全局 Frame 中进行猜测。创建多个 Activity 的 Android 应用程序需要兼容的启动模式（例如 `standard`）以及有意任务重用/新任务的显式标志；下面的普通单窗口示例使用 `singleTask`。

### 平台设置 {#platform-setup}

路由器读取平台下发的内容；注册它是应用程序的。该包无法验证域所有权或发布关联文件。

Android，在`App_Resources/Android/src/main/AndroidManifest.xml`，活动里面。 NativeScript 模板的 `singleTask` 启动模式使正在运行的应用程序的链接作为新意图到达，路由器无需第二个活动即可获取该意图：

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="example.com" />
</intent-filter>
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="myapp" />
</intent-filter>
```

应用程序链接需要 `https://example.com/.well-known/assetlinks.json` 列出应用程序的包和签名证书指纹；用`adb shell pm get-app-links <package>`检查一下。

iOS，在 `App_Resources/iOS/Info.plist` 中用于自定义方案，以及 `App_Resources/iOS/app.entitlements` 中关联域下的 `applinks:example.com` 条目用于通用链接，由 `https://example.com/.well-known/apple-app-site-association` 提供服务：

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array><string>myapp</string></array>
  </dict>
</array>
```

测试与 `adb shell am start -a android.intent.action.VIEW -d "myapp://messages/42"` 和 `xcrun simctl openurl booted "myapp://messages/42"` 的链接。独立的原生窗口被单独跟踪；链路到达接收它的路由器。

### 检查域关联 {#checking-domain-association}

对于生产 HTTPS 链接，请验证原生注册和服务器文件。将调试和发布包/证书身份分开。

`https://example.com/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.example.app",
      "sha256_cert_fingerprints": ["YOUR:RELEASE:CERTIFICATE:SHA256"]
    }
  }
]
```

`https://example.com/.well-known/apple-app-site-association`（无文件扩展名）：

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["TEAMID.com.example.app"],
        "components": [{ "/": "/messages/*" }]
      }
    ]
  }
}
```

将 `com.apple.developer.associated-domains` 和 `applinks:example.com` 添加到签名应用程序的权利中。通过 HTTPS 提供有效的 JSON，无需重定向。确认主机、捆绑包/包 ID、证书/团队 ID 和路径与您安装的内容匹配。使用 `adb shell pm verify-app-links --re-verify com.example.app`，检查 `adb shell pm get-app-links com.example.app`，然后在没有显式组件 **的情况下打开 HTTPS URL**。在 iOS 上，安装正确签名的应用程序并打开另一个应用程序的链接，测试冷应用程序和正在运行的应用程序。自定义方案测试或 Android 意图与 `-n` 证明路由器交付，而不是网站关联。按照 [Android 的验证程序](https://developer.android.com/training/app-links/verify-android-applinks) 和 [Apple 的通用链接设置](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app) 进行平台诊断。路由器的白名单是操作系统交付后的额外检查，而不是域所有权的证明。
