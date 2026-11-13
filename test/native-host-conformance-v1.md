# NativeHost conformance v1 — 2026-11-13

NativeHost remains **experimental, contract version 1**. This stage validates an
independently packaged iOS adapter, fixes lifecycle defects exposed by external
hosts, and publishes an optional conformance runner. It does not promote Android
adapters, arbitrary native containers or transition observation/control to stable.

Runtime, adapter, harness and native fixture source:
`359fcdb58c1f9dd9f3641c130cc11ac6d57e7fb2`. The evidence/documentation commit adds
the recording and reports without changing that tested implementation.

## Router corrections and control

The [17 lifecycle tests](./host-lifecycle.spec.ts) run against the previous source
`54013746c55d6771140424dcdbbb7e8e46edfa12` fail **15 cases** and pass the two existing
completion-order checks. The same tests pass all 17 cases with this change. The
[control summary](./evidence/native-host-conformance-v1/regressions.json) identifies
every case; a fresh archived source tree uses the same tests and installed tools.

The corrections cover stale unmount closures after same-name replacement;
external root closure and held dismissal; named-host capability selection;
rollback of failed Back results; cancellation of pending adapter promises on
owner closure; partial attach and throwing-dispose cleanup; external-close
afterEach notification; and required methods for declared capabilities. Owner
teardown never delivers an uncommitted Back result. A native owner-close callback
during page Back cancels its tentative result; acknowledgement of a requested
whole-host close still delivers the result. Lifecycle waiters are removed
after each navigation, so a long-lived host does not accumulate promise reactions.

Navigation waits for native acknowledgement and the returned method promise.
Rejecting after native mutation/acknowledgement is outside the atomic failure
contract: the router cannot undo arbitrary native changes. Hosts must reject
before mutation, or acknowledge success and resolve. A cancelled native gesture
does not change the committed page order.

## Independently packed adapter

[`examples/native-host-adapter`](../examples/native-host-adapter) builds against
the candidate router tarball and exports its own Frame implementation. It uses
documented root exports, owns its Vue views and imports no router internals or
built-in host factory. A second package, the [native consumer](../examples/native-host-app),
installs both tarballs without repository source aliases. Package hashes and
sizes are retained in [the native evidence](./evidence/native-host-conformance-v1/ios.json).

The opt-in `vue-router-ns/testing/native-host` entry exports the framework-free
runner, fixture/report types and `NATIVE_HOST_CONFORMANCE_VERSION = 1`. It adds no
Vitest or Node dependency to an app. The root entry does not import the harness.
Reports retain skipped probes and failures; a negative unit fixture that never
acknowledges a native pop must fail within its timeout.

## Native acceptance and recording

Published dependencies: Core **9.1.4**, NativeScript-Vue **3.1.3**, Vue runtime
**3.5.45**, iOS runtime **9.1.0**. Target: **iPad Pro 13-inch (M4) simulator, iOS
18.6**, Xcode **27.0 (27A266a)** on Apple silicon. No dependency was patched.
Native packaging/build ran with Node 20.19.4; repository tests used Node 22.23.3.

XCTest passed in **39.920 seconds**, zero failures. All **nine native command
reports passed**. The public harness passed **13 checks** and explicitly skipped
held dismissal because this reference adapter does not declare that capability.

| Native case                         | Checked outcome                                                                                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initially unloaded host             | Loading reveals the queued first Page and its live host handle.                                                                                      |
| Push, Back, replace, clearHistory   | Native/logical history and retained Page identity reconcile; departed Vue apps unmount.                                                              |
| Native Back cancelled               | UIKit recognizer progress is measured; both Pages, Vue apps and pending result remain.                                                               |
| Guard-blocked native Back           | No recognizer progress, history change or result delivery.                                                                                           |
| Native Back committed               | Measured UIKit progress; root Page retained, departed app unmounted, result settled once.                                                            |
| Temporary unload/reload             | Native parent navigation covers and reveals the retained owner Page; Page/Vue identity survives and subsequent navigation has two UIKit controllers. |
| Owner closure                       | Both pending results have settled once; all three destination apps have exactly one unmount, native handle is null, and logical history is empty.    |
| Late callbacks and repeated unmount | No resurrected stack, duplicate result, Vue lifecycle error or reconciliation issue.                                                                 |

[Actual simulator recording](../docs/public/media/native-host-conformance.mp4):
43.42 seconds at original speed, H.264, 1032 × 1376. It shows the harness, reversed
swipe, guard-blocked swipe, committed Back, temporary unload/reload and final
disposal. The video starts on the dedicated simulator's launcher. No UI or native
transition is composited; counters and recognizer measurements are in the JSON
evidence. This is simulator footage, not a physical-device recording.

Investigative runs exposed two fixture issues, neither counted as a pass: removing
a Frame from its parent destroys its native controller in Core, so temporary
unloading must use a retained native owner; and leaving the harness's route
definitions installed caused the next phase's root to use the previous component,
invalidating its lifetime counter. The final fixture removes those routes and
records each destination instance's setup/unmount pair. Permanent parent removal
requires owner teardown and a fresh Frame/adapter, as documented in the example.

## Compatibility and maintenance decision

No required public type member or contract version changes. Existing conforming
adapters retain version 1. Declaring cancellableDismissal without holdDismissal,
or multipleVisible without visible, now fails before attachment; implement the
required method or declare the capability false. Optional diagnostic methods,
presentation hints and Back preview remain optional. No observation/progress/Jolt
integration is required by this contract or harness.

Changes to required members or completion semantics require a contract-version
bump and migration notes. Keep the public types, versioned harness, packed
consumer, native driver and four guide translations aligned. The focused workflow
runs portable package checks on relevant PRs and provides a manual/weekly iOS
lane. Local native acceptance is recorded here; hosted results are separate.

Remaining limits: this adapter does not support Android, modal owner closure,
held modal dismissal, pinned roots, multiple visible pages or script HMR. Native
hardware, process death, repeated garbage collection, accessibility, rotation and
additional OS/container combinations were not tested in this stage. Passing an
independent adapter is useful evidence, not a stable API commitment.

## Other validation

The initial [hosted native attempt](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43415426661)
stopped before running the app: Ruby project generation exceeded its 30-second
limit after cold simulator startup. Driver/workflow commit `3a5eac1` prepares and
builds XCTest before boot, with a separate three-minute preparation budget. The
native execution budgets and assertions are unchanged. Its prepared-project path
also passed locally in **39.823 seconds**, with all nine command reports passing.
The [hosted retry](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43416569975)
passed XCTest preparation, then exceeded the 30-second app-installation budget
before running tests. Commit `2ef25cd` allows three minutes for that setup step,
without changing navigation timeouts or assertions. The
[following run](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43420069788)
tracks hosted acceptance separately. The final local run above tests source
`359fcdb` and the prepared-project path.

- **685 tests passed**, 10 existing skips, across 55 files; no type errors.
- Root types/build, independent adapter build and packed consumer typecheck passed.
- Formatting, patch whitespace, native shell helpers and driver syntax passed.
- Four-locale documentation build passed; [browser evidence](./evidence/native-host-conformance-v1/documentation.json)
  covers the existing site, reduced motion, translated guide links, local search
  and the NativeHost guide at phone width.

No merge, release or following roadmap stage is part of this delivery.
