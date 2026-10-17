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
      tabView.selectedIndex = settings ? 1 : 0 // select the tab before the navigation
      return settings ? 'settings' : 'inbox'
    },
  },
})
```

`links: true` takes every URL as a path. Each URL becomes an `IncomingLink`: a lower-case `scheme`, a `host` for `http` and `https` (for a custom scheme such as `myapp://messages/42`, everything after `://` is the path), the `path`, the parsed `query`, the `hash` and where it came from: `'launch'`, `'resume'` or `'app'`. The matcher decodes params the way it does for `push`. Without `map`, the link's path, query and hash are the location; a URL that matches no route is ignored, unless a catch-all route takes it. Return `null` from `map` to ignore a link yourself.

A link lands the way `push(path, { withParents: true })` does, through the guards, so an authenticated route still sends it to the login. Set `options` to change that for every link, or per link with a function. On a cold start the link waits for the first page, and when `restore` rebuilt a stack it lands on top of it: saved history first, then the link. With `frame`, it waits for that `<RouterView>` to show its first page, up to ten seconds; select the tab inside `frame` so an unloaded tab appears before the navigation.

The platform can hand over the same URL twice for one tap, in the launch options and again on resume. A second system delivery of the same URL within 1.5 seconds is dropped; a later one, or any call from your own code, is taken. A page already on top turns the repeat into a `duplicated` failure, like `push` would.

### Notifications, widgets and links of your own

`openLink` is the same door for anything else that points at a destination:

```ts
const result = await router.openLink(notification.data.url)
result.location // where it pointed, when it matched a route
result.failure // what a guard said, when it stopped it
result.ignored // 'scheme', 'host', 'unmatched', 'malformed' or 'repeat'
```

`resolveLink(url)` tells where a URL would go without going there, and `onLink` hears every link the router was handed, taken or not. To resume a link after a login, do what the demo does: the guard redirects to the login with `query.next`, and the login page replaces itself with it. `onLink` works too: keep `result.location` when `failure` or the current route says a login got in the way, and `push` it after signing in.

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
