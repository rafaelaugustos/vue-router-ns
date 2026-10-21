# System pickers and native flows

Some destinations are not pages: the document picker, another app's activity, a share sheet. The system owns them, they can outlive a screen rotation, and nothing about them belongs in the back stack. A **native flow** gives them a typed input, a typed result and one of three outcomes, settled exactly once.

<Clip name="ios-document-picker" caption="Attach opens the iOS document picker. Cancelling returns to the form with Picker cancelled, without adding a route." />

```ts
import { createDocumentPicker, useNativeFlow } from 'vue-router-ns'

const picker = useNativeFlow(createDocumentPicker())

async function attach() {
  const outcome = await picker.run({
    types: ['application/pdf', 'image/*'],
    multiple: true,
  })
  if (outcome.status === 'completed') attachments.value = outcome.value.uris
}
```

`run` resolves with `{ status: 'completed', value }`, `{ status: 'cancelled', reason }` or `{ status: 'failed', error }`. The reasons: `'user'` when the system UI was dismissed, `'guard'` when the `before` option said no, `'replaced'` when the same page ran the flow again, and `'disposed'` when the page left its stack first, in which case a result that arrives later is dropped. `running` is a ref that is `true` from the launch until the outcome. The page that started the flow stays active and nothing enters the history: `onPageDeactivated` does not fire for system UI the router does not own.

Run checks before launching, not after: `picker.run(input, { before: () => session.user !== '' })` cancels with `'guard'` instead of trying to intercept a dismissal the system does not announce.

## The document picker

`createDocumentPicker()` opens `ACTION_OPEN_DOCUMENT` through the originating page's AndroidX Activity Result registry, or `UIDocumentPickerViewController` from that page's own controller on iOS 14 and later. A mounted page is required. `types` accepts MIME types, including `image/*`, `audio/*`, `video/*`, `text/*` and `*/*`; `multiple` allows several documents.

Results contain URI strings: `content://` on Android and `file://` on iOS. A URI is not a filesystem path or a permanent access grant. Reading/copying data, Android persistable URI permissions, and iOS security-scoped URL access/bookmarks belong to the app. Use a custom adapter when you need the original native result objects to manage that access.

Separate handles can run independently on Android. UIKit has one presentation slot per window: a simultaneous second document picker resolves as `failed`, instead of leaving a pending Promise. Wait for dismissal before presenting another controller. A newer invocation on the same handle replaces the previous attempt; asynchronous guards cannot launch an older invocation over a newer one.

## Writing a flow

A flow has a `kind`, optional `supported()` and `start(input, context)`. The context provides the originating `page`, correlation `id`, `complete`, `cancel` and `fail`. Return a cleanup function from `start`: it runs on **every terminal outcome**, including success, cancellation, failure and disposal. Release delegates/listeners and dismiss owned native UI there.

On Android, call `context.launchActivity(intent, (resultCode, intent) => { ... })`. It registers with the originating Activity's AndroidX registry, launches once, and removes the registration when the flow settles. Parse the native result and call `complete`, `cancel` or `fail`. Parser exceptions become failed outcomes. Registration does not use a globally selected foreground Activity.

`requestCode` and `onActivityResult(handler)` remain for legacy adapters. Their reserved numeric range is not a guarantee against unrelated plugins using the same codes; new adapters should use `launchActivity`.

```ts
const share: NativeFlow<string, void> = {
  kind: 'share',
  start(text, context) {
    const controller =
      UIActivityViewController.alloc().initWithActivityItemsApplicationActivities(
        [text],
        null,
      )
    controller.completionWithItemsHandler = (_, completed) =>
      completed ? context.complete() : context.cancel()
    context.page?.ios.presentViewControllerAnimatedCompletion(controller, true, null)
  },
}
```

## Rotation and process death

The AndroidX adapter stores the attempt's registration key in the Activity's saved instance state and rebinds that key after recreation **while the originating page and JavaScript attempt remain alive**. It does not launch the external Activity twice. Destruction of the owner without configuration change cancels with `disposed`.

Page lifetime takes precedence. With NativeScript-Vue 3.1.2, explicit `Activity.recreate()` disposes the originating Vue page: its pending flow resolves with `cancelled/disposed`. A late system result cannot settle that attempt again or complete a new one. Ordinary rotation handled by the existing Activity can retain the attempt.

No Promise survives process death. Persist an application-owned “picker was open” marker in [page state](./restore#page-state) or app storage, then decide whether to retry or recover previously granted access after restart. The router does not replay an old result into a fresh flow. Persisting a marker does not persist the document permission itself.

`useNativeFlow` disposes attempts with their page. Lower-level `startNativeFlow` callers must call the returned `dispose()` when their owner closes. System UI does not create a router entry or trigger router page deactivation; normal platform background/foreground events still apply.
