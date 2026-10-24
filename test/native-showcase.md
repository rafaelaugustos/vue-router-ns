# Integrated native navigation showcase — #138

Fieldnotes uses the public router API and the same native Page/Frame owners as the mail demo. The normal `--env.showcase` entry contains no acceptance polling. The optional `--env.showcaseTest` starts the identical bootstrap and records at most 240 diagnostic snapshots for native evidence.

Baseline: Core 9.1.3, NativeScript-Vue 3.1.2, iOS runtime 9.1.0, Android runtime 9.1.1. Native acceptance runs on an iPhone simulator with iOS 26.0 and Android 16/API 36 ARM64 emulator. These are emulator/simulator results, not a complete device matrix.

## Recorded validation

- 641 unit/type tests passed; 10 existing skips. Library and demo typechecks and the library build passed.
- XCTest completed the full iOS flow with zero failures after the search-lifecycle correction.
- Android UIAutomator completed the full flow with normal animations and again with animator duration scale zero.
- Both language guides build with the real iOS recording. The compact evidence summary is in `test/evidence/native-showcase.json`.

## Contract exercised

- Drawer About selection navigates and closes the overlay; explicit return to Library keeps the root entry.
- Native search filters to `coast`; context action changes that note only. Header action reflects and changes the same state.
- Native review modal returns `Reviewed today` to the retained detail page.
- A real keyboard edit activates the guard. Native Back and drawer Library navigation both ask; refusal retains the draft and drawer as appropriate.
- Saving returns to detail; native Back returns to the original root entry and retained `coast` query, with no final diagnostic mismatch.
- Native hierarchy exposes buttons/labels. Android additionally runs the whole flow with system animator duration scale zero, restoring the previous setting afterward.

Inputs are actual XCTest / UIAutomator taps, long presses and keyboard events, not direct calls to Vue handlers. The Android driver verifies the original diagnostic root-entry ID, final native/logical audit, saved text and untouched other item. iOS retains XCTest screenshots and a bounded diagnostic report. Root-entry identity and retained query are evidence of this navigation flow, not a claim about cold restoration.

## Integration regression: iOS search presentation

The first complete iOS run exposed a real integration gap: after active search, pushing a note and later returning could display the list while Core still considered the detail current. The list's accessibility subtree stayed hidden because router visibility correctly followed that stale Core history. The native report showed two Frame entries while UIKit displayed the list. This is not fixed by clearing the query or remounting the list.

Core 9.1.3 caches a presented controller in `Page._presentedViewController` during `viewWillDisappear`, and skips history reconciliation while that cache is set. The search binding now clears **only its own completed UISearchController presentation** on `didDismissSearchController`, after it is inactive and no longer presented by that Page. It leaves an active presentation and unrelated native modal untouched, does not replace navigation delegates, and does not patch installed dependencies. A focused regression test protects those ownership checks.

This is a narrowly scoped compatibility cleanup for the published Core lifecycle. The integration test keeps the search/return flow as its native oracle; unit stubs alone cannot validate UIKit appearance ordering. The sample delegates search dismissal to its page-visibility lifecycle rather than racing an explicit dismissal with a new push.

## Reproduce and interpret

See [`scripts/native/showcase`](../scripts/native/showcase/README.md), the [English walkthrough](../docs/guide/native-showcase.md) and [guia em português](../docs/pt-BR/guide/native-showcase.md). Generated XML, screenshots and raw reports remain under ignored `scripts/native/out`; videos in the guides/PR show real native builds. The optional probe does not ship in the package.

Native labels, focus-target declarations, restored page visibility and button alternatives are checked. Audible VoiceOver/TalkBack focus traversal/restoration, physical-device motion comfort, iPad layouts, orientation/large text and an iOS system Reduce Motion toggle remain manual/separate acceptance; Android's zero-animation run is not evidence for all of those. The default system motion policy and native transitions are used; no custom animation is introduced.

The example contains three fictional notes in memory. It does not claim persistence across process death, production-scale list virtualization or network storage. Large titles are UIKit on iOS; Android uses its normal Toolbar/SearchView, with no simulated collapsing header.
