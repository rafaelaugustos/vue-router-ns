# Modals and results

Mark a route with `modal: true`, or pass `ModalOptions` (`fullscreen`, `animated`, `cancelable`, `ios.presentationStyle`…):

```ts
{ path: '/compose', component: Compose, modal: { fullscreen: true } }
```

`router.push('/compose')` presents it inside its own frame, so it has an ActionBar and its own stack. Pages inside push within the modal. `router.back()` from the first page of the modal closes it. Swiping it down, tapping outside or pressing the Android back button closes it too, through the leave guards of its pages. The router follows along and runs `afterEach`.

`push` also takes `modal` as an option, to present any route modally regardless of what its record says.

## Sheets on iOS

iOS sheets can stop at medium height, at full height or at a fraction of the screen, show a grabber, and keep the page behind usable, like Maps. Set that in `ios` of the modal options:

```ts
{
  path: '/filters',
  component: Filters,
  modal: {
    ios: {
      detents: ['medium', 'large'], // or a fraction of the screen: 0.4 (iOS 16)
      selectedDetent: 'medium', // the height it opens at
      largestUndimmedDetent: 'medium', // the page behind stays usable up to here
      grabber: true,
      cornerRadius: 24,
    },
  },
}
```

The sheet is configured before it's presented, so it opens at the right height. `push` can pass the same options under `modal.ios`, merged with the record's. Android has no equivalent in `showModal` and ignores them.

## Getting a result back

A page can return a value to whoever opened it. This works with modals and with plain pages:

```ts
// Message.vue
const reply = await router.pushForResult<string>('/compose')
if (reply) send(reply)
```

```ts
// Compose.vue
router.back({ result: text.value })
```

If the page closes any other way (a swipe, the back button) or a guard stops it from opening, the promise resolves with `undefined`.

## Dismissal and platform versions

`cancelable: false` prevents user dismissal (such as Android back at the modal root); code can still call `router.back()`, through guards. A page above the modal root can still go back within that stack.

Sheets with `'medium'` and `'large'` heights require iOS 15+; fractional heights require iOS 16+. Presentation must support sheets. Android ignores `ios` options. `pushForResult<T>()` does not validate the result at runtime: `T` describes the contract between the pages.
