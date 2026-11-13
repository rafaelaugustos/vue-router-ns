# Multi-window lifecycle acceptance — 2026-11-13

Multi-window remains **experimental**. This stage fixes resource retention when an
application keeps a closed router handle, and defines the tested subset instead of
promoting every native-window composition. No release is published.

Runtime and application fixture source: `7e4c558f65180e98a35a14dd48f103c2b134f0fc`.
The subsequent iPad UI-driver correction scopes commands to window B when both
windows are visible and activates the surviving app after closure; it does not
change the runtime or acceptance assertions. The
control uses the router from `993a2b7` with the isolated measurement fixture. No
NativeScript Core, NativeScript-Vue or platform runtime dependency is patched.

## Retention defect and measured correction

Closing a window removed its observers and unmounted its Vue page apps, but a
retained router still held cleanup closures. A closed stack's detacher captured
its Frame; the platform cleanup retained its Activity map. Android Core emits
window close before activityDestroyed, so unregistering that latter callback
could leave the closed Activity in the map indefinitely.

The router now deletes the detached-host closure, clears the Activity map and
consumes the platform cleanup list, then releases its platform/window/link stop
functions. Temporary detachment still retains the Pages, Vue state and pending
navigation results belonging to that live window.

| Measurement               | Closed windows | Retired Page objects after the fixed budget | Retired native Activities after the fixed budget |
| ------------------------- | -------------- | ------------------------------------------- | ------------------------------------------------ |
| Control, previous router  | 2              | 4                                           | 2                                                |
| Corrected router, batch 0 | 2              | 0                                           | 0                                                |
| Corrected router, batch 1 | 4 cumulative   | 0                                           | 0                                                |
| Corrected router, batch 2 | 6 cumulative   | 0                                           | 0                                                |

The [control](./evidence/window-lifecycle/control.json) fails the retention bound.
The [corrected recording run](./evidence/window-lifecycle/android-lifecycle.json)
retains all six closed router handles and passes it. Every window undergoes two
real Activity replacements, retaining both original Page identities and its pending
result, before closing during an asynchronous guard. All twelve page apps unmount
exactly once; each result completes once with undefined, and a late guard answer
cancels without modifying the surviving window. Global observer counts return to
the baseline: suspend 1, exit 3, Back 1, incoming intent 1 on this local run.

Each batch has **three fixed GC rounds**, with 300 ms before and after JS/ART
collection. The enforced bound is at most one retired Page and one native Activity
across all completed batches. Two transient Page wrappers remain during the first
two rounds of each corrected local batch and disappear in the third. The test
does not retry collection until a desired count appears. Native WeakReference
objects use ReferenceQueue; their get() method is never called. This is bounded
retention evidence for this fixture, not a universal heap-size guarantee.

The fixture creates persistence callbacks outside the Vue Session's lexical scope
and unsubscribes its temporary guard. Otherwise the measurement itself can retain
its Page array and Frame. Native listeners are observed through the published Core
9.1.4 global Observable registry, without replacing event methods. A preliminary
mock-only copied-listener race was discarded: Core already marks removed listener
entries and skips them during dispatch.

## Selected support matrix and limits

| Environment                                              | Exact dependencies                                        | Scope                                                                                                                                                                |
| -------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local Android 14 / API 34, ARM64 Pixel 7 emulator        | Core 9.1.4; NativeScript-Vue 3.1.3; Android runtime 9.1.1 | Application-owned process reconstruction, isolated links/results, real Activity replacement, HMR, six-window cleanup and creation after the original Activity closes |
| Local iPad Pro 13-inch M4 / iPadOS 18.6, ARM64 simulator | Core 9.1.4; NativeScript-Vue 3.1.3; iOS runtime 9.1.0     | Independent histories/modals, background resume, original scene-session reconstruction, one live disconnect/reconnect, HMR and closure                               |
| Hosted Android API 34/36 and iPadOS 18.6                 | Same published dependency pins                            | Results and timings are linked below; these rows are not a physical-device claim                                                                                     |
| Original Android task reconstruction                     | Adapter requires API 29+                                  | API 29 is an implementation floor, not certification of API 29–33; the selected Android acceptance floor is API 34                                                   |
| Android below API 29                                     | Original-task adapter unavailable                         | Application-owned reconstruction or a single-window fallback; no automatic restoration of original multiple tasks                                                    |

Local builds used Node 20.19.4, NativeScript webpack 5.0.41 / webpack 5.112.2.
Fast checks used Node 22.23.3. The existing Vue compiler/runtime patch-version
warning (3.5.44/3.5.45) was emitted; no dependency was modified to suppress it.

