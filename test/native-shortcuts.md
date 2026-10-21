# Native shortcuts and system-search acceptance — #58

Validated on 2026-10-21 with published NativeScript Core 9.1.3, NativeScript-Vue 3.1.2, Android runtime 9.1.1 and iOS runtime 9.1.0. Local devices: Android API 34 emulator and iPad Pro M4 / iOS 18.6 simulator. Reproduce with [the entrypoint fixture](../scripts/native/entrypoints/README.md); the same fixture is included in the required native CI lanes.

## Android launcher

The driver opens the actual launcher menu and taps its shortcuts. It does not substitute `am start` for shortcut acceptance.

- Dynamic version-2 named-route shortcuts launch while the app is running and after force-stop. Changing the route's path preserves an existing shortcut; removing the named destination leaves the current page unchanged.
- A static XML shortcut uses the explicit Java entry Activity example. Both cold and warm taps reach the login guard; a warm tap preserves the application's process and existing task.
- Pinning opens the real launcher confirmation. After confirmation, tapping the pinned icon opens its route. Sign-out disables the pinned copy, verified through the native shortcut service, and removes dynamic entries.
- Incoming destinations are also exercised in two native tasks with independent histories; TypeScript tests cover shortcut payload delivery to the receiving window.

## iOS SpringBoard and Spotlight

XCTest long-presses the actual SpringBoard icon and taps quick actions on cold and warm starts. It verifies the renamed path, login redirect, deleted route, and removal of dynamic quick actions on sign-out.

The separate optional system-search module indexes an explicitly selected public item with Core Spotlight. XCTest opens Spotlight, searches for the title, selects the app's actual result, and verifies that the resulting native user activity passes through the login guard to the account destination. The fixture then removes its index. Search placement outside this controlled test is determined by iOS, not guaranteed by this API.

This complete Spotlight flow passed locally on iPadOS 18.6, including a fresh simulator and an HMR-enabled build. Hosted macOS 15 / Xcode 16.4 simulators repeatedly left the indexing completion pending. An [independent Swift control](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/39614307325) reproduced the same 120-second timeout without using the router or its JS bridge; that control passed locally in four seconds. The XCTest now probes the native service directly before testing the integration. Unavailable indexing or a timed-out Swift probe produces an explicit availability skip; once the probe succeeds, any failure in the router's indexing, search activation or authentication still fails the test. `native-capabilities.json` records `passed`, `skipped`, `failed` or `not-run`. A skipped CI run is **not** Spotlight acceptance evidence; the full local run supplies that evidence. Links, launcher/quick actions and windows remain mandatory in CI.

## Contract coverage and boundaries

TypeScript tests cover version-1 compatibility, malformed/unsupported payloads, stable named routes, native limits (including Android's shared static quota), rejected updates, pin capability/requests, disabled pinned copies, foreign quick actions, existing delegate callbacks, window ownership, selected-content indexing/removal and native error propagation. Search identifiers contain content IDs, not route params; the resolver handles renamed/deleted or unauthorized content.

Platform resources and the Java Activity are explicit app integrations. No upstream Core/Vue patch is required for these entrypoints. Widget UI, Siri/App Intents, automatic route indexing and full window lifecycle restoration are outside these issues' scope.
