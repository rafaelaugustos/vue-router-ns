# Native flow validation — #54

The dedicated `--env.flowsTest` NativeScript fixture and runners live in
`scripts/native/flows-android.mjs` and `scripts/native/ios-flows`. They drive the
platform document picker, not a JavaScript replacement. See the
[native test instructions](../scripts/native/README.md#system-pickers-and-native-flows).

## Environment

2026-10-19: NativeScript Core 9.1.3, NativeScript-Vue 3.1.2, Android runtime 9.1.1
and iOS runtime 9.1.0. Local targets are Android 16 / API 36 on the dedicated
RouterFold60CI emulator, and iPhone 17 / iOS 26 simulator with Xcode 27.0.
These results do not claim physical-device or independent-window restoration coverage.

## Contract tests

441 tests pass, 8 are skipped; 13 tests cover native flows. They check typed
success/cancellation, one/multiple URIs, guards, concurrent/replaced attempts,
late callbacks, owning Activity isolation, buffered AndroidX results after
recreation without relaunch, owner destruction, support/launch/parser/cleanup
errors, latest asynchronous invocation ownership, and synchronous UIKit
presentation reservation. Build, router/demo type checks and documentation build pass.

## Native acceptance

The Android runner checks selection/cancellation, guards, rotation, two concurrent
requests, page disposal, presentation from a modal, explicit Activity recreation,
a late result, process death while DocumentsUI owns the foreground, a fresh flow
after restart and owner Activity closure. It writes actual URI outcomes, process
IDs, screenshots, hierarchies and runtime logs to `scripts/native/out/flows-android`.

The six XCTest cases check real file selection, cancellation/guard refusal,
simultaneous presentation refusal, a modal presenter, parent disposal, and process
restart with an application-owned pending marker. Screenshots and native test
results are retained in the `.xcresult` bundle. The fixture asserts that system UI
itself never changes router history.

Final local runner results and CI links are recorded in the implementation PR.
The `Native flows` workflow runs both platforms on pull requests affecting this
contract and can also be dispatched manually.

## Lifecycle and recovery boundaries

- Ordinary rotation can be handled by the existing Activity. It is not proof of
  Activity recreation; the runner separately calls `Activity.recreate()` and
  compares actual owner identities.
- On NativeScript-Vue 3.1.2, explicit recreation disposes the originating Vue page.
  The correct outcome is `cancelled/disposed`, once. A late result is ignored.
  AndroidX registration rebinding for a retained owner/attempt is separately
  covered by contract tests; this does not promise Vue page retention.
- Android process-death acceptance kills only the debug app's process while the
  external picker remains open, retains its task, and verifies a different PID on
  return. iOS XCTest terminates/relaunches the app with the picker open. Neither
  restores the old Promise: the app detects its saved marker and starts a fresh flow.
- UIKit has one presentation slot per window. A simultaneous second document
  picker reports `failed` explicitly; it cannot leave an unresolved Promise.
- URI strings identify selected documents. Persistable Android permissions,
  security-scoped iOS URL access/bookmarks, and reading/copying data remain the
  application or custom adapter's responsibility.
