# Deep links

Routes are paths, so wherever your app receives a link (a URL handler, a notification payload), hand the path to the router:

<Clip name="ios-deep-link" caption="The system delivers vuerouterns://settings/account. Settings is selected and its guard opens login. iOS 26 simulator." />

```ts
router.push('/messages/42')
```

That's safe on a cold start: a navigation requested before the first page is up waits for it and stacks on top, so back still lands on your home page.

## Bringing the parents along

A link into a nested page can bring its parents along, so back walks up the app's hierarchy instead of jumping home:

```ts
router.push('/settings/account', { withParents: true })
// stack: / → /settings → /settings/account
```

The parents come from `children` nesting in the route table, and only those with a component become pages:

```ts
{
  path: '/settings',
  component: Settings,
  children: [{ path: 'account', name: 'account', component: Account }],
}
```

Parents already on top are skipped, only the last page animates, and guards run for every page. With `clearHistory`, the parents and the page become the whole stack. `<RouterLink>` takes `withParents` too.

## Receiving operating-system URLs

Opt in with `links`, and the router takes the URLs the platform hands the app, next to whatever handlers the app already has: Android launch and new intents, iOS `openURL`, Universal Link activities and scene connections.

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

`links: true` takes every URL as a path. Each URL becomes an `IncomingLink`: a lower-case `scheme`, a `host` for `http` and `https` (for a custom scheme such as `myapp://messages/42`, everything after `://` is the path), the `path`, the parsed `query`, the `hash` and where it came from: `'launch'`, `'resume'` or `'app'`. The matcher decodes params the way it does for `push`. Without `map`, the link's path, query and hash are the location; a URL that matches no route is ignored, unless a catch-all route takes it. Return `null` from `map` to ignore a link yourself. Broken percent escapes/UTF-8, missing web hosts, credentials, whitespace and protocol-relative URLs are `malformed`. Params are decoded once; query `+` is a space, repeated keys are arrays and a key without `=` is `null`. Query values are untrusted strings: validate application-specific formats in `map`; returning `null` or throwing rejects the destination as `unmatched`.

A link lands the way `push(path, { withParents: true })` does, through the guards, so an authenticated route still sends it to the login. Set `options` to change that for every link, or per link with a function. On a cold start the link waits for the first page, and when `restore` rebuilt a stack it lands on top of it: saved history first, then the link. With `frame`, it waits for that `<RouterView>` to show its first page, up to ten seconds. [`RouterTabs`](./tabs) selects the target tab automatically. With a plain `TabView`, set its `selectedIndex` inside `frame` so an unloaded tab appears before the navigation.

The platform can hand over the same URL on launch and again on resume. That matching launch/resume pair is deduplicated within 1.5 seconds. Two warm deliveries are separate taps, even close together. A page already on top produces a `duplicated` navigation failure, like `push` would. Notification providers can supply `deliveryId` to deduplicate the same event even when other links arrive between its callbacks; use a new id for each intentional user tap. The router retains the latest 256 ids in memory for its lifetime.

### Notifications, widgets and links of your own

`openLink` is the same door for anything else that points at a destination:

```ts
const result = await router.openLink(notification.data.url, {
  deliveryId: notification.eventId, // optional, one id per user action
})
result.location // where it pointed, when it matched a route
result.failure // what a guard said, when it stopped it
result.ignored // 'scheme', 'host', 'unmatched', 'malformed' or 'repeat'
```

`resolveLink(url)` tells where a URL would go without going there, and `onLink` hears every link the router was handed, taken or not. To resume a link after a login, do what the demo does: the guard redirects to the login with `query.next`, and the login page replaces itself with it. `onLink` works too: keep `result.location` when `failure` or the current route says a login got in the way, and `push` it after signing in.

## Navigation intents (experimental) {#navigation-intents}

Use a versioned `NavigationIntent` when different application entrypoints need a shared destination request. `resolveIntent` validates and resolves without navigation, guards, component loading or tab selection. `openIntent` validates again and enters the same readiness and guarded execution used by existing links. Mapping and route-redirect callbacks should be pure.

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

The `destination` is either `{ route: ... }` or `{ url: 'myapp://messages/42' }`. A route uses an absolute path or a string name with serializable params, query and hash. A URL uses the existing scheme/host screening and mapping; its link source is `'app'`. The intent's `source` is an application-defined label, not proof of origin or permission. Notification provider callbacks, search and drag/drop adapters remain application-owned; the notification payload helper below validates destination data.

