# Shared page actions validation — #133

2026-10-23. NativeScript Core 9.1.3, NativeScript-Vue 3.1.2, iOS runtime 9.1.0 and Android runtime 9.1.1.

## Contract and architecture

`usePageActions` owns a typed action registry for one routed page. `PageActionItem` renders a NativeScript ActionItem with a native Button as its actionView; `actions.menu()` supplies live state to the existing UIAction/PopupMenu adapters. NativeScript retains ActionBar, backAction and controller/delegate ownership. Keyboard reuse is opt-in through the existing `useNavigationCommands` registry.

One callback runs at a time per registry. Every adapter rechecks visibility, availability and ownership before admission. `execute` rejects failures; `dispatch` reports them once through onError (or logs in all builds). True means callback fulfillment, not navigation success. A guard-cancelled navigation can therefore fulfill; application code can inspect the router's result. Disposal/HMR aborts cooperative work, while ordinary tab changes or page/modal coverage only block new dispatch. Ignoring the signal cannot undo an application's side effects, and a genuine late failure remains observable.

Menu rebinding/unload/detach invalidates old action and preview-commit generations. Row reuse must supply a fresh options object; stable options permit live action-state updates without dismissing the menu. State watchers are released when the menu closes or its source is removed.

## Native evidence

Reproduction: [`scripts/native/page-actions`](../scripts/native/page-actions/README.md). Reports, native trees, screenshots and XCTest bundles are retained under `scripts/native/out` and uploaded by the full native workflow.

| Environment                   | Evidence                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| iPhone 16, iOS 18.6           | 21 bridge commands; two passing XCTest cases with native header/menu input, disabled state, localization, async error reporting, ordinary ActionItems, modal leave guards/results and menu-source rebinding. |
| Android API 36 phone emulator | 20 bridge commands plus real `adb input` and UIAutomator checks for the same header/menu state, errors, guards, modal result and rebinding.                                                                  |

Bridge checks cover repeated dispatch, actual UIButton/Android Button state, async completion/failure, originating stack selection, modal coverage, cooperative cancellation when a page is removed, actual NativeScript-Vue page-app HMR replacement, old registry rejection and inactive tabs. Native diagnostics remain free of consistency issues. The number of bridge snapshots varies with native presentation timing.

The iOS adapter explicitly synchronizes accessible role/state with Button.isEnabled and resets native properties with NativeScript's unsetValue. XCTest checks that busy/disabled controls expose disabled state and become usable again. Android PopupMenu disables its containing row, so the driver checks ancestor state rather than just the child TextView. Native menu input uses the menu collection view, avoiding ambiguity with an identically titled header button. Source rebinding is triggered while a real menu is open.

## Automated coverage and delivery

- 620 unit tests pass (10 skipped); package/demo type checks, package/docs builds, formatting and UI-driver shell checks pass.
- Unit coverage includes shared state, serial dispatch, errors (including late failures and throwing reporters), actual page-app HMR, page disposal, modal coverage, keyboard-registry reuse, guards/results, inactive tabs, originating stacks, independent NativeWindow owners/close and foreign source rejection.
- Context-menu tests cover live native state, stale action/preview callbacks, source disposal and synchronous/asynchronous callback error delivery.
- EN and pt-BR guides and API references document the adapters, cancellation and platform differences; the [native recording](../docs/public/media/page-actions.mp4) is embedded in both guides.
- `native-page-actions.yml` runs iOS and Android in the full/manual native suite. It is included in the full aggregate gate and skipped for pull requests; the fast PR check does not boot devices.

## Manual boundaries

Automated accessibility attributes and native hit testing are not a spoken VoiceOver/TalkBack certification. Audible announcements, hardware-keyboard traversal and physical assistive devices still require a manual pass. Keyboard action reuse and independent-window teardown are unit-tested; this fixture does not exercise simultaneous physical windows or hardware keyboard input. Existing keyboard/native-window contracts remain separate.

The listed simulators/emulator are the native evidence; iOS 13's no-live-update fallback and other OS versions have not been run for this change. Header actions use text Buttons and cannot appear in Android's overflow through this adapter. iOS menu symbols and destructive styling do not imply Android icon or destructive-color support. Application confirmation, permission handling and irreversible business operations are outside the router's contract. Long-running native memory profiling remains manual.
