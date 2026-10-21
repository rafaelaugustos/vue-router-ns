# Native incoming-destination acceptance — #48

Validated on 2026-10-21 with published NativeScript Core 9.1.3, NativeScript-Vue 3.1.2, Android runtime 9.1.1 and iOS runtime 9.1.0. The fixture does not patch dependencies or replace native navigation callbacks. Local devices: Android API 34 emulator and iPad Pro M4 / iOS 18.6 simulator.

Reproduce with [the entrypoint fixture](../scripts/native/entrypoints/README.md). `Native contracts` runs it on Android API 34/36 and iPad iOS 18.6, preserving JSON reports, native histories, environment versions, screenshots and logs as workflow artifacts.

| Scenario                                | Native result                                                                                                                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cold URL into a previously unopened tab | The target tab loads; its Frame contains the initial settings page followed by the requested item. The home stack remains unchanged.                                                               |
| Warm authenticated destination          | The guard redirects to login; completing login replaces that page with the requested account route.                                                                                                |
| Modal URL                               | A native modal opens; back dismisses it without changing the underlying history.                                                                                                                   |
| Background URL and deliberate repeat    | Returning from the home screen opens the destination. Opening it again after back is accepted.                                                                                                     |
| Cold secondary window                   | Android creates a separate Activity/task; iPad creates a second UIWindowScene. The receiving router takes the initial request without waiting indefinitely or changing the first window's history. |
| Warm secondary window                   | Android's new intent and UIKit's user activity reach only that window's router. Android system back pops its destination and preserves the first window's histories.                               |

The automated TypeScript tests additionally cover scheme/host screening, malformed and percent-encoded URLs, application mapping errors, typed destinations, parent history, guards, restoration ordering, waiting for an unmounted host, Android history/recreation callbacks, iOS delegate/scene forwarding, preserving existing application handlers, provider delivery IDs, unmount/remount cleanup and `system: false`.

Website association remains app-owned: these tests validate custom-scheme OS delivery and native browsing activities, not domain ownership or a signed deployment's AASA/assetlinks setup. The English and Portuguese guides include reviewable association files and commands to verify an application's deployment. Full Activity recreation, scene reconnection and per-window persistence remain in #46; this fixture covers receiving links in live and newly created native windows.
