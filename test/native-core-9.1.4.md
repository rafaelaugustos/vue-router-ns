# Published Core 9.1.4 acceptance — 2026-11-13

This checkout adopts **published `@nativescript/core@9.1.4`**. The package's Core peer and development requirement become `^9.1.4`; the demo pins 9.1.4 and the current file-routing consumer/lockfile uses `~9.1.4`. Applications pinned to 9.1.3 must update Core and their lockfile. The NativeScript-Vue peer remains `^3.1.2`, and the demo remains on 3.1.3. The router version is unchanged; no release is published by this work.

Source baseline: `b142ff6e8ceded3ae4fd7c27f947be34429e832c`, plus this PR's dependency/documentation changes. No router runtime module changes. The historical rc.3 consumer and inherited-direction reproduction remain pinned to their original dependencies; the new reproduction runs used an isolated copy with only Core changed to 9.1.4.

## Upstream changes and integrity

[Core 9.1.4](https://github.com/NativeScript/NativeScript/releases/tag/9.1.4-core) includes:

- [#11587](https://github.com/NativeScript/NativeScript/pull/11587): retain lazy controller loading during layout invalidation, addressing the inherited-direction investigation in router #139.
- [#11590](https://github.com/NativeScript/NativeScript/pull/11590): preserve native content Back for default Frame navigation, relevant to router #168.
- [#11552](https://github.com/NativeScript/NativeScript/pull/11552): open another Android window after the original Activity finishes.
- [#11640](https://github.com/NativeScript/NativeScript/pull/11640): resume Frame navigation after early Activity attachment.

All **1,362 Core files** in each of the root, demo, direction and content-Back installations matched the official npm tarball byte-for-byte, excluding installation metadata in `package.json`. [Integrity record](./evidence/core-9.1.4/core-integrity.json). No candidate Core, dependency source transform or installed-source patch was used. The router's existing scoped restoration adapters remain in place; this update does not establish that plain Core alone implements every router lifecycle guarantee.

## Native results

Native builds used Node 20.19.4, Android runtime 9.1.1 and iOS runtime 9.1.0. Devices were dedicated simulators/emulators; there is no new physical-device acceptance claim.

| Scenario                                        | Published dependencies and platform                              | Result                                                                                                                                                                                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Android application-owned window reconstruction | Core 9.1.4 / Vue 3.1.3; API 36 arm64                             | Passed: independent histories, guards/results, real process death, saved entries/drafts, OS link routing, Activity recreation, script HMR, closure and opening a third window from the surviving Activity.                                                   |
| Android original-task restoration               | Same; `RESTORE_TASKS=1`                                          | Passed the same checks while resuming the original OS tasks.                                                                                                                                                                                                 |
| iPad window isolation/background resume         | Core 9.1.4 / Vue 3.1.3; iPad Pro 11-inch M4, iPadOS 18.6         | Passed independent histories/modal results, reactive input, script HMR and complete closure.                                                                                                                                                                 |
| Same-process UIKit disconnect/reconnect         | Same; `RECONNECT_SCENES=1`                                       | Passed actual UIKit disconnect/reconnect, retained Pages/Vue apps and controller history, pending guarded result, recreated text-field reactivity, subsequent navigation and cleanup.                                                                        |
| UIKit scene restoration after process death     | Same; `RESTORE_SCENES=1`                                         | Passed a different process with original scene-session/document/entry identities, drafts, HMR, navigation and cleanup.                                                                                                                                       |
| Core startup/layout regression                  | Core 9.1.4; same iPadOS 18.6 simulator                           | Three XCTest cases passed: prebuilt control, prebuilt inherited LTR and prebuilt `requestLayout()`. Each types into a native field, reverses Back without losing the draft and completes Back.                                                               |
| NativeScript-Vue direction control              | Core 9.1.4 / Vue 3.1.2; same iPadOS 18.6 simulator               | Both ordinary and inherited-LTR cases passed the keyboard/reversed/committed Back flow.                                                                                                                                                                      |
| Published router direction control              | Core 9.1.4 / Vue 3.1.2 / router rc.3; same iPadOS 18.6 simulator | Three cases passed: ordinary, inherited LTR and inherited LTR under tabs, each with native typing and cancelled/committed Back.                                                                                                                              |
| Native content-Back controls                    | Core 9.1.4; iPad Pro 11-inch M4, iPadOS 26.0                     | Twelve observations passed: two Core Frame configurations and ten UIKit delegate controls. Both full-width and inset Core Frames return by native gesture. Custom-animation UIKit controls retain the documented unavailable gesture and usable header Back. |

Concrete process evidence: Android application reconstruction changed PID **5522 → 5673**; original-task restoration changed **6004 → 6111**. iPad same-process reconnect retained **86059**; cold scene restoration changed **92043 → 93166**. The retained command reports include native/logical histories, stable entry keys, checks and cleanup counts. [Window reports and XCTest summaries](./evidence/core-9.1.4/). Repeated diagnostic event streams were omitted from these compact report copies; their assertions and identity/state fields are retained.

The scene-disconnection helper is the existing simulator-only fault-injection bundle. This is real UIKit lifecycle delivery, not natural memory pressure or physical iPad evidence. A normal background-resume pass is recorded separately from actual disconnection and cold restoration.

## Reproduction

Use the unchanged [window drivers](../scripts/native/windows/README.md) against this checkout's built demo. Run the ordinary iPad mode, `RECONNECT_SCENES=1` and `RESTORE_SCENES=1` in separate fresh output directories. On Android, run both application-owned reconstruction and `RESTORE_TASKS=1` on the explicitly selected dedicated emulator.

For #139, copy `examples/ios-direction-repro` outside the checkout, change its exact Core dependency to `9.1.4`, install dependencies and run its resource preparation. Do **not** run `core-layout-patch.mjs`. Build the default Core entry, `--env.vue` and `--env.router` separately; reinstall between entries. Generate `DirectionChecks.xcodeproj` with `scripts/native/direction/project.rb` and select:

- Core: `testPrebuiltControl`, `testPrebuiltLTR`, `testPrebuiltRequestLayout`.
- Vue: `testControl`, `testInheritedLTR`.
- Router: `testControl`, `testInheritedLTR`, `testTabsLTR`.

The deliberate `testPrebuiltLoadView` negative control explicitly forces early native view loading and is outside the correction; it was not rerun or silently counted as passing. The Vue/router entries do not emit the Core-only `direction.json`; their XCTest summaries are the evidence.

The content-Back controls come from [PR #170's fixture at `b0fa617`](https://github.com/rafaelaugustos/vue-router-ns/tree/b0fa617755105e21e636088560a80bb066c6f36e/scripts/native/backedge), in a separate checkout. Apply with `git apply --unidiff-zero` the [small acceptance adjustment](./evidence/core-9.1.4/backedge-published-core.patch): use published Core 9.1.4 / Vue 3.1.3, expect the inset Core gesture on iPadOS 26, and tolerate an initially absent fixture during uninstall. Build `--env.backedgeTest` and run its native driver. The UIKit control expectations are unchanged. This PR does not merge or replace the open investigation PR.

## Video

[Watch the actual iPadOS 26 recording](../docs/public/media/core-914-back.mp4): two consecutive Core-only launches show Root → Detail → native gesture Back, first at full width and then in the inset content area. This is an excerpt at original speed, rotated and scaled for viewing. The inset case demonstrates the published upstream correction. It does not demonstrate a custom interactive-transition API, multi-window stress testing or rotation during a gesture.

## Package and documentation checks

- 661 unit tests passed, with 10 existing skips; Node 22.23.3. Typecheck and package build passed.
- A local tarball passed fresh install, `npm ci`, export checks and route generation for explicit-route, webpack and Vite consumers with Core 9.1.4, Node 20.19.4 / npm 10.8.2. The Vite case uses the documented existing-lockfile workaround for npm 10.
- The current file-routing example's updated lockfile passed `npm ci`; generated Android route types and typecheck passed.
- Documentation checks and production build passed: 47 pages in each of four languages, shared examples, links/anchors, UI keys and the diagnostics viewer.

These local checks do not replace every Node/npm or hosted native release-matrix row. The demo build resolved NativeScript webpack 5.0.41 / webpack 5.112.2; the historical direction control retains webpack 5.0.38 / webpack 5.111.1. NativeScript-Vue's compiler/runtime patch-version warning appeared in the demo build; the builds and native checks completed.

## Boundaries and follow-ups

- Multi-window and NativeHost remain experimental. Stability criteria and independent adapter acceptance are tracked in [#175](https://github.com/rafaelaugustos/vue-router-ns/issues/175) and [#176](https://github.com/rafaelaugustos/vue-router-ns/issues/176), including repeated resource retention checks and explicit hardware/Stage Manager boundaries.
- The new content-Back control runs on iPadOS 26. The earlier iPadOS 18 screen-edge limitation is retained as historical evidence. No new active-rotation acceptance is claimed; #167/#168 still own that gap.
- The November 9 hosted full matrix passed its window lanes but failed iOS Vite launch and foldable overlay-state acceptance. [#183](https://github.com/rafaelaugustos/vue-router-ns/issues/183) records those distinct failures. This focused update does not close that issue or certify the full matrix.
- Shared interactive transitions/Jolt, richer history, preloading, diagnostic replay, drag/drop and navigation intents are separately scoped in #177–#182. None is implemented or made a stable-release requirement by this dependency update.
