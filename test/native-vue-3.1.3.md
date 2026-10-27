# NativeScript-Vue 3.1.3 acceptance

Validated on 2026-10-27, based on router commit `1e722be41ce0efa0ae3895c1d1060c64033a59cd` with only the dependency and documentation changes in this PR. Router version remains `0.1.0-rc.4`.

## Dependency scope

Development uses `nativescript-vue: ^3.1.3` with 3.1.3 in the root lockfile; the demo pins 3.1.3. The demo lockfile is generated locally and ignored by this repository. The public peer remains `^3.1.2`; the published RC.4 acceptance and pinned historical example/reproduction projects remain on 3.1.2.

[NativeScript-Vue #1187](https://github.com/nativescript-vue/nativescript-vue/pull/1187) incorporates Rafael's #1178 contribution and adds cleanup when a retained window closes after detach. It shipped in [3.1.3](https://github.com/nativescript-vue/nativescript-vue/releases/tag/v3.1.3). This changes the lifecycle of pages opened through `$navigateTo`. Router Frame pages already mount through public `createNativeView()` and retain their Vue app until their route entry or owner is disposed. That ownership, including HMR handling, is unchanged.

Both installed copies (root and demo) were compared with the official npm tarballs: all 73 Vue files and 1,362 Core files matched byte-for-byte, excluding `package.json` metadata. No Core preview, lifecycle transform or dependency source patch was used.

## Native results

Published Core **9.1.3**, NativeScript-Vue **3.1.3**, Android runtime **9.1.1**, iOS runtime **9.1.0**. Native builds used Node 20.19.4; unit tests used Node 22.23.3. The existing [window fixture and drivers](../scripts/native/windows/README.md) ran unchanged.

| Platform and mode                                      | Result                                                                                                                                                                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android API 36, application-owned reconstruction       | Passed: independent histories, guarded Back, modal results, actual process death and restored drafts/entry keys, OS link routing, Activity replacement, Back and another push, multi-window script HMR, complete cleanup and surviving-window launcher. |
| Android API 36, `RESTORE_TASKS=1`                      | Passed the same lifecycle checks while restoring the OS's original task records rather than opening replacement tasks.                                                                                                                                  |
| iPad Pro 11-inch M4, iPadOS 18.6, `RECONNECT_SCENES=1` | Passed: real UIKit disconnect/reconnect in the same process, original windows/Pages and Vue state, native controller history, guarded Back and pending result, reactive native text field, subsequent navigation, script HMR and closure.               |
| Same iPad, `RESTORE_SCENES=1`                          | Passed: different process with the original UIKit scene-session IDs and document/entry identities, independent drafts, multi-window script HMR, navigation and cleanup.                                                                                 |

Concrete lifecycle evidence:

- Android application reconstruction changed PID `2289` to `2432`; the later Activity replacement changed identity `112112` to `113430916` within PID `2432`.
- Android original-task restoration changed PID `2797` to `2895`; subsequent Activity replacement changed identity `214680964` to `6128112` within PID `2895`.
- iPad reconnect retained PID `77031` across `sceneDidDisconnect` and reconnection. The driver required the same session/window, a new scene object and the original retained Pages.
- iPad process restoration changed PID `78426` to `78772` while preserving both original scene-session IDs.

The reconnect driver injects a simulator-only helper to ask SpringBoard to disconnect a scene. UIKit delivers the actual lifecycle callbacks; the test does not manually call scene delegates. This is deterministic lifecycle testing, not natural memory-pressure or physical-device evidence.

## Automated checks

- Unit suite: **648 passed, 10 existing skips**, 51 files passed; no type-test errors.
- Package and demo TypeScript checks and package build passed.
- Android saved-state checkpoint parser: 3 tests passed.
- The first sandboxed unit run could not open Vite's local server and failed watcher tests. The complete unchanged suite passed outside the sandbox; no assertions or timeouts were relaxed.

Documentation build, locale parity (47 pages in four languages), formatting and native UI driver checks also passed. This is focused dependency acceptance, not a new release or a rerun of all release, physical-device, Vite HMR and accessibility gates. Script HMR here exercises Vue's native HMR runtime, not the Vite development server.

## Remaining boundaries

[Core #11591](https://github.com/NativeScript/NativeScript/issues/11591) reports stalled Frame navigation after programmatic `activity.recreate()` with Core 9.1.1. Our router fixture calls that method and passes with Core 9.1.3 / Vue 3.1.3 on API 36. This result does not establish that plain Core navigation, other API levels or Core 9.1.1 are fixed.

The Vue release does not include the independent Core corrections for [inherited CSS direction (#11587)](https://github.com/NativeScript/NativeScript/pull/11587) or [iOS native content Back (#11590)](https://github.com/NativeScript/NativeScript/pull/11590). Those remain separate upstream work. The router's multi-window API remains experimental.

## Reproduction and artifacts

Use the commands in the [window README](../scripts/native/windows/README.md) with the dependency versions above. Local output directories were `router-vue313-android`, `router-vue313-android-os-tasks`, `router-vue313-ios-reconnect` and `router-vue313-ios-restore` under `/tmp`. Each includes per-command JSON reports; the PR attachment retains those reports, package integrity results and validation logs. The PR video shows the actual native fixture, not a rendered simulation.
