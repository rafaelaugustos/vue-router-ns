# NativeWindow routing validation — 2026-10-15

## Latest acceptance — 2026-10-22, after RC integration

The branch incorporates `main` at `9696e6a` (RC.1); workflow and changelog merge conflicts are resolved. Published dependencies remain Core 9.1.3 / NativeScript-Vue 3.1.2.

**Android original-task restoration now passes.** On Android 14/API 34, `RESTORE_TASKS=1` killed PID 6009 and restored into PID 6150. Both original task IDs, document keys and per-entry identities survived. B retained its native window ID; Core can assign a new native ID to the first Activity, so the application persists document keys instead. Separate drafts, duplicate-path history, OS link ownership, real Activity recreation, multi-window script HMR, disposal and the surviving-Activity launcher all passed (`windows-os-restored-clean`).

The router registers public Android 29+ Activity lifecycle callbacks for owned windows. A saved-bundle marker distinguishes previous-process restoration from same-process recreation. Before AndroidX reconstructs obsolete Fragments, the compatibility observer removes known FragmentManager/Core root identifiers from marked previous-process bundles. It preserves application/window metadata, ActivityResult state and unrelated saved-state providers. Unmarked/foreign Activities and same-process recreation remain untouched. Six regression tests cover the scope, state preservation and observer cleanup. No dependency files are patched. Android below API 29 retains application-owned reconstruction; automatic multiple-task reconstruction is unsupported there.

A fresh run after `pm clear` initially hit an ActivityTaskManager cleanup race: Android killed the newly launched process with `remove task` before JS started. The driver now waits for the previous fixture Activities to disappear before launching. That failed launch is not counted as a router pass.

**UIKit cold session reconstruction now passes.** The final `RESTORE_SCENES=1` iPadOS 18.6 run kills the verified fixture process on a dedicated simulator. PID 9904 became 10002, and UIKit connected **B before A**. Both documents retained their original UIKit scene IDs and stable entry keys; their distinct drafts, back navigation, multi-window HMR and permanent closure passed (`windows-ios-cold-final`). The fixture persists each scene ID's application document key and resolves that mapping before using the primary flag. The driver explicitly rejects swapped documents or replacement sessions. Because B became the new process's primary window, closure uses UIKit's public session-destruction request; Core's `NativeWindow.close()` refuses primary windows. B's page apps and snapshot were released while A's state remained intact.

CI requires the two Android reconstruction modes on API 34/36, plus both iPad background-resume and cold-session reconstruction. The cold iPad driver uses two separate XCTest invocations around process death. Test artifacts distinguish these cases.

**Still pending:** OS-driven iPad scene disconnect/reconnect **within the same live process**. The cold-restoration report has `processRestoration: true` and no same-process disconnect events; it is not relabeled as a retained-scene reconnect pass. PR #65 remains draft until that separate acceptance is established or its scope is explicitly reconsidered. These simulator/emulator results do not claim physical-device validation.

Local automated validation after the Android correction: 552 tests passed, 10 existing skips; typecheck passed. The later CI run must validate the final committed revision; prior green runs belong to earlier revisions.

Hosted CI on `ecf3510` passed both Android reconstruction modes on API 34 and 36, the iPad isolation/background-resume baseline, and all other native jobs except the cold iPad and foldable checks. The cold iPad check correctly rejected a same-PID result: restarting SpringBoard alone did not terminate the app on that runner, and no scene disconnect occurred. The foldable lane separately failed downloading the Android Emulator archive, before building or executing the fixture.

The corrected cold driver verifies the fixture PID against the dedicated simulator's launch service, then sends `SIGKILL` to that process without restarting SpringBoard. A graceful-termination attempt discarded/replaced session records and was rejected. Before waiting for router readiness, the fixture locates both original `UISceneSession` objects in `UIApplication.openSessions` and activates only those not connected yet. Activations are serialized; redundant concurrent activation requests disrupted XCTest access. Missing sessions fail immediately; passing null to create new windows is forbidden. The resolver also reuses A's public RouterView ref: `app.start()` already mounted its Vue tree, so mounting it again when B arrived first was incorrect. This models reopening the saved windows and keeps all original-session assertions intact.

