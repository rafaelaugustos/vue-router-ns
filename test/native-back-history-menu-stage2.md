# Optional Back history menu — #178, stage 2

Based on merged history-model commit `92da7aa04dfdf8c64ffde9d4aab7a07a1a574f39`.
This stage adds `useBackHistoryMenu()` for application-owned controls. **#178 stays
open:** the native UIKit guard audit found an existing control path that bypasses
page leave guards. That failed audit is separate from the passing optional-menu
acceptance below.

## Delivered behavior

The composable belongs to its routed page and exposes `show(source)`, `dismiss()`
and readonly `active`. Long press, an accessible history button and keyboard
commands can open the same native UI. Opening does not navigate or reveal a tab.
Earlier entries appear newest first, excluding the current top. Labels can be
localized and distinguish repeated routes; defaults include the entry position.

Selection snapshots an entry address and uses `backToEntry()` after dismissing
the native UI. It does not match by route path. Guard refusal preserves history;
unexpected errors reach the configured handler. Source unloading/reparenting,
page coverage, history changes, owner disposal and old native callbacks cannot
redirect the selection to another entry. Repeated `show()` calls while open are
idempotent, including NativeScript's multiple long-press gesture phases.

UIKit's original Back button is untouched. App-owned controls use a public
anchored `UIAlertController` action sheet/popover; Android uses `PopupMenu`.
These provide native dismissal and an imperative opener for keyboard commands.
The [UIKit presentation documentation](https://developer.apple.com/documentation/uikit/getting-the-user-s-attention-with-alerts-and-action-sheets)
describes view anchoring and outside-tap cancellation on iPad. Android documents
its [anchored native popup and dismissal](https://developer.android.com/reference/android/widget/PopupMenu).
No private Back view lookup or navigation delegate replacement is introduced.

## Native acceptance

Published Core **9.1.4**, NativeScript-Vue **3.1.3**, iOS runtime **9.1.0** and
Android runtime **9.1.1**. Local Apple-silicon machine, Xcode **27.0 (27A266a)**.
iOS: **iPad Pro 13-inch (M4), iOS 18.6 simulator**. Android: **Pixel 7, API 35
emulator**. Dependencies and native navigation delegates were not patched.

The final XCTest run passed in **44.207 seconds**, with all **eight application
reports passing**. Android's UIAutomator/input driver passed all **seven
application reports**. Evidence retains live entry addresses and the application
assertions: [iOS](./evidence/back-history-menu-stage2/ios.json),
[Android](./evidence/back-history-menu-stage2/android.json).

| Check                                   | Observed result                                                                                                |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Original UIKit history, no active guard | Long press opens the existing menu; selecting an earlier title reconciles a native multi-pop.                  |
| App-owned Back long press               | Opens the optional menu with both duplicate visits labelled; releasing the gesture keeps it open.              |
| Dismissal without selection             | Outside tap/iPad Escape and Android hardware Back/Escape preserve both stacks and clear `active`.              |
| Keyboard                                | Ctrl+H opens the menu in the selected pane on both platforms; Android arrows/Enter select the older duplicate. |
| Active page/global guards               | Optional-menu selection is refused without removing a Page; the menu closes.                                   |
| Exact duplicate                         | The first `/item` keeps its original native Page; every Archive Page stays unchanged.                          |
| Concurrent push                         | The old menu closes and its callback cannot select a stale history snapshot.                                   |
| Owner disposal                          | An open menu closes; its disposed owner cannot reopen it; no Vue/reconciliation errors.                        |

[Actual simulator video](../docs/public/media/back-history-menu.mp4) records the
passing iOS sequence, **44.55 seconds**, at original speed, H.264, **1032 × 1376**. Only the first two
seconds of simulator launch were trimmed; no interaction or transition was
composited. The recording shows both independent stacks, original UIKit history,
the optional menu, keyboard open/dismiss, refused selection, exact duplicate
selection, concurrent navigation and teardown. The failed guard audit below is
not represented as a passing scene in this video.

The [repeatable fixture/drivers](../scripts/native/history/README.md) produce the
recording and reports. Fixture-held Page references support identity assertions;
they are not a garbage-collection measurement. Accessible labels and keyboard
events were tested, not VoiceOver/TalkBack speech, physical hardware, iPhone
action-sheet layouts or every OS keyboard mode. A custom host needs a loaded
routed NativeScript Page/anchor for this UI; other hosts can render the public
history model themselves.

## Separate failed UIKit guard audit

With `onBeforeRouteLeave(() => false, { when: block })` active, UIKit's original
Back button still offered its long-press history. Selecting `between` reduced
Inbox from **five entries to three** despite that guard. Archive was unchanged.
A separate clean-launch reproduction also failed the unchanged-history assertion,
retaining four entries. Neither result preserves the guarded five-entry stack. See the
[failed audit evidence](./evidence/back-history-menu-stage2/uikit-guard-audit.json).

The source audit found that Core's iOS Frame supplies UIKit navigation items,
while `src/page.ts`/`src/ios.ts` intercept guarded Back taps using `backAction`.
Those files are unchanged in this stage. Apple's
[`backAction` contract](https://developer.apple.com/documentation/uikit/uinavigationitem/backaction)
describes replacing the Back action; it does not establish interception of every
history-menu pop. The observed bypass is through that existing system control,
not the new optional menu. Android Core's ActionBar installs a navigation click
listener and does not supply a retained-entry history menu.

`HISTORY_MENU_AUDIT=1` selects a separate reproduction that is expected to fail
on this audited combination. It is **not** counted among passing acceptance
checks. A follow-up stage of #178 must address the guarded UIKit control. Until
then, apps requiring guarded history selection must use their own controls and
hide the system Back control; this composable alone does not intercept it.

An earlier investigative optional-menu run also failed: multiple NativeScript
long-press phases reopened/dismissed the just-opened sheet. Making `show()`
idempotent fixed that behavior; final native and contract runs include it.

## Other verification

**722 tests passed**, ten existing skips, across 58 files, with no type errors.
Eight new focused cases cover exact identity, refusal/error reporting, stale and
repeated callbacks, source movement/unload, multiple stacks, modal coverage,
owner disposal and native presenter dismissal order. Existing history contracts
continue to cover native pops/cancellation, asynchronous guards, window closure,
restoration, unloaded hosts and pinned roots.

Root/fixture typechecks, build/package generation, formatting and native helper
checks passed. The four-locale guide/API documentation passed structural checks,
build and browser review, including phone-width layout, matching language links
and local search. [Documentation evidence](./evidence/back-history-menu-stage2/documentation.json)
also includes the site's existing reduced-motion and server-rendered checks.
No native-speaker translation review or hosted native success is claimed.
