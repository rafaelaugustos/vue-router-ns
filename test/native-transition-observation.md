# Optional native-host observation — proposal v1

Related: #145 and #136. This is a research fixture and a decision record, not a package API. Core 9.1.3, NativeScript-Vue 3.1.2 and iOS runtime 9.1.0 remain unchanged. Read [the versioned proposal](../research/transition-observation/README.md) before treating an observation as a host capability.

## Native run, 2026-10-25

The final real-gesture XCTest passed on iPhone 17 / iOS 26.0 simulator in 56.760 s. [Recorded events](./evidence/transition-observation.json) retain the assertions and session events for each command:

- Reversed ordinary Back: native cancelled terminal, unchanged logical/native histories, result pending and page alive.
- Committed Back: native commit, histories synchronized, exactly one result and page disposal.
- Active leave guard: no observation session and no native/history movement; after allowing leave, Back commits once.
- Unsubscribe during an active native interaction: all added gesture targets removed; one interrupted observation terminal; late native completion produces no second delivery. Reversing the gesture still preserves the route/result, proving observer disposal does not own native cancellation.
- Current/source replacement requested while a native interaction is active: one interrupted observation terminal, no duplicate result and converged native/logical history.

The fixture recorded `interactive: true` at the unsubscribe and replacement stimuli; it does not infer that a timer happened to run during a gesture. The observer contains no timer or polling loop. The video records the actual application and reversing/committed gestures.

## Negative controls and uncovered claims

An earlier iPadOS 18.6 run received interaction-ended and cancelled completion events, but a stronger assertion that both coordinator endpoint controllers mapped to entry IDs failed. Both `viewControllerForKey` results were null. A second attempt waiting for populated endpoints did not establish an identity mapping. The final prototype therefore reports **null identities**, not guessed paths; the iPad run is not represented as a full passing matrix.

The expanded final suite passed **4 native cases, 0 failures, in 103.980 s** on the same iPhone 17 / iOS 26.0 simulator. [Lifecycle evidence](./evidence/transition-observation-lifecycle.json) records:

- Modal inner Back: cancellation preserves the modal stack; commit settles/disposes once and leaves the root Frame unchanged. Events carry the modal host ID.
- Actual Frame unload during interaction: all observer targets removed and exactly one `host-unloaded` terminal. Remount creates a working observer with a distinct session ID; cancellation still preserves the new page.
- Target invalidation during interaction: one interrupted terminal, then replacement after UIKit completion, old covered target removed, one result and converged histories.
- The original guard, cancellation, commit, unsubscribe and source-replacement checks passed again.

The direct concurrent target replacement attempt **failed**: `setStack` entered a native back transition but remained pending beyond the four-second post-gesture bound. Waiting for UIKit completion before replacement passed (12.695 s in the final suite). This is an explicit unsupported concurrency case, not a passing concurrent-mutation claim or a production fix.

Seven lifecycle-model tests cover repeated completion, source/target invalidation, unload/unsubscribe, subscriber failure and distinct IDs after reconnect. Zoom recognizer discovery, optional/custom hosts, multiple windows and Android observation remain outside this adapter's demonstrated capability. Reduce Motion is not overridden; this normal-motion run is not physical-device accessibility evidence.

UIKit retains registered coordinator blocks until the transition releases them. Unsubscribe removes recognizer targets and the unload listener, invalidates the session, suppresses late delivery and releases the subscriber reference. It cannot unregister UIKit's already registered completion blocks. This bounded retention cost is part of the proposal, not hidden behind a dispose method.

## Decision

Keep the observer private to research. The signals are useful for diagnostics, but missing authoritative entry mapping, unsupported concurrent target mutation and cross-host capability gaps make a public adapter premature. The versioned proposal, native evidence, negative controls and explicit decision complete the research scope of #145; unsupported capabilities do not become release requirements for 0.1.0. No Jolt dependency, uniform progress/seek API, delegate replacement or router settlement change is added.

Generate the runner using `scripts/native/observation/project.rb`; `OBSERVATION_APP` selects its installed bundle ID. The recorded run used a separate local test ID, `org.nativescript.routerobservation`, to avoid replacing other demos. The checked-in demo keeps its original ID. Full commands and primary API references are in the proposal.