Physical Android, Stage Manager, external displays, active resize/rotation,
natural memory pressure and repeated iPad resource collection are **not certified**.
An explicit Activity recreation is not a physical rotation test. The iPad live
reconnect uses the existing simulator-only fault-injection bundle to ask the OS
for a real disconnection; it is distinct from background resume and process death.
The test-only private scene driver is not shipped in the router package.
[#188](https://github.com/rafaelaugustos/vue-router-ns/issues/188) tracks additional
iPad and window-management coverage. Physical hardware is not a generic issue-closing
or stability gate: simulator/emulator acceptance is valid for the documented subset.
Require hardware only for a selected behavior those environments cannot reproduce adequately.

Unit coverage additionally repeats four windows with three detach/attach cycles
each, then closes an already detached owner while a result and guard are pending.
That validates logical cleanup and callback bounds, not a native physical-device
closure-while-detached scenario. Applications remain responsible for their own
subscriptions, external references, incoming-document policy and content resolver.

Process death destroys JavaScript Promises and arbitrary native objects. The cold
scenarios reconstruct only persisted route identities and opt-in page state in a
new process. Live reconnection preserves the existing objects and pending results.

## Physical iPad acceptance

A connected **iPad Pro 11-inch (3rd generation), iPadOS 27.0 (24A5418b)** passed
`WindowUITests.testWindows` in **31.888 seconds**, one test and zero failures.
The [retained native reports](./evidence/window-lifecycle/physical-ipad.json)
confirm independent histories, guards, modal results, background resume, restored
draft/reactivity, HMR in both windows, subsequent navigation and permanent closure.
Closing B unmounts its Vue page apps, clears B's persisted snapshot and preserves
A's snapshot. All four command reports belong to the same application process.
This is one complete public-API lifecycle scenario, not repeated iPad heap or
forced scene-disconnection acceptance.

The unchanged application fixture was built with the published dependency pins
above, signed for development and installed with the isolated bundle identifier
`org.nativescript.vuerouterns.windows175` / display name `Router Windows175`.
Only the application identity, URL scheme, local signing settings and XCTest
target identifier differed from the normal fixture. No private simulator scene
probe was installed. Build time was 39.672 seconds, excluding initial setup.

The first physical attempt completed all native assertions, but closing a
foreground full-screen scene revealed SpringBoard. XCTest timed out querying
the background application's accessibility tree. The driver now checks that the
application has not exited and activates its surviving scene before reading the
Close acknowledgement. A fresh installation then passed the complete UI test;
the failed attempt is not counted as a passing XCTest run. The test also observed
an orientation change during preparation, but this is not a controlled rotation
matrix. Video capture was unavailable through the device command, and Rafael
explicitly waived a physical-device recording; the Android video remains available.

## CI and reproduction

Use the [window acceptance instructions](../scripts/native/windows/README.md).
Dispatch Native windows on the candidate branch; do not dispatch the full native
contract matrix for this focused change. The selected workflow builds once per
platform, retains Android API 34/36 and all three iPad modes, caches Gradle and
cancels superseded manual non-main branch runs. These changes do not skip any
window acceptance assertion.

ADB commands have a 20-second timeout with SIGKILL; APK installation has its own
90-second budget. Fixture report polling is bounded at 45 seconds. Local recorded
cleanup batches took 12.658, 12.976 and 12.228 seconds. These are fixture timings,
not whole-CI speedup claims.

[Hosted acceptance run](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43390806748)
uses the acceptance source above. Both Android jobs passed: API 34 in 456 seconds
(7m36s), API 36 in 454 seconds (7m34s). Their build steps took 125/124 seconds; the
emulator/acceptance steps took 264/270 seconds. These are complete job durations,
including both reconstruction modes and repeated cleanup. The jobs run in parallel.
No warm-cache speedup is claimed from this single run.

In that initial run, the ordinary iPad scenario passed. Cold restoration preserved
the original scene identities and passed HMR, but the Close tap did not reach the
fixture while two windows with identical button identifiers were visible. The
driver now selects the button inside window B explicitly. Live reconnect was
skipped in that failed hosted run and is not counted as a pass there.

[Hosted revalidation](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43394657045)
on `bc30be54a66701b543d9b10f5673df9cad83e226` passed **all three jobs**:
Android API 34 in **6m09s**, API 36 in **7m00s**, and the complete iPad job in
**9m25s**. All three iPad modes passed, including original scene restoration and
same-process reconnect. These are observed complete-job timings, not a general
CI performance guarantee.

The [iPad validation evidence](./evidence/window-lifecycle/ipad-validation.json)
retains the hosted command reports and all three local reruns of the final
driver, which additionally activates the surviving app after closure for
full-screen physical iPads. The physical run and final local simulator runs
validate that last driver adjustment; it is not presented as part of the earlier
hosted revision. Runtime and application fixture are unchanged throughout.

The [hosted Android evidence](./evidence/window-lifecycle/hosted-android.json)
retains original task IDs, entry identities, before/after process IDs and all
collection rounds from both modes on both APIs. All twelve batch endpoints are
zero retired Pages / zero Activities. Some API 36 batches retain four transient
Page wrappers in rounds 0/1; all disappear in round 2 within the unchanged budget.
The local original-task startup failure does not substitute for these hosted passes.

During investigation, an older local emulator profile exhibited system/app ANRs,
installation/startup timeouts and a background-activity-launch denial. It was
replaced with a clean dedicated profile. The fixture now foregrounds its source
window and skips only task records the OS removed between enumeration and lookup;
it still requires the target Activity to become foreground. A subsequent local
original-task run timed out during initial app launch, before restoration checks.
Those attempts are not counted as successful acceptance and no assertion was
relaxed to hide them.

Fast validation: 665 unit tests passed, 10 existing skips; root/demo typecheck,
package build, native helper checks, documentation structure and production build
(47 pages in four languages) passed. The production browser review on port 4178
passed localization, narrow layouts, native-navigation model interactions, keyboard
handling, reduced motion and server-rendered guide navigation.

## Actual application video

[Watch the Android lifecycle recording](../docs/public/media/window-lifecycle.mp4)
(38.4 seconds, 540×1200, re-encoded at original speed). It shows six successive secondary windows
opening their pending-result page, recreating their native Activities and closing
back to the surviving window. It records the real application throughout the
measured phase. Garbage collection is established by the accompanying JSON, not
by what is visible on screen.