Only plain JSON data is accepted: no native/Vue objects, functions, accessors, symbols or unknown fields. Requests are copied and recursively frozen. Limits are 16 KiB of compact UTF-8 JSON, 8,192 characters per string, 32 object fields, 64 array items, depth 7 and 1,024 values. Source labels allow 128 characters; delivery and target identifiers allow 256. Parse external JSON and validate its application-specific content before handing it to the router. Shape validation never authorizes access; normal guards still enforce permissions.

The receiving router owns execution. `target.windowId` asserts that owner's identity; it never searches for or opens another window. `target.frame` chooses its named stack. Without it, URL requests use the existing link frame policy, then the default stack; route requests use the default stack. No global current Frame selects the owner. `options` accepts `replace`, `withParents` and `clearHistory`; parent history defaults to enabled. URL policy options apply first, with explicit intent options overriding them. Resolution does not invoke frame or options callbacks.

Readiness and restored history precede navigation; an absent named stack has the existing ten-second mount deadline. Requests retain normal overlapping-navigation cancellation, not a FIFO queue. `expiresAt` is checked on receipt and again after readiness/stack waits, immediately before admission; it does not cancel navigation already inside guards. Removed routes and owner closure are rechecked after waits. Execution errors still reject the promise.

A `delivery` pair uses `scope` and `id` across source labels within one router lifetime. Use an app-owned account/session scope and a fresh id for each intentional action, or omit the pair. Up to 256 in-flight requests are retained; another returns `busy`. The latest 256 settled delivery ids remain in memory, including attempts refused by guards or invalidated during a wait. A repeat returns `repeat`; this is bounded deduplication, not durable exactly-once delivery. Existing link delivery ids keep their separate compatibility namespace. Intent calls do not emit `onLink`; existing links retain their listeners and launch/resume deduplication.

A preview returns `resolved` or `ignored`. Execution returns `handled` with the requested `location` and optional `failure`, or `ignored` with `reason`. Handled means the normal pipeline settled: guards may redirect, abort or cancel, and the requested page may never appear. Ignored reasons include `invalid`, `version`, `expired`, `unmatched`, `scheme`, `host`, `repeat`, `busy`, `wrong-window`, `owner-closed` and `target-unavailable`. Payloads and delivery identifiers are not added to diagnostics.

Requests are not persisted and do not select new windows. Explicit in-memory login resumption is described below; authentication remains app-owned. The [native fixture](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/intents) checks real Frames, guards and OS URL delivery; its [acceptance report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-navigation-intents-stage1.md) separates native evidence from unit coverage.

<Clip name="navigation-intents" :width="640" aspect="3 / 4" caption="Real iPad simulator: preview without navigation, named/URL destinations, duplicate and guard outcomes, modal disposal and OS URL delivery. App labels are in English." />

## Resume after login (experimental) {#resume-after-login}

Use `suspendIntent(request, policy)` before presenting app-owned login, or after an existing link guard redirects there. It returns `suspended` with a handle, or `ignored`. Suspension resolves and copies the request but does not navigate, run guards, allocate a Page or detect authentication. The app decides when to show, replace or close login.

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

After the real provider succeeds, update the app's authentication state and call `resume()`. Do not set the example's boolean from an untrusted payload. `scope()` must return the same stable object across the intended login; replace it on sign-out, another account or a new authentication flow. `authorize(location, intent)` must synchronously return true only while that destination remains permitted. Both callbacks must be pure; async/throwing permission checks fail closed. Session identity and callbacks stay in memory and are never serialized into the request.

Each router retains one pending authentication flow. A valid new suspension or accepted `openIntent` supersedes it; malformed or duplicate deliveries do not. The delivery identity remains reserved through login and resume, so a repeated callback cannot create another attempt. Once authorized, every `resume()` call returns the same promise, even after settlement or rejection. Calling before authorization returns `unauthorized` and keeps the request pending. `cancel()` prevents later admission; call it when login is cancelled or the session changes. Normal navigation to login does not automatically cancel the pending flow.

