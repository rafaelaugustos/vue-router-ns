# Modals and results

Mark a route with `modal: true`, or pass `ModalOptions` (`fullscreen`, `animated`, `cancelable`, `ios.presentationStyle`…):

```ts
{ path: '/compose', component: Compose, modal: { fullscreen: true } }
```

<div class="clips">
<Clip name="ios-sheet" caption="Compose opens in a native sheet with medium and large detents. iOS 26 simulator." />
<Clip name="android-sheet" aspect="9 / 20" caption="Compose opens in a Material bottom sheet; system Back dismisses it. Android 16 emulator." />
</div>

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

The sheet is configured before it's presented, so it opens at the right height. `push` can pass the same options under `modal.ios`, merged with the record's. Android ignores them; it has [bottom sheets](#bottom-sheets-on-android) of its own.

## Bottom sheets on Android

Android has no detents. Material's bottom sheet has resting states instead: collapsed at a peek height, half expanded at a share of the screen, or expanded to its content. Set `sheet` in `android` of the modal options to present the route in one, with `true` for Material's defaults:

```ts
{
  path: '/filters',
  component: Filters,
  modal: {
    ios: { detents: ['medium', 'large'] },
    android: {
      sheet: {
        peekHeight: 320, // the collapsed height, in device-independent pixels
        state: 'expanded', // or 'collapsed' (the default) or 'halfExpanded'
        fitToContents: false, // needed for the half-expanded state
        halfExpandedRatio: 0.6,
        skipCollapsed: true, // hiding from expanded skips the collapsed stop
        height: 520, // the content's height; by default, as tall as the content
      },
    },
  },
}
```

The route still gets its own Frame, so pages push inside the sheet, `pushForResult()` works and `router.back()` on its first page closes it. Dragging the sheet away, tapping outside or pressing back closes it through the leave guards: while a guard is active the sheet can't be dragged away, and an outside tap or back asks the guard. Material has no callback for refusing a hide gesture: a held sheet can still collapse, but cannot be dragged to its hidden state. `cancelable: false` keeps the user from closing it at all. `push` merges its `modal.android.sheet` with the record's, like `ios`.

Use a native `ScrollView` for long sheet content. The sheet's `height` limits its visible area, and native nested scrolling lets its content scroll within it. Back first dismisses an open keyboard before acting on the sheet's history.

The sheet uses the router's Back handling so guards run before dismissal. Material's interactive predictive-back sheet animation is unsupported. See the [native validation report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-bottom-sheets.md) for the checked behavior and platform limits.

Inside its pages, `useNativeHost()` reports `kind: 'bottom-sheet'`, and `native` is the Frame.

::: warning Add Material to release builds
The NativeScript Android runtime only includes `com.google.android.material` in debug builds. Add it to `App_Resources/Android/app.gradle` before shipping a sheet:

```groovy
dependencies {
  implementation "com.google.android.material:material:1.12.0"
}
```

Without it, `push` rejects with an error that says so instead of presenting a plain dialog. `supportsBottomSheets()` tells you at runtime.
:::

## Getting a result back

<Clip name="ios-modal-result" caption="Reply opens the modal; Send returns the text to the originating message through pushForResult. iOS 26 simulator." />

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

Sheets with `'medium'` and `'large'` heights require iOS 15+; fractional heights require iOS 16+. Presentation must support sheets. Android ignores `ios` options and iOS ignores `android` ones. `pushForResult<T>()` does not validate the result at runtime: `T` describes the contract between the pages.
