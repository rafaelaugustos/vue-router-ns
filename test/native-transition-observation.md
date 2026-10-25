# Optional native-host observation — proposal v0

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

The six lifecycle-model tests pass: repeated completion, source/target invalidation, unload/unsubscribe with late callbacks, and subscriber failure. This does not establish actual native covered-target replacement or host unload during interaction. Modal inner Back, zoom recognizer discovery, optional/custom hosts, multiple windows and Android observation remain unverified by this adapter. Reduce Motion is not overridden; this normal-motion run is not physical-device accessibility evidence.

UIKit retains registered coordinator blocks until the transition releases them. Unsubscribe removes recognizer targets and the unload listener, invalidates the session, suppresses late delivery and releases the subscriber reference. It cannot unregister UIKit's already registered completion blocks. This bounded retention cost is part of the proposal, not hidden behind a dispose method.

## Decision

Keep the observer private to research. The signals are useful for diagnostics, but missing authoritative entry mapping and native lifetime coverage make a public adapter premature. #145 remains open for those gaps; they do not become release requirements for 0.1.0. No Jolt dependency, uniform progress/seek API, delegate replacement or router settlement change is added.

Generate the runner using `scripts/native/observation/project.rb`; `OBSERVATION_APP` selects its installed bundle ID. The recorded run used a separate local test ID, `org.nativescript.routerobservation`, to avoid replacing other demos. The checked-in demo keeps its original ID. Full commands and primary API references are in the proposal.
