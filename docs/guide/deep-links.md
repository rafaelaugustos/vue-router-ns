# Deep links

Routes are paths, so wherever your app receives a link (a URL handler, a notification payload), hand the path to the router:

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

## Home-screen shortcuts

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

Each shortcut carries a versioned payload. Version 2 preserves a string route `name`, params, query and hash; changing a path while keeping its name keeps existing shortcuts working. Treat route names as stable identifiers too; if a name changes, keep a redirect under its old name or republish the affected shortcuts. Unnamed destinations retain their path. Version 1 path payloads remain readable. Deleting a destination yields `unmatched`; unsupported payload versions yield `malformed`. Guards still run on every activation, including an old pinned shortcut. The `link.shortcut` field identifies the shortcut.

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
