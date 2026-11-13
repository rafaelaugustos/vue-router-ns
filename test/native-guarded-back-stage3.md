# Guarded UIKit Back/history — #178, stage 3

Based on merged stage-2 commit `e6fbbc67efbdfdf8ba8e3c0e7e1dbfc1af2e8b91`.
This stage fixes the UIKit history path that bypassed active page leave guards in
[the stage-2 audit](./native-back-history-menu-stage2.md#separate-failed-uikit-guard-audit).

## Delivered behavior

On iOS 16+, a routed NativeScript Page temporarily owns a native Back item when
native history could remove a page with an active `onBeforeRouteLeave` guard.
This includes a guard below an unguarded current page. A short tap calls
`router.back()`; long press offers retained entry titles and positions, and calls
`backToEntry()` with the selected stable address. Refusal leaves both logical and
native history intact. Duplicate routes retain the selected original Page.

The binding extends the Page's public `ActionBar.update()` and preserves the
application's other header items and hidden Back state. It restores the system
control when protection ends, removes only its own item on teardown, and does
not overwrite a later app/plugin wrapper. Header context menus are dismissed
before protected header changes. Version and visibility checks invalidate old
callbacks after history changes, modal coverage or disposal; repeated selection
cannot start a second navigation while confirmation is pending.

UIKit's [`backAction`](https://developer.apple.com/documentation/uikit/uinavigationitem/backaction)
replaces the short Back action but did not protect the built-in history menu in
the audited runtime. This implementation instead uses public
[`UIBarButtonItem` primary-action/menu initialization](https://developer.apple.com/documentation/uikit/uibarbuttonitem/initwithprimaryaction:menu:)
and an [uncached deferred menu](<https://developer.apple.com/documentation/uikit/uideferredmenuelement/uncached(_:)>)
to obtain the current retained history. NativeScript dependencies and navigation
delegates are unchanged; no private Back view lookup is used.

A guard on the retained root alone does not replace Back: selecting that root
keeps it. Global guards alone do not activate this protection. The existing iOS
15 native-pop limit remains. The optional `useBackHistoryMenu()` still supports
app-owned controls, custom labels and keyboard commands on both platforms.

## Native acceptance

Published Core **9.1.4**, NativeScript-Vue **3.1.3**, iOS runtime **9.1.0**;
Apple-silicon Mac, Xcode **27.0 (27A266a)**. Dedicated **iPad Pro 13-inch (M4)**
simulators ran the same fourteen-report fixture sequentially:

| Runtime  | XCTest                 | Application reports | Evidence                                              |
| -------- | ---------------------- | ------------------- | ----------------------------------------------------- |
| iOS 18.6 | 80.805 seconds, passed | 14/14 passed        | [iOS 18.6](./evidence/guarded-back-stage3/ios18.json) |
| iOS 27.0 | 93.019 seconds, passed | 14/14 passed        | [iOS 27.0](./evidence/guarded-back-stage3/ios27.json) |

The sequence verifies refusal by the top page, refusal by a covered page,
Stay/Leave asynchronous confirmation, selection of the older duplicate with its
original Page, every Archive Page unchanged, and a working app-owned Tools item
after ActionBar updates. It then activates a guard while original UIKit history
is open, verifies dismissal without a pop, performs one Back through an unguarded
top, restores the original UIKit history and disposes both owners while a guarded
menu is open. Reports contain no Vue or reconciliation errors.

The separate `HISTORY_MENU_AUDIT=1` regression also passes its three reports:
selecting through an active guard leaves all five entries intact. See the
[regression evidence](./evidence/guarded-back-stage3/regression.json). Historical
stage-2 failures remain unchanged in that earlier report.

[Actual simulator video](../docs/public/media/guarded-back-history.mp4): **81.07
seconds**, original speed, H.264, **1032 × 1376**, from the final iOS 18.6 run.
Only the first two seconds of launch were trimmed; no interaction was composited.
It shows the native guarded menu, both refusal paths, app header updates,
Stay/Leave, exact duplicate selection, guard activation during native history,
one-page Back, system handoff and teardown. The four-locale guards guide embeds
this recording with localized captions and English fixture labels.

The [repeatable fixture and drivers](../scripts/native/history/README.md#guarded-uikit-backhistory-stage-3)
retain raw recordings, XCTest logs/results and JSON application reports locally.
Early investigation found competing Back controls when old `backAction`
interception remained installed; that interception was removed. Another early
probe released its long press over UIKit's first history row, selecting it before
the guard timer fired. The final activation probe holds the touch through that
timer; the recording confirms the menu appears and closes with five entries
retained. Those investigative attempts are not counted as passing acceptance.

This is simulator evidence, not physical-device, VoiceOver speech or garbage
collection evidence. Page references are held by the fixture for identity checks.
Android behavior is unchanged; this stage does not claim a new Android native
run. The iOS 16 availability boundary has a focused contract check; the native
runs cover iOS 18.6 and 27.0.

## Other verification

**730 tests passed**, ten existing skips, across **59 files**, with no type errors.
Nine focused cases exercise header-menu dismissal, covered/active guards,
asynchronous refusal/serialization, exact identity, stale actions, modal
coverage, hidden Back, later wrappers, root-only guards and the iOS 15 boundary.
The former short-tap-only `backAction` assertion moved to this native-item contract
suite. Existing history tests continue to cover settlement, cancellation, native
pops, window disposal, pinned roots, unloaded hosts and restoration.

Root and native-fixture typechecks, library/native builds, package dry run,
formatting and native helper checks passed. Documentation structural checks,
build and browser review passed for all four locales, including both affected
guides at 390px, corresponding language links, video loading and local search.
[Documentation evidence](./evidence/guarded-back-stage3/documentation.json)
also includes reduced-motion and server-rendered checks. No native-speaker
translation review or hosted native success is claimed.