The readonly `state` ref reports `pending`, `resuming`, `settled` or `cancelled`, with an optional `reason`. Scope changes return `scope-changed`; a newer intent returns `superseded`; explicit cancellation returns `cancelled`. `maxAge` is a positive integer up to 300,000 milliseconds, defaulting to five minutes; an earlier request expiry wins. A timer releases expired pending work. Expiry, removed routes, owner closure and permission are checked again during resume. Unlike ordinary intent admission, resumed permission/expiry checks also survive async guards, component loading and guard redirects, including the redirected destination.

Normal guards and failures still apply. If invalidated during a guard, navigation reports its usual cancelled failure. Already committed parent pages and native transitions that have started are not rolled back; cancellation blocks remaining admission. A suspended handle is not a durable exactly-once delivery guarantee. It is an idempotent attempt in this router lifetime. There is no request persistence, automatic provider integration or inferred account identity.

Pass `options: { replace: true }` in the request if the destination should replace login, and target the same named stack explicitly. The app owns permission checks, login-route policy and protected-history cleanup on sign-out. Legacy `openLink` and its listeners remain available; a listener can retain the original URL after a guard redirects to login. The [native acceptance](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-intent-resume-stage2.md) demonstrates that composition.

<Clip name="intent-resume" :width="640" aspect="3 / 4" caption="Real iPad simulator: an OS URL opens app-owned login, sign-in resumes once, and cancellation, account change, expiry and sign-out during a guard prevent stale navigation. Authentication is controlled fixture state, without an external provider; labels are in English." />

## Notification destinations {#notification-destinations}

`notificationIntent(payload, context)` converts a notification's app-defined JSON destination into a frozen `NavigationIntent` with `source: 'notification'`. It neither resolves nor navigates. The payload accepts only `version: 1`, `destination` (route or URL) and optional `expiresAt`; the app supplies delivery identity, target and navigation options separately.

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

The example's `session`, `response` and `showIgnored` belong to your app. Extract only your reviewed destination field from the provider envelope; convert native dictionaries to plain JSON data and bound text before parsing. Unknown fields, getters, functions, malformed routes and requests exceeding the intent limits (including 16 KiB for the final envelope) return `invalid`. Unsupported versions return `version`; elapsed deadlines return `expired`. Resolution and execution still reject unavailable routes, disallowed URLs and wrong owners, and recheck expiry. Keep credentials and private provider metadata out of destinations.

