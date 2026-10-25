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
