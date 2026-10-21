# Navigation in multiple native windows

This feature is experimental and requires NativeScript core 9.1+ plus the platform's multi-window configuration. The existing router still works on older supported core versions in single-window mode.

Activity/scene reconnection currently requires the NativeScript-Vue fix in [PR #1178](https://github.com/nativescript-vue/nativescript-vue/pull/1178). The published 3.1.2 release can unmount retained page apps during native UI disposal. Two-window navigation works without that patch, but resumption after native surface recreation is not supported by this integration until the fix is available. OS-driven iOS scene reconnection remains pending native validation.

## One router per window

Each `NativeWindow` owns one router. Its named views, modal stack, navigation queue, guards and results are independent. Two windows can both have a view named `inbox`.

```ts
const router = createRouter({ routes, window: request.window })
```

The router can infer its window from the first mounted view's `getNativeWindow()`. Pass `window` when bootstrapping a secondary window so ownership and restoration are known before the first page loads. `router.window` is a readonly ref to that owner; it stays undefined in legacy mode. Binding another router to the same window, or mounting views from one router in different windows, is an error.

## Opening a route in a new window

```ts
router.openWindow(
  { name: 'message', params: { id: 42 } },
  { data: { documentId: 'message:42' } },
)
```

The location is resolved with the caller's route types and passed to `Application.openWindow()`. The source stack stays in place and its leave guards do not run. The new window's initial navigation runs its own guards. This is an OS request, not a Promise that confirms a new scene appeared; native configuration or the OS may deny it. Missing NativeWindow APIs throw an error.

The application supplies the new content through `Application.setWindowContentResolver`. `getWindowRoute(request.data)` reads the resolved path supplied by `openWindow`; the `__vueRouterNS` data key is reserved. Other data must be serializable by the platform.

```ts
import { Application } from '@nativescript/core'
import { createApp, h } from 'nativescript-vue'
import { createRouter, getWindowRoute, RouterView } from 'vue-router-ns'
import App from './App.vue'
import { routes } from './routes'

// Register this before starting the primary app. Return undefined to keep
// its usual root. Other application-owned window roles can be handled here too.
Application.setWindowContentResolver((request) => {
  if (request.window.rootView) return request.window.rootView
  const initial = getWindowRoute(request.data)
  if (request.isPrimary && !initial) return undefined

  const router = createRouter({ routes, window: request.window })
  const app = createApp({
    render: () => h(RouterView, { initial: initial ?? '/' }),
  }).use(router)
  const vm = app.mount()
  request.window.on('close', () => app.unmount())
  return vm.$el.nativeView
})

const router = createRouter({ routes })
createApp(App).use(router).start()
```

A secondary root is mounted and returned to its window; it does not call `start()` again. NativeScript-Vue's navigated-page apps inherit the primary app's context, while the router wrapper supplies each page's window-bound router and route. Share application services from the primary app; independent per-window plugin/provide contexts are not automatically propagated to navigated pages.

This resolver is app-owned. Compose it with existing window handling instead of silently replacing another plugin's resolver. Initial URL/notification delivery remains application integration work; see [deep links](./deep-links).

## Native configuration

On Android, the launch Activity must support multiple instances: the usual template's `singleTask`/`singleInstance` modes reuse an Activity. Use a configuration supported by your core/runtime, such as `standard` or `singleInstancePerTask` on compatible Android versions. On iPadOS, enable `UIApplicationSupportsMultipleScenes` in the scene manifest and use the scene lifecycle. A phone or a Preview build may not support opening another scene.

Use the [NativeScript multi-window guide](https://docs.nativescript.org/guide/multi-window) for complete native setup. `openWindow` forwards the request; it cannot change the installed manifest, entitlements or device capabilities. Offer an ordinary `push()` action when multi-window UI is unavailable in your app.

A core launcher limitation after the original Android Activity finishes is tracked in [NativeScript #11526](https://github.com/NativeScript/NativeScript/issues/11526). On affected runtimes a further window request can throw even though another window remains open.

## Detach, reconnect and close

Back and predictive gestures are handled by their originating Activity/window. Modal presentation targets a page in that window rather than NativeScript-Vue's global modal target. An inactive window cannot consume the active window's back.

A temporary `detached` event keeps logical stacks and result promises, releases Activity gesture callbacks and saves the current snapshot. `attached` binds callbacks to the replacement Activity. A permanent `close` tears down the owning stacks/listeners and settles outstanding results with `undefined`; it cannot wait for asynchronous leave guards. Keep the same router when reconnecting an existing window; create a new router when reconstructing a window after a new JS process starts.

## Persistence by window

```ts
const router = createRouter({
  routes,
  window: request.window,
  restore: {
    key: String(request.data?.documentId ?? request.window.id),
    save: (state, scope) => {
      ApplicationSettings.setString(`router:${scope!.key}`, JSON.stringify(state))
    },
    load: (scope) =>
      JSON.parse(ApplicationSettings.getString(`router:${scope!.key}`, 'null')),
  },
})
```

Import `ApplicationSettings` from `@nativescript/core`. The optional second argument to `save` and argument to `load` are `RestoreContext`: `{ windowId, key }`. They are provided for scoped routers and omitted in legacy mode. Existing callbacks remain valid; multi-window stores must use the context to keep snapshots separate. `key` defaults to the native ID; use an application document/session key when it needs to remain stable across process restarts.

Scoped snapshots include `windowKey`; a mismatched key is ignored on load. Legacy snapshots without it remain readable. Closing a window saves `null` only with that window's context. A process-level exit saves existing scoped histories rather than clearing every window; legacy mode retains its existing clear-on-exit behavior.

Choose the incoming-route-versus-restored-history policy in your content resolver. A fresh `openWindow` request typically starts at its requested route and skips an older snapshot; an OS reconstruction normally restores the saved window. Use the native request's saved-state/session information and your application metadata to distinguish those cases. Use `usePageState()` for opt-in, versioned page state; pending Promises and native objects cannot survive process death.

## Links delivered to a window

With `links` enabled, warm Android intents and iOS scene URLs, user activities and quick actions go only to the router owning the event's Activity/scene. Closing a router removes its listeners and disables the legacy delegate callbacks that Core cannot unregister.

For a new secondary window, Core invokes the content resolver **after** emitting its initial intent/scene event. Forward that request explicitly to the new router with `router.openLink(url, { source: 'launch' })`; the call waits for restoration and the first native host. Read the URL from `request.android?.intent` or `request.ios?.connectionOptions`. On Android, do not replay the old intent when `request.android?.savedInstanceState` exists. Apply your chosen fresh-link versus saved-history policy before this handoff. A fresh incoming link normally lands above the restored history; `clearHistory: true` starts a new stack.

The router does not guess which document window an ownerless notification should target. The application chooses the router/window and calls its `openLink()`.
