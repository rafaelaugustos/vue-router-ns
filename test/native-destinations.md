# Native destination acceptance — #53

The optional `defineNativeDestination()` prototype embeds a UIKit controller or
AndroidX Fragment as the child of a routed NativeScript Page. The SDK supplies
its own UI; Vue supplies the Page container and the existing router supplies
history, guards, results and reconciliation.

## Reproduce

```sh
npm ci
npm run build
cd demo
npm install
ns build ios --emulator --env.destinationsTest
ns build android --env.destinationsTest
cd ..
IOS_SIMULATOR=<dedicated-simulator> node scripts/native/destinations.mjs ios
ANDROID_SERIAL=<dedicated-emulator> node scripts/native/destinations.mjs android
```

The iOS driver requires Ruby's `xcodeproj` gem and Xcode. The runner reinstalls
only `org.nativescript.vuerouterns` on the selected test device, clearing that
fixture's data. Native resources must be scaffolded as for the other demo suites.
Artifacts are written under `scripts/native/out/destinations-*`.

The required Native contracts workflow runs this fixture on Android API 34 and
36 and on the iOS 18.6 simulator, alongside the existing regression suites.

## Local evidence, 2026-10-20

Stock dependencies: NativeScript Core 9.1.3, NativeScript-Vue 3.1.2, Android
runtime 9.1.1, iOS runtime 9.1.0. No patches to installed dependencies.

| Platform                              | Evidence                                                                                                                                                                                                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iPhone simulator, iOS 18.6            | Native UIKit buttons exercise typed completion, cancellation, controller navigation pop, SDK child removal and modal result. XCTest drives the actual left-edge back gesture. Process termination/relaunch reconstructs the native destination from its saved route. |
| Android emulator, Android 16 / API 36 | Actual AndroidX Fragment UI exercises completion, cancellation, Frame back, self-removal through its FragmentManager and modal result. ADB sends system Back. Background process death preserves the task and reconstructs the route in a new PID.                   |

Both platforms check:

- Vue → native → Vue, correct input and result, and `undefined` on cancellation.
- A leave guard refuses completion; subsequent cancellation does not return the
  rejected result.
- Returning from a covering Vue page retains the native route's input.
- Parent/controller ownership is removed before SDK cleanup; creation and
  disposal counts balance after each round trip.
- Native weak references (UIKit `NSHashTable`, Java `WeakReference`) are empty
  after repeated push/cancel cycles and garbage collection. The fixture keeps
  no strong native-object registry.
- Restoring `/native/restore` invokes a fresh platform factory with `id=restore`
  in a new process. The saved history contains route identity and entry keys,
  not a controller, Fragment, callback or result Promise.
- Router diagnostics report no logical/native history disagreement.

The iOS run records process IDs `37986 → 38336`; the driver writes the process
IDs and termination method for every run in `restart.json`. Android attempts
`am kill` after backgrounding; if the OS keeps that process above its cached
threshold, the runner may use `run-as` to kill only the verified fixture PID.
It checks that the old process is gone before relaunching; force-stop/data
clearing are not used as process-restoration evidence.

## Regression coverage and findings

Twelve unit contract cases cover exactly-once results, guarded cancellation,
external/native back, reconstruction, unsupported platforms, factory failure,
attachment rollback, late callbacks after native-view recreation, replacement/
clearHistory, SDK cleanup errors and a queued destination whose host unmounts
before showing it. They use a container stand-in and do not
claim to prove native containment.

The native weak-reference check initially detected retention of the first
controller through a callback class defined inside its factory's lexical scope.
Native callback classes now live outside per-instance scopes; the same pattern
is used by the Fragment lifecycle listener. The fixture verifies collection,
not just that a cleanup callback ran.

The initial Android 14 CI run exposed a fixture collection-method error:
`System.gc()` did not request ART collection there. The fixture now uses the
same fixed three-round JS/`Runtime.gc()` protocol as the existing native
contracts. A `ReferenceQueue` counts collected Fragments without obtaining new
strong bridge wrappers through `WeakReference.get()`. Per-round counts are
included in the reports; the final required retained count remains zero.

## Explicit limits

- This is the interoperability prototype requested by #53. UIKit controllers
  and AndroidX Fragments are children of a Page, not arbitrary replacements for
  NativeScript's Frame implementation.
- SDK completion/cancellation requests run guards. Irreversible SDK removals do
  not: the adapter cannot veto already committed native navigation. A UIKit SDK
  that removes its own child must report that via `context.dismissed()`; native
  UINavigationController pops and Android Fragment removals are observed.
- A nonmodal root has no previous page to close to. Callback requests from
  covered/disposed entries are ignored. Use the visible destination's context.
- Serializing an SDK's private UI state, independent-window scene restoration
  (#46), and arbitrary SDK-internal navigation stacks are not promised.
- SwiftUI/Compose and vendor binaries may require compiled Swift/Kotlin
  wrappers and app dependencies; the prototype examples use UIKit/AndroidX.
- No physical-device, accessibility speech or universal SDK compatibility claim
  is inferred from these simulator/emulator checks.