Follow-up for [#46](https://github.com/rafaelaugustos/vue-router-ns/issues/46). The implementation chooses **one router per NativeWindow**, preserving the existing per-router matching, guards, result handling and navigation queue. A global router with window-qualified names was considered but would have required every operation and callback to carry a window discriminator.

## Public contract

- `createRouter({ routes, window })`; omitted ownership is inferred from a mounted view's `getNativeWindow()`.
- `router.window`: readonly owner ref. One window cannot be claimed by two routers, and a router cannot mount views in two windows.
- `router.openWindow(to, { data })` resolves a typed destination and forwards it through the native window-opening API. The app supplies content using `getWindowRoute(request.data)` in its content resolver.
- Scoped persistence receives `RestoreContext` with native `windowId` and an application `key`; snapshots carry `windowKey` and mismatches are ignored. NativeWindow APIs are feature-gated so legacy single-window code remains supported.

## Environments and evidence

NativeScript core/runtime 9.1.1, NativeScript-Vue 3.1.2, Android 15/API 35 arm64 emulator, iPad Pro 11-inch (M5) simulator on iPadOS 26.5. Temporary instrumentation used the demo's existing message/compose routes, a window content resolver and inspector snapshots of the route, logical history and actual Frame back stack. Android used `launchMode="standard"`; iPad enabled multiple scenes.

| Scenario                                                        | Result                                                                                                                                                                                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open a typed message route in a second Activity and UIKit scene | Passed; the first window retained its independent history.                                                                                                                                                                                  |
| Android system back in each foreground task                     | Passed; the other window did not pop. Test switched native tasks before invoking each Activity's dispatcher. Dispatching back to a stopped Activity is not a valid simulation of user input because lifecycle-bound callbacks are disabled. |
| Android back blocked by a guard in one window                   | Passed; both logical and native history remained in that window, with the other unchanged.                                                                                                                                                  |
| Two simultaneous compose modals                                 | Passed on Android and iPad; results `A` and `B` returned independently, and closing A's modal left B's modal open.                                                                                                                          |
| Close the secondary UIKit scene                                 | Passed; the original scene remained and the closed router was torn down. Scene destruction completes asynchronously.                                                                                                                        |
| Android Activity recreation on published NativeScript-Vue 3.1.2 | Reproduced a framework bug: apparent history survived until back, then logical history became empty while native history still contained a page.                                                                                            |
| Android Activity recreation with NativeScript-Vue PR #1178      | Passed; confirmed a replacement Activity, preserved both window histories, then back and another push worked in the reconstructed window.                                                                                                   |

## Framework boundaries found

NativeScript core 9.1 sends a copied back event to NativeWindow before dispatching the original event on Application.android. Cancelling the window copy does not cancel the original. The router observes the original cancelable event and filters by the owning window/Activity; gesture callbacks remain attached to the owning dispatcher. The shim now mirrors the copied-event ordering.

NativeScript-Vue immediately unmounted page apps on native-view disposal, including temporary native surface teardown. [Upstream PR #1178](https://github.com/nativescript-vue/nativescript-vue/pull/1178) defers cleanup until Frame history settles and preserves apps whose page/window are retained. The correction passed its 74 tests, typecheck/build, and the real Android recreation scenario above. This dependency is **not** vendored into vue-router-ns or silently patched in installed packages. Reconnection support needs the upstream fix to become available.

Closing the original Android Activity exposed another core issue: subsequent `Application.openWindow()` could target an undeclared hard-coded Activity class when `startActivity` was gone. Reported as [NativeScript #11526](https://github.com/NativeScript/NativeScript/issues/11526). The route request forwards native API errors; this experimental integration does not claim to repair the platform launcher.

## Automated coverage and limits

The router suite checks owner-specific back/guards/gesture progress, independent modal result settlement, detach/attach callback cleanup, stable persistence keys, snapshot mismatches, typed route handoff, unique window ownership and fallback when NativeWindow APIs are absent. The NativeScript-Vue fix adds regression coverage for retained page reactivity, real disposal after pop, window closure and root replacement.

No physical-device pass, OS-driven iOS scene reconnection, or full process-death multi-scene restoration was performed for this feature. Direct invocation of UIKit scene delegate callbacks was explored as a diagnostic and failed on return/back with a missing native transition owner (`_transition` on null). A root reported attached while its native Frame UI was unloaded. This diagnostic is not equivalent to an OS disconnect; iOS scene resumption remains unverified and must not be marked complete. OS-originated link receipt remains #48; per-entry UI-state serialization remains #49. The application must reuse an existing window root/router during reconnect, compose its content resolver with other integrations, and choose fresh-route versus saved-history precedence explicitly.

## Historical integration and Android acceptance — 2026-10-21

The draft has been integrated with `main` through beta.14: native host adapters, tabs, reduced motion, version-2 entry/page state, diagnostics and incoming links. Native elements now explicitly allow registration by another router app; the process-wide NativeScript-Vue registry otherwise threw `RouterUIKitSplitHost already registered` while opening the second window. The test shim enforces the real duplicate-registration contract. Frame and split back ownership is window-scoped, and an unbound globally prioritized Frame falls back to this window's focused stack.

Incoming Android intents and iOS scene URL/activity/shortcut events are filtered by their owner. UIKit's forwarded application delegate cannot repeat a scene event into other routers. Automatically inferred primary windows use a stable snapshot key instead of the changing native ID, preserving existing single-window stores across process death. The key is captured once so primary-window promotion does not switch stores. Closing the window removes link listeners, disables retained delegate closures, settles results and cannot overwrite the snapshot it just cleared. Initial secondary-window URLs still need explicit handoff from the application-owned content resolver because Core emits the initial event before that resolver creates its router.

The [repeatable fixture and driver](../scripts/native/windows/README.md) run on an Android 14 / API 34 arm64 emulator with Core 9.1.3, Android runtime 9.1.1 and NativeScript-Vue 3.1.2. The installed Vue navigation, bootstrap and runtime helper files were compared byte-for-byte with the public npm 3.1.2 tarball. No installed package was patched.

| Scenario                                                                             | Published dependencies                                                                | Diagnostic PR #1178 control                                |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Two native windows, independent histories, guarded back                              | Pass                                                                                  | Pass                                                       |
| Two simultaneous modal results; closing A leaves B open                              | Pass                                                                                  | Pass                                                       |
| Genuine process death and application-owned reconstruction with stable document keys | Pass                                                                                  | Pass                                                       |
| Duplicate-path drafts in A, independent draft in B, stable entry keys                | Pass                                                                                  | Pass                                                       |
| Android-delivered `ACTION_VIEW` into B leaves A unchanged                            | Pass                                                                                  | Pass                                                       |
| Activity replacement, back and retained Vue reactivity                               | **Fails**: B's logical stack becomes empty while its native Frame still has two pages | Pass; retained page updates and a subsequent push succeeds |
| Permanent B closure clears only B's snapshot                                         | Not claimed after the failed recreation                                               | Pass                                                       |

The control is an explicit fixture-only webpack transform of the disposal change from NativeScript-Vue #1178 at `e31806b7fed28cd4b4aa3af3f564492b43ecba91`. It is not part of the router package, is never enabled in the normal demo, and does not turn that unpublished dependency into supported functionality. CI runs both builds and requires the published variant to reproduce the exact known failure rather than accepting an arbitrary exception.

Validation: 520 tests passed with 10 existing skips; package/demo typechecks, package build, docs build and formatting passed. The new `Native windows (experimental)` lane records per-command snapshots, original/replacement Activity identities, old/new PIDs and logcat, alongside the existing native contract lanes.

Single-window regression acceptance also passed: the Android state fixture recovered duplicate drafts/scroll and five compatibility scenarios across six genuine process deaths. On an iPadOS 18.6 simulator, UIKit split navigation, guards, modals and restoration into a new process passed. The split run first exposed an integration regression: initial column-layout callbacks saved empty histories before the window-scoped restore could read the previous snapshot. Persistence now waits for the initial read to settle; a unit test covers callbacks both before and during an asynchronous load. This single-window iOS pass does not establish scene reconnect support.

### Remaining at that revision (superseded below)

- The lifecycle correction must be available in a supported dependency and pass this suite without the diagnostic transform.
- OS-driven iOS scene disconnect/reconnect is still unverified. No manual delegate invocation is counted as an OS reconnect.
- The process-death test demonstrates **application-owned reconstruction into new native windows**. Automatic restoration of Android's existing task records and iOS scene sessions is not claimed.
- Core's open-window behavior after the original Activity finishes still depends on NativeScript #11552 / issue #11526; this new fixture does not cover that launcher scenario.
- Native iOS link delivery and cold secondary-window handoff remain broader #48 acceptance work. iOS event ownership has automated unit coverage here.

The draft and issue remain open. These Android passes advance #49's multi-window validation but do not constitute a released, supported multi-window backend.

## Router-owned lifecycle and launcher — 2026-10-22

The draft now incorporates main through beta.15. Frame destinations mount through NativeScript-Vue's public `createNativeView()` API. The router retains the Vue app until the entry is removed after native completion, or its host/window closes. Native view disposal during Activity recreation does not unmount a retained entry. A public context reload callback retains native Page replacement and defers covered-page script reload until the Frame completes returning to it. No private Vue runtime is patched.

A bound Android router builds an explicit Intent from its live owning Activity class, with Core's window flags and `Utils.dataSerialize()` payloads. It can open another route window after the original Activity finishes, without the fallback class involved in Core #11526. Direct `Application.openWindow()` calls are unaffected.

Local Android 14/API 34 acceptance passed with published Core 9.1.3, Android runtime 9.1.1 and NativeScript-Vue 3.1.2:

- Two independent histories, guards and simultaneous modal results.
- Actual process death and application-owned reconstruction with distinct drafts and stable entry identities.
- OS-delivered link scoped to B.
- A replacement Activity with every retained Vue page still mounted; back, reactivity and subsequent navigation pass.
- Closing B releases every mounted page app and clears only B's snapshot.
- Finishing the original Activity, then opening C through B's router, creates a new native window with the requested typed destination and preserves B's history.

Artifacts: `scripts/native/out/windows-launcher-fixed/{process,recreate,close,launcher}.json`. The first launcher fixture incorrectly called `NativeWindow.close()` on the primary window, which Core deliberately refuses. The corrected fixture calls the original Activity's public `finish()` and requires its actual closure before opening C. That initial fixture failure is not a passing launcher test.

Actual Vite 8.0.20 HMR passed on iPhone 17 / iOS 26 and Android 14 / API 34: 24 native setup/watch checks per platform, plus template identity/setup/draft checks. Android passed on a freshly booted test emulator (`windows-owned-vite-android-retry`). The initial Android HMR attempt failed before app validation because `adb logcat` timed out against the long-running test emulator; no Android HMR pass is attributed to that attempt.

The iPad Pro 11-inch (M4), iPadOS 18.6 baseline passed window isolation, guarded back, independent modal results, background resume with retained draft/reactivity, and complete page cleanup on secondary-window closure. `windows-owned-ipad-settled/scene-coverage.json` records zero disconnects before resume: this is not a reconnect pass. The first fixture requested focus before the newly created scene became foreground-active and timed out in XCTest; the corrected fixture waits for UIKit activation before navigating/switching scenes.

An additional native `__VUE_HMR_RUNTIME__.reload()` check passed with two windows on both Android and iPad (`windows-with-hmr/hmr.json`, `windows-with-hmr-ipad/hmr.json`). Each window applied a fresh page setup while retaining its logical history, and subsequent push/back and complete window disposal passed. This exercises script HMR through Vue’s actual runtime independently of the Vite template edit.

Unit coverage adds retained reactivity/disposal, deferred covered reload, removal while reload is pending, live-Activity intent ownership and rejection of destroyed Activities. The test shim's legacy `$navigateTo` keeps the published immediate-disposal behavior; it no longer simulates the unpublished upstream fix. Native CI now requires the supported lifecycle and launcher scenarios on API 34 and 36, without the old diagnostic transform.

Still open: OS-driven iPad scene disconnect/reconnect and automatic reconstruction of OS-owned task/session records. Apple's [scene lifecycle documentation](<https://developer.apple.com/documentation/uikit/uiscenedelegate/scenediddisconnect(_:)>) distinguishes scene disconnection from switching apps. The new iPad baseline records native scene events so foreground/background or window destruction cannot be mistaken for reconnection. This work removes the two demonstrated Android upstream dependencies for router-owned operations; it does not establish all #46 or #49 acceptance.

### OS-owned Android tasks: concrete remaining failure

A stricter API 34 run (`windows-os-tasks`) killed PID 6159 and restored PID 6325 by resuming the OS's original task records. Primary task 91 restored its history. Resuming secondary task 92 emitted Core errors `Cannot find Frame for NO ENTRY` from Fragment `onCreate`, followed by `Cannot read properties of undefined (reading 'resolvedPage')` from `onResume`. The secondary content resolver did not establish its router. Reopening document B created task 93, which the driver correctly rejected because it was not original task 92. No OS-task restoration pass is claimed.

Inspection of published Core 9.1.3 `ui/frame/index.android.js`, `ActivityCallbacksImplementation.onCreate`, explains the boundary: `isRestart` uses the process-wide `moduleLoaded` flag before calling the superclass with saved state. After A initializes the new runtime, restoring B passes its old Fragment state even though B's JavaScript Frame history died with the process. This happens before window content resolution. A separate correction is needed; the router-owned page lifecycle and live-Activity launcher do not alter that Core path. The retained `RESTORE_TASKS=1` diagnostic now also requires B's resolver session before attempting any state assertions, preventing an app-created replacement window from hiding the failure.

### Regression checks after adopting router-owned mounting

The first native CI found a popped Page retained by the completed navigation callback. The disposer now clears its Page and Vue-view references after removing the registry entry and before unmounting. A local iPadOS 18.6 contract run (`windows-retention-fixed`) passed every functional scenario; all four measured batches ended with **zero JavaScript Pages** and one transient native controller after the same three collection rounds. This is local retention evidence, not an iPhone CI timing-baseline verdict: the baseline validator correctly refuses to compare different simulator models. No baseline or collection threshold was relaxed.

Android system-picker acceptance now requires the pending result to survive a genuine Activity replacement with the retained page, complete exactly once, and still cancel on actual page/owner disposal. All 12 native outcomes passed on API 34 (`windows-flow-retained-retry`). The driver explicitly delivers commands to the existing top Activity, including when the window fixture previously selected standard launch mode.

The iPad fixture preparation writes a multiple-scene manifest and disables full-screen-only operation through a plist parser, including for newly scaffolded resources. It no longer depends on replacing an existing XML element with one exact spelling.

The initial hosted Vite/iOS run failed fetching the first module from the runner's LAN address before any navigation checks. The simulator-only CI lane now sets the supported `NS_HMR_HOST=127.0.0.1` override; physical-device/default host selection is unchanged. A green rerun is required before counting hosted HMR validation.
