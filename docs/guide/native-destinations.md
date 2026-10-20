# Native destinations (experimental)

`defineNativeDestination()` lets a route display an existing UIKit `UIViewController` or AndroidX `Fragment`. Use it as the route's `component`. Navigation still uses native Frames, Pages and the router's existing history, guards and results.

The router owns a containing Page and the child controller/Fragment. Your SDK owns the screen's UI. This is different from a [native flow](./native-flows): a destination occupies a history entry; a system picker does not.

## Define a destination

```ts
import { defineNativeDestination, createRouter } from 'vue-router-ns'

const Editor = defineNativeDestination<{ documentId: string }, { saved: boolean }>({
  id: 'vendor.document-editor',
  input: (route) => ({ documentId: String(route.params.id) }),
  ios(context) {
    const editor = makeUIKitEditor(context.input.documentId)
    editor.onSave = () => context.complete({ saved: true })
    editor.onCancel = () => context.cancel()
    return {
      native: editor,
      dispose() {
        editor.onSave = null
        editor.onCancel = null
      },
    }
  },
  android(context) {
    const editor = makeAndroidXEditor(context.input.documentId)
    editor.setOnSave(() => context.complete({ saved: true }))
    editor.setOnCancel(() => context.cancel())
    return {
      native: editor,
      dispose() {
        editor.setOnSave(null)
        editor.setOnCancel(null)
      },
    }
  },
})

const router = createRouter({
  routes: [
    { path: '/', component: Home },
    {
      path: '/documents/:id',
      name: 'document-editor',
      component: Editor,
      meta: { layout: false },
    },
  ],
})

const result = await router.pushForResult<{ saved: boolean }>({
  name: 'document-editor',
  params: { id: '42' },
})
```

`makeUIKitEditor` and `makeAndroidXEditor` above represent your SDK's factories, not router exports. Each call must return a fresh, unparented native object synchronously. An omitted platform factory produces a clear navigation error before entering that route.

The input mapper also receives route props as its second argument. The context provides `route`, `input` and a `page` getter. `page` becomes available after mounting and becomes `null` after disposal. Present additional SDK dialogs from that Page's controller or Activity to preserve window ownership.

Native destinations own their Page and cannot use a named Vue layout. Set `meta.layout: false` when the router has a default layout. Route-level modals work too.

## Results, guards and external removal

| Operation                                 | Behavior                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `context.complete(value)`                 | Requests router back with a typed result; resolves with a navigation failure if a guard blocks it. |
| `context.cancel()`                        | Requests router back without a result; runs guards.                                                |
| `context.beforeLeave(guard)`              | Registers a leave guard; returns an unregister function.                                           |
| UIKit navigation pop / Android Page back  | Existing host reconciliation removes the history entry and settles its pending result.             |
| SDK removes its Android Fragment          | The child FragmentManager listener observes removal and reconciles the Page.                       |
| SDK removes its UIKit child independently | Call `context.dismissed()` from the SDK's removal callback after removal commits.                  |

`dismissed()` reports an irreversible change. It does **not** run leave guards or claim to undo a dismissal the SDK already committed. If the SDK lets you intercept a close request, call and await `cancel()` or `complete()` **before** removing its UI.

UIKit's interactive pop is disabled while an entry has an active leave guard, just as for Vue pages. Arbitrary direct SDK calls to `popViewController` cannot be vetoed after UIKit commits them. This adapter does not replace SDK delegates or globally intercept UIKit methods.

Completion/cancellation callbacks from entries that have already closed, or are underneath another entry, do nothing. A root destination has no previous page to return to; `dismissed()` rejects an attempt to remove a nonmodal root. Use a Vue home page or a modal when the screen must close.

## Ownership and restoration

The iOS adapter performs child-controller containment in the Page's controller. The Android adapter uses the owning Page Fragment's **child** FragmentManager; it does not add SDK transactions to the Activity's navigation back stack.

Factories may run again when NativeScript rebuilds a native view. `dispose()` runs once per factory instance after detaching it. Release SDK listeners, subscriptions and application references there. Keep serializable application state outside the native instance; never reuse a disposed controller or Fragment.

The existing [history restoration](./restore) recreates the route and invokes its registered factory with reconstructed input. Keep the route identity/path and factory `id` stable, and migrate saved routes when renaming them. No controller, Fragment, callback or pending result Promise is serialized. This does not promise automatic recovery of an SDK's private UI state or multiwindow scene restoration.

## Native dependencies and examples

The router does not bundle a vendor SDK. Add its native dependencies to your app. A SwiftUI `UIHostingController`, Compose bridge or SDK with APIs unavailable to the NativeScript bridge may need a compiled Swift/Kotlin wrapper. This prototype's examples use UIKit and AndroidX directly.

The runnable [acceptance fixture](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/destinations-app.ts) contains both native factories, buttons, cancellation and SDK dismissal callbacks. Build it with `ns build ios --emulator --env.destinationsTest` or `ns build android --env.destinationsTest` from `demo` after building the package.

Containment follows [UIKit's child-controller contract](https://developer.apple.com/documentation/uikit/creating-a-custom-container-view-controller) and [AndroidX Fragment transactions](https://developer.android.com/guide/fragments/transactions). The [native validation report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-destinations.md) records the tested platform versions and limits.
