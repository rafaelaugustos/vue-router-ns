# Navigation in multiple native windows

This feature is experimental and requires the supported Core 9.1.3+ / NativeScript-Vue 3.1.2+ dependencies plus the platform's multi-window configuration.

The router owns the Vue apps behind Frame pages, retaining them while their routes remain in native history. Android Activity recreation is validated with published Core 9.1.3 and NativeScript-Vue 3.1.2; no dependency patch is required. Page and layout HMR still use native Page replacement. Restoration of original Android tasks and UIKit scene sessions after process death is validated. iPad scene disconnect/reconnect within the same running process is also validated: the original Pages, Vue state, guards and pending navigation results survive. The native suite requests a real UIKit scene disconnection using a simulator-only driver; this is separate from background resume and cold restoration.

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

The location is resolved with the caller's route types. On Android, a bound router launches an explicit Intent through its live owning Activity, using Core's window flags and serialized metadata. Other cases use `Application.openWindow()`. The source stack stays in place and its leave guards do not run. The new window's initial navigation runs its own guards. This is an OS request, not a Promise that confirms a new scene appeared; native configuration or the OS may deny it. Missing NativeWindow APIs throw an error.

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

The bound Android router uses its surviving Activity class when opening another window, including after the original Activity finishes. This avoids the Core launcher limitation in [NativeScript #11526](https://github.com/NativeScript/NativeScript/issues/11526) for `router.openWindow()`; direct calls to `Application.openWindow()` retain Core’s behavior.

## Detach, reconnect and close

Back and predictive gestures are handled by their originating Activity/window. Modal presentation targets a page in that window rather than NativeScript-Vue's global modal target. An inactive window cannot consume the active window's back.

A temporary `detached` event keeps logical stacks and result promises, releases Activity gesture callbacks and saves the current snapshot. `attached` binds callbacks to the replacement Activity. A permanent `close` tears down the owning stacks/listeners and settles outstanding results with `undefined`; it cannot wait for asynchronous leave guards. Keep the same router when reconnecting an existing window; create a new router when reconstructing a window after a new JS process starts.

On iOS, the router also reconstructs a retained Frame's native controller stack when its scene returns. Core 9.1.3 otherwise recreates an empty controller while keeping the JavaScript history. This scoped compatibility layer uses Core's Frame/Page lifecycle metadata and public UIKit stack APIs; it does not patch dependencies or use private Apple APIs. Its temporary hooks are removed after reconstruction or router disposal.

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

Import `ApplicationSettings` from `@nativescript/core`. The optional second argument to `save` and argument to `load` are `RestoreContext`: `{ windowId, key }`. They are provided for scoped routers and omitted in legacy mode. Existing callbacks remain valid; multi-window stores must use the context to keep snapshots separate. `key` defaults to `primary` for an automatically inferred primary window, preserving existing single-window stores across process death; explicitly supplied windows default to the native ID. The default is captured when ownership is bound and does not change if another window becomes primary. Supply an application document/session key for each explicit window to keep it stable across process restarts.

Scoped snapshots include `windowKey`; a mismatched key is ignored on load. Legacy snapshots without it remain readable. Closing a window saves `null` only with that window's context. A process-level exit saves existing scoped histories rather than clearing every window; legacy mode retains its existing clear-on-exit behavior.

Choose the incoming-route-versus-restored-history policy in your content resolver. A fresh `openWindow` request typically starts at its requested route and skips an older snapshot; an OS reconstruction normally restores the saved window. Use the native request's saved-state/session information and your application metadata to distinguish those cases. Use `usePageState()` for opt-in, versioned page state; pending Promises and native objects cannot survive process death.

### Original tasks and scene sessions

On Android 10 / API 29 and later, the router registers an Activity lifecycle observer while it owns native windows. It marks saved bundles from its own Activities with a process token. When a later process resumes one of those tasks, a pre-create callback drops the obsolete Core Frame/root identifiers and AndroidX FragmentManager state before native restoration runs. Activity recreation within the same process is untouched. The observer leaves window metadata, ActivityResult state, application data and other saved-state providers intact, and unregisters when the last router owner is released. This is a compatibility adapter for the Core 9.1.3 restoration path, using known Core/AndroidX bundle keys; it does not patch installed dependencies.

The primary native window ID can change across an Android process restart even when the task ID is preserved. Persist document keys rather than treating generated window IDs as application identity. On Android below API 29, this adapter is unavailable: use application-owned reconstruction into new windows, or keep a single-window flow. Automatic reconstruction of the original multiple tasks is not supported there.

UIKit may reconnect saved sessions in a different order. Persist a mapping from each scene's persistent window ID to your application document key when first opening it, and consult that mapping in the content resolver **before** deciding that the first arriving scene is your default document. A cold connection may have no original `openWindow()` payload. Assigning documents by `request.isPrimary` or arrival order alone can swap their histories. Remove the mapping when its session is permanently discarded. The native fixture in `demo/src/testing/windows-app.ts` demonstrates this application-owned mapping and validates restored documents against their original scene IDs.

## Links delivered to a window

With `links` enabled, warm Android intents and iOS scene URLs, user activities and quick actions go only to the router owning the event's Activity/scene. Closing a router removes its listeners and disables the legacy delegate callbacks that Core cannot unregister.

For a new secondary window, Core invokes the content resolver **after** emitting its initial intent/scene event. Pass it as `links: { initial: request }` when creating the router, or forward the URL with `router.openLink(url, { source: 'launch' })`; the call waits for restoration and the first native host. Read the URL from `request.android?.intent` or `request.ios?.connectionOptions`. On Android, do not replay the old intent when `request.android?.savedInstanceState` exists. Apply your chosen fresh-link versus saved-history policy before this handoff. A fresh incoming link normally lands above the restored history; `clearHistory: true` starts a new stack.

The router does not guess which document window an ownerless notification should target. The application chooses the router/window and calls its `openLink()`.
