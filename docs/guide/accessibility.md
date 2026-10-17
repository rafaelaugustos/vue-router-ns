# Accessibility focus and motion

NativeScript already announces a Page after native navigation and attempts to restore its last accessibility-focused view on back. The router leaves that behavior alone unless a page opts into explicit focus. UIKit and TalkBack continue to own accessibility traversal, speech, text sizing and keyboard input focus.

## Explicit focus targets

```vue
<script setup lang="ts">
import { useNavigationFocus, useRouter } from 'vue-router-ns'

const router = useRouter()
const focus = useNavigationFocus({ initial: 'heading', return: 'reply' })
async function reply() {
  focus.remember('reply')
  await router.pushForResult('/compose')
}
</script>

<template>
  <Page>
    <ActionBar title="Message" />
    <StackLayout>
      <Label id="heading" text="Message subject" accessible="true" textWrap="true" />
      <Button id="reply" text="Reply" @tap="reply" />
    </StackLayout>
  </Page>
</template>
```

`useNavigationFocus({ initial?, return? })` registers once during routed page setup. Targets are stable view ids, NativeScript views/template references, or getters returning those views (or null/undefined while unavailable). Targets must be loaded, visible, accessible descendants of this page. Choose a meaningful heading or control; the router does not make an inaccessible container into an accessibility element.

On Android, leave `ListView` rows without `accessible`: core makes an accessible view focusable, and `ListView` then stops delivering `itemTap` for that row. An `accessibilityLabel` on the row is enough for TalkBack to read it as one item, and the row stays a valid focus target. Keep `accessible` for iOS, where it does not affect `UITableView` taps.

A successful native transition requests one target: `initial` on push and `return` on back. The page's native announcement is held until the Frame history confirms the transition, then replaced by a UIKit layout-changed notification or Android accessibility-focus action. There is no extra announcement alongside core's. Guard rejection and cancelled native transitions do not request focus. Missing, removed or disposed targets fall back to NativeScript's normal page announcement/restoration. No target requests keyboard focus or opens the IME. `accessibilityAnnouncePageEnabled="false"` still disables automatic announcements.

Call `focus.remember(target?)` immediately before a modal or result navigation to identify its initiating page and element. With no argument it uses the configured return target. This also works from a visible split list while a detail page is on screen: closing the modal restores the initiating list element, not whichever pane happens to be last in the logical stack. Without an explicit initiator, the modal returns to the stack's top page. `focus.focus('initial' | 'return')` is an explicit immediate accessibility-focus attempt and returns a boolean; use it when asynchronous content becomes available after the transition.

Opted-in pages hide covered content from accessibility and restore its original hidden state when visible/disposed. RouterSplitView also hides its covered/empty panes while keeping both expanded panes accessible. Resizing does not announce a new route. The previous Android preview page is temporarily excluded from traversal throughout a predictive gesture, including cancellation, and its original state is restored afterward.

Do not put a custom announcement on every `onPageActivated`: that hook precedes native transition completion and also activates both expanded split panes. Keep text wrapping, scalable fonts and native controls in the page; this composable does not implement an alternative accessibility tree.

## Reduced motion

`createRouter({ routes, motion: 'system' })` is the default. At each routed navigation or back-preview start it reads UIKit Reduce Motion or Android's animator-enabled setting (with the Android pre-26 duration-scale fallback).

| Policy    | Router behavior                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `system`  | Respect the current OS preference. No restart required.                                                                  |
| `reduced` | Omit router-owned preview/zoom/shared transitions; request unanimated push, back and modal presentation.                 |
| `full`    | Leave normal router/native transition options available. UIKit/Android may still enforce their own accessibility policy. |

Reduced motion does not change routes, guards, modal results or history. Shared-transition state that is bypassed is released. Native interactive gestures and transitions outside this router continue to follow platform behavior. Apps opting out with `full` should offer a considered application preference.

## Validation

See the repository's `test/native-accessibility.md` for native assertions and outstanding manual VoiceOver/TalkBack checks. Test a dirty modal, cancelled swipe, both split widths, unavailable targets and large text in the real application. See [NativeScript accessibility](https://docs.nativescript.org/guide/accessibility), [UIKit layout changes](https://developer.apple.com/documentation/uikit/uiaccessibility/notification/layoutchanged), [guards](./guards), and [transitions](./transitions).
