# System pickers and native flows

Some destinations are not pages: the document picker, another app's activity, a share sheet. The system owns them, they can outlive a screen rotation, and nothing about them belongs in the back stack. A **native flow** gives them a typed input, a typed result and one of three outcomes, settled exactly once.

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

`createDocumentPicker()` opens `ACTION_OPEN_DOCUMENT` on Android and `UIDocumentPickerViewController` on iOS 14 and later, presented from the page's own view controller. `types` are MIME types, `multiple` allows several. The result is scoped URIs: `content://` on Android, security-scoped `file://` URLs on iOS. Reading them, keeping persistent access and copying what the app needs is the app's job, with the platform's own APIs; the router never hands out filesystem paths it does not have.

## Writing a flow

A flow is an object with a `kind`, an optional `supported()` and a `start(input, context)`. The context has the page, a reserved Android `requestCode` with `onActivityResult(handler)` wired to core's `activityResult` event, and `complete`, `cancel` and `fail`. Return a function from `start` to be told when the attempt is abandoned, to dismiss a controller for example. Request codes come from a range of their own, so they do not collide with other plugins', and concurrent attempts settle independently.

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

An Android activity recreated during the flow, for a rotation, still gets the result: the attempt is keyed by request code in the JavaScript process, which survives. Process death does not: there is no promise to resolve when the app comes back, and the result the system delivers to the new process is dropped. A page that must survive that keeps "a picker was open" in its [page state](./restore#page-state) and asks again, or reads what the system already granted.