Only handle an explicit user open action: receiving a notification, a background update or a dismissal must not navigate. Keep OS completion handlers independent of login/readiness waits. The helper installs no notification delegate, SDK, permission prompt or background receiver. Your provider's response handling remains app-owned; [Apple's notification response guidance](https://developer.apple.com/documentation/usernotifications/handling-notifications-and-notification-related-actions) describes the native callback used by the fixture.

Bind the response to the intended account in application policy before submitting it. Neither a source label nor a supplied route proves origin, recipient or permission. Never copy `delivery`, `target` or `options` from untrusted payloads: those fields in the payload are rejected. Use a stable scope for the intended account/session and an id for one open action, reused across callbacks for that action. A message id alone may identify several intentional taps; a fresh id on every callback defeats deduplication. If a provider cannot distinguish taps, define that policy explicitly in its adapter. The helper does not consume ids; `openIntent` or `suspendIntent` reserves them in the receiving router's bounded in-memory ledger.

Login uses the same `suspendIntent` flow above. Cold delivery waits for mounting and restored history; this does not persist a pending login across process death. Reuse/focus/new-window selection remains explicit app policy. The [native fixture and limits](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-notification-intents-stage3.md) cover real iOS local notification taps with warm and terminated apps, login resumption, duplicate response processing and rejected destinations. Remote push providers, Android notification delivery and Spotlight are outside this stage.

<Clip name="notification-intents" :width="640" aspect="3 / 4" caption="Real iPad simulator: open iOS notifications with the app running or terminated, resume after app-owned login, reject invalid/expired destinations and preserve an independent draft. Local notifications and controlled authentication; labels in English." />

## Home-screen shortcuts

<Clip name="ios-shortcuts" caption="Long-press the demo icon and choose New message to open its route through a native quick action. iOS 26 simulator." />

In the video, Inbox is already selected before leaving the app. In the iOS demo, opening Compose from its shortcut while switching from Settings to the inbox split can be refused by the native presenter. Prefer a page destination for cross-tab entry; this clip demonstrates the same-tab modal.

The same destinations can be offered before the app opens: Android dynamic shortcuts and iOS quick actions, both from one call:

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

Each shortcut carries a versioned payload. Version 2 preserves a string route `name`, params, query and hash; changing a path while keeping its name keeps existing shortcuts working. Treat route names as stable identifiers too; if a name changes, keep a redirect under its old name or republish the affected shortcuts. Unnamed destinations retain their path. Version 1 path payloads remain readable. Deleting a destination yields `unmatched`; unsupported payload versions yield `malformed`. Activation uses the same guards and duplicated-navigation behavior as `push`, including for an old pinned shortcut. The `link.shortcut` field identifies the shortcut.

Call `setShortcuts` again when app data changes. `setShortcuts([])` removes dynamic shortcuts and disables obsolete router-owned pinned copies on Android, and removes iOS quick actions. Android owns the pinned icons, so the router cannot delete them from the user's launcher. Static manifest shortcuts cannot be disabled this way: keep them public entry points and enforce authentication in guards. Android's static and dynamic shortcuts share its native quota; iOS has four quick-action slots. Extra dynamic items are omitted with a development warning. A rejected Android update throws rather than reporting ids that were not published.

`supportsShortcuts()` checks general availability. To request pinning on Android:

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

### Static Android shortcuts

Static entries are app resources, reviewed and shipped with the app. Generate their URL with `router.shortcutURL('account', { name: 'account' })` and copy the output into the XML with `&` escaped as `&amp;`. For a named route without params the payload can be:

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

Define the label in `res/values/strings.xml` and put this metadata inside the launcher activity in `AndroidManifest.xml`:

```xml
<meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts" />
```

Android forces `NEW_TASK | CLEAR_TASK` on static shortcuts. To preserve a running app, copy the [entry Activity example](https://github.com/rafaelaugustos/vue-router-ns/blob/main/examples/shortcuts/Android/src/main/java/org/nativescript/router/ShortcutEntryActivity.java) into `App_Resources/Android/src/main/java/org/nativescript/router/ShortcutEntryActivity.java` and register it outside the main activity:

```xml
<activity android:name="org.nativescript.router.ShortcutEntryActivity"
  android:exported="true" android:taskAffinity=""
  android:excludeFromRecents="true" android:theme="@android:style/Theme.NoDisplay" />
```

The temporary Activity retires its window before forwarding the payload to `com.tns.NativeScriptActivity` with `SINGLE_TOP | CLEAR_TOP | NEW_TASK`. Adjust that Java target if your app uses a custom Activity. This is explicit app-owned native integration; the package does not rewrite resources. See [Android's shortcut task behavior](https://developer.android.com/develop/ui/compose/system/shortcuts/managing-shortcuts).

Use the app's actual package/activity and resource names. Static ids must differ from dynamic ids. The internal `vue-router-ns` scheme uses an explicit intent target; do not register it as a public deep-link scheme. See [Android's shortcut resource and pinning requirements](https://developer.android.com/develop/ui/compose/system/shortcuts/creating-shortcuts).

### Optional system search

The experimental `vue-router-ns/system-search` entry point indexes only explicitly selected content using Core Spotlight. It consumes the resulting `NSUserActivity` through `links.activity`, so window selection, guards and native navigation remain the same:

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

The native identifier contains a payload version, domain and content id. It contains no route params. `resolve` maps a stable id to today's destination; return `null` for a removed or inaccessible item. Index operations resolve to `false` when unavailable and reject native errors. Native availability does not guarantee Spotlight will display or rank an item. `description`, `keywords` and `expiresAt` are optional metadata. See [Apple's Core Spotlight indexing guidance](https://developer.apple.com/documentation/CoreSpotlight/adding-your-app-s-content-to-spotlight-indexes).

Choose public labels and opaque ids. Shortcut payloads, indexed titles and descriptions can outlive a session and appear on system surfaces: never put credentials or secrets in them. Remove account-specific entries on sign-out and keep guards even after removal. This module does not automatically index routes, donate activities to Siri, or provide widgets/App Intents; those require a separate app-owned integration.

### Receiving windows and choosing a policy

By default, system events go to the primary window's router. With NativeScript's window API, pass `links.window` to receive events only for that Activity or scene. `links.initial` accepts the link-bearing fields of a `WindowContentRequest`: a secondary router is usually created **after** Core emits the initial native event, so it needs that explicit handoff.

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

Warm scene URLs, user activities and quick actions stay in that scene; Android new intents stay in their receiving Activity. Unmounting an app detaches its receiver. The `window` option can also be a getter if the app assigns the window later. It scopes incoming events; window teardown, Activity recreation and saved window state remain the application's lifecycle responsibilities.

The default policy **reuses the window chosen by the OS**; receiving a link does not focus a different window or create one. For notifications, an app can select an existing session, focus its native scene/task, then call that session's `router.openLink`. To create a window, call `Application.openWindow({ data: { href } })`; in the content resolver, hand `request.data.href` to the new router's `openLink` before mounting. Do not also pass that same destination as an initial route. `openLink` waits for the mount. Choosing the target explicitly keeps notification and document-window policies in the app instead of guessing from the currently focused global Frame. Android apps that create multiple Activities need a compatible launch mode, such as `standard`, and explicit flags for intentional task reuse/new tasks; the ordinary single-window example below uses `singleTask`.

For an executable reuse/focus/new-window recipe with explicit restored-history choices, see [intent window policy](./windows#intent-window-policy).

### Platform setup

The router reads what the platform delivers; registering for it is the app's. The package cannot verify domain ownership or publish association files.

Android, in `App_Resources/Android/src/main/AndroidManifest.xml`, inside the activity. The NativeScript template's `singleTask` launch mode makes a link to a running app arrive as a new intent, which the router takes without a second activity:

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

App Links need `https://example.com/.well-known/assetlinks.json` listing the app's package and signing certificate fingerprints; check it with `adb shell pm get-app-links <package>`.

iOS, in `App_Resources/iOS/Info.plist` for a custom scheme, and an `applinks:example.com` entry under Associated Domains in `App_Resources/iOS/app.entitlements` for Universal Links, served by `https://example.com/.well-known/apple-app-site-association`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array><string>myapp</string></array>
  </dict>
</array>
```

Test a link with `adb shell am start -a android.intent.action.VIEW -d "myapp://messages/42"` and `xcrun simctl openurl booted "myapp://messages/42"`. Independent native windows are tracked separately; a link lands in the router that receives it.

### Checking domain association

For production HTTPS links, verify both native registration and the server files. Keep debug and release package/certificate identities separate.

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

`https://example.com/.well-known/apple-app-site-association` (no filename extension):

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

Add `com.apple.developer.associated-domains` with `applinks:example.com` to the signed app's entitlements. Serve valid JSON over HTTPS without redirects. Confirm the host, bundle/package id, certificate/team id and path match what you installed. Use `adb shell pm verify-app-links --re-verify com.example.app`, inspect `adb shell pm get-app-links com.example.app`, then open an HTTPS URL **without an explicit component**. On iOS, install the correctly signed app and open the link from another app, testing a cold and a running app. A custom-scheme test or an Android intent with `-n` proves router delivery, not website association. Follow [Android's verification procedure](https://developer.android.com/training/app-links/verify-android-applinks) and [Apple's Universal Links setup](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app) for platform diagnostics. The router's allowlist is an additional check after OS delivery, not proof of domain ownership.

## Native scene intents {#native-scene-intents}

The [application recipe](https://github.com/rafaelaugustos/vue-router-ns/tree/main/examples/intent-entrypoints) receives real iOS quick actions, Spotlight activities and scene URLs as versioned intents. It is copyable app code using NativeScript Core 9.1.4 scene events, not a new package API. Configure participating routers with `links: { system: false }` while retaining their URL allowlists/mapping, then install the adapter once before starting the app. The application supplies the explicit window/account registry, public search adapter, action ids and receipt handler below.

```ts
// Copy examples/intent-entrypoints/ios.ts into your application.
import { installSceneIntentIngress } from './ios'

const stop = installSceneIntentIngress({
  owner: (windowId) => accountOwners.get(windowId),
  activity: publicSearch.url,
  nextId: () => createActionId(),
  receive: handleEntryIntent,
  error: reportIngressError,
})

// Before disposing the account/window registry:
stop()
```

Core 9.1.4 forwards cold connection payloads through the same scene events as warm delivery. Also reading `sceneWillConnect`, process-wide delegate forwarding or automatic system links would process the action again. The native window id selects the registered owner and is asserted in the resulting intent; no global focus fallback is used. The queue holds at most 16 receipts with a 15-second readiness deadline. Account replacement, closed owners and disposal invalidate pending handoffs. Quick-action completion acknowledges enqueueing immediately, independently of mounting or login.

In `handleEntryIntent`, inspect ignored outcomes, revalidate the request with `resolveIntent`, then use `openIntent` or the explicit `suspendIntent` login flow. The app owns login presentation, frame mounting and authorization. This recipe sets `replace: true` so resuming replaces the login Page; choose your history policy deliberately. Native payloads supply destinations, never account/window/history authority. Stop ingress and clean pending login handles when replacing an account; already-running application callbacks are not rolled back.

A content or shortcut id identifies a destination, not a user action. Generate a new delivery id for each intentional native tap; replaying the same captured intent returns `repeat`. This is not a guarantee against arbitrary OS duplicate callbacks assigned new ids. Named shortcuts survive path changes; removed routes and content ids yield `unmatched`. Index only selected public metadata with `createSystemSearch`, and return `null` for stale or unauthorized content. Native indexing success does not guarantee search ranking.

The [native report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-scene-intents-stage5.md) includes actual SpringBoard actions, native Spotlight result taps, terminated-process delivery, login/resume, intentional repeat, stale destinations and a real custom-scheme URL. Internal and notification comparisons are app controls; native notifications were validated in the preceding stage. The fixture preserves an independent Page/draft within each process. It does not persist login or drafts across processes and does not certify Android, physical devices or a full multi-window lifecycle.

<Clip name="scene-intents" :width="640" aspect="3 / 4" caption="Real iPad simulator: tap native quick actions and Spotlight results, resume after sign-in with warm and terminated apps, reject stale destinations and preserve an independent draft within each process. Controlled authentication; labels are in English." />

## Native Android intents {#native-android-intents}

The [Android application recipe](https://github.com/rafaelaugustos/vue-router-ns/blob/main/examples/intent-entrypoints/android.md) adapts ACTION_VIEW URLs, launcher shortcuts and notification taps to the same versioned contract. Copy `android.ts`, disable automatic system links with `links: { system: false }`, retain URL allowlists and install the adapter once before `app.start()`. Supply the receiving window's stable account-owned `{ router, scope, frame }` registration and your existing receipt handler. This cold path uses the standard NativeScript-Vue launch bridge; custom window-content resolvers need their own integration.

```ts
import { installAndroidIntentIngress } from './android'

const stop = installAndroidIntentIngress({
  owner: (windowId) => accountOwners.get(windowId),
  notification: { action: 'com.example.OPEN_NOTIFICATION', extra: 'navigation' },
  nextId: () => createActionId(),
  receive: handleEntryIntent,
  error: reportIngressError,
})
```

Core 9.1.4 forwards a synthetic new-intent during Activity creation. The adapter carries that exact receiving window id into the synchronous launch event, consumes the cold request once, and handles warm actions through `activityNewIntent`. Saved-state recreation and history launches do not replay the old destination. It retains canonical request data while waiting for readiness, with at most 16 handoffs and a 15-second deadline. Changed account/registration, closure and disposal invalidate waiting work.

Notifications use the app's explicit open action and a bounded JSON extra containing only version, destination and optional expiry. The app supplies delivery identity, target and history policy; the payload cannot override them. Create an immutable activity PendingIntent and request notification permission on Android 13+. Choose task/Back behavior for your application; the fixture's single-task Activity is one explicit policy. Posting a notification alone never navigates. Follow [Android's permission guide](https://developer.android.com/develop/ui/compose/notifications/notification-permission).

In the receipt handler, inspect ignored outcomes, resolve again, then open or suspend for login. Mount the selected Frame, authorize current content and resume/cancel explicitly. This recipe uses replacement so resume removes login. A new native tap gets a new delivery id; replay of the same captured request returns `repeat`. Suspended requests and credentials are not persisted across process death.

The [Android report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-android-intents-stage6.md) covers real launcher/drawer taps, cold URL delivery, three processes, login/resume, rejected notifications and Recents. It also maps all #182 acceptance items to the six completed stages. This is emulator evidence with controlled authentication, not physical-device, push-provider or full multi-window certification.

<Clip name="android-intents" :width="360" aspect="9 / 20" caption="Android API 34 emulator: real launcher and notification taps, cold URL opening, sign-in/resume across three processes, explicit rejection and a retained draft. Controlled authentication; labels are in English." />
