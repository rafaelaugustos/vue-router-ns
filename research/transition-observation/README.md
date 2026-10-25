# Native-host transition observation — proposal v1 (#145)

**Decision: keep this as research; do not add a public observer or animation adapter yet.** A passive UIKit Frame prototype can report interaction-end and terminal cancellation/commit without owning navigation. That does not establish continuous progress, authoritative entry identities, all modal/native hosts, or a cross-platform controller. No package export or Jolt dependency is added.

## Ownership and capability shape

A future host can independently advertise:

```ts
type ObservationCapabilitiesV1 = {
  version: 1
  admission: 'native-owned' | 'host-owned' | 'unknown'
  progress: 'native-callback' | 'unavailable'
  interactionEnd: 'observable' | 'unavailable'
  terminal: 'observable' | 'unavailable'
  entryIdentity: 'authoritative' | 'unavailable'
}
```

No capability implies seek, finish, cancel or veto methods. UIKit/Core retain gesture admission and presentation. The router retains guard decisions, logical history, result settlement and entry disposal. An observer must never call `router.back()` or complete a pending route result because a callback says “committed”.

Each event carries window, host and subscription-distinct session identity (including reconnects). Source/target **entry** identity is nullable when the host cannot map it authoritatively; route paths are not entry IDs. A null identity forbids applying an animation/side effect to a guessed page. A native transition outcome is distinct from router reconciliation and from an observer being interrupted.

`session.ts` defines `began` (progress explicitly null), `interaction-ended`, and exactly one `terminal` outcome: committed, cancelled or interrupted. Interaction-end is not terminal completion. Replacement, host unload or unsubscribe interrupts **observation**, never forces native cancellation. Late UIKit callbacks are ignored. Subscriber exceptions cannot escape into native navigation, and the listener reference is released at terminal delivery.

## UIKit Frame prototype

`frame-ios.ts` adds a target to the known native Back recognizers while subscribed. It does not replace their delegates, set `enabled`, install a recognizer, swizzle controllers or run a timer/display link. Gesture callbacks discover an initially interactive coordinator; interaction-change and transition-completion blocks then produce passive observations. Coordinator identity deduplicates registration. The prototype reports no continuous progress and never converts gesture translation into animation progress.

It removes every target and its Frame unload listener on disposal. UIKit has no matching unregister API for already registered coordinator blocks: those closures can remain until UIKit releases the transition; the ended session suppresses delivery and drops its subscriber reference. One target object and up to two target registrations per subscribed Frame, plus a bounded active session, are the integration cost. No subscription exists unless the fixture requests it.

The native runs exposed a real gap: `viewControllerForKey` returned null for both endpoints in the observed context. The prototype leaves those entry IDs null. Waiting for later gesture callbacks did not establish a reliable identity mapping. The tests do not invent IDs from the current path or silently claim that this solves host authority.

## Host matrix and limits

| Host / surface                                      | Current evidence                                                                                                                                  | Public-contract implication                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Core 9.1.3 iOS Frame, ordinary UIKit Back           | Native interaction-end and cancellation/commit observed; guard refusal starts no session; unsubscribe/source replacement exercised in the fixture | Passive diagnostic observation only; entry mapping remains unavailable                                                |
| UIKit zoom transitions                              | Prior #136 investigation can observe coordinators through fixture polling; this subscription prototype does not discover every zoom recognizer    | Unsupported by this adapter; do not replace UIKit delegates to fill the gap                                           |
| Modal inner Frame Back                              | Real reversed/committed Back passed in a separate modal Frame; root history stayed unchanged                                                      | Separate host IDs and disposal checked; this does not prove other windows or custom modal presenters                  |
| Covered target replacement                          | Invalidation during real interaction, then covered target replacement deferred until UIKit completion; one terminal and one result                | Concurrent setStack during reversal did not settle in the negative control; no concurrent mutation capability claimed |
| Host unload                                         | Real Frame removal during interaction and remount passed; targets removed, host-unloaded terminal once, new session identity on reconnect         | Evidence is limited to this Frame fixture; every optional host must prove its own lifetime contract                   |
| Published Core Android Frame                        | Existing router predictive-back callback reports its gesture, not a Core-owned Fragment transaction                                               | No native transition observation capability claimed by this iOS prototype                                             |
| Upstream Android candidate                          | NativeScript/NativeScript#11558 remains a separate unpublished presentation-session prototype                                                     | Do not duplicate or require it; no claim that it ships in Core                                                        |
| UIKit split/custom/external hosts and other windows | Unverified                                                                                                                                        | Explicitly unavailable until their owner supplies and validates the capability                                        |

Reduce Motion remains system/native-owned. This code changes neither preference nor animation choice. Absence of a coordinator/recognized interactive Back means no observation, not synthetic progress. Standard noninteractive button navigation is outside this recognizer-specific prototype. A future observer must distinguish unavailable capability from a missed event; this is another reason not to export it now.

## Native and lifecycle checks

See [the native report](../../test/native-transition-observation.md). The fixture uses real reversing/committed gestures, guards and router results. Its delayed replacement/unsubscribe commands are test stimuli; the observer itself has no polling or timers. Unit checks cover duplicate terminal callbacks, source/target replacement, unload/unsubscribe and subscriber errors. No production module imports these research files.

```sh
npm ci
npm run build
npm test -- test/transition-observation.spec.ts
cd demo
npm install
ns build ios --env.observationTest
```

The normal demo bundle ID is `org.nativescript.vuerouterns`; use a separate local ID when sharing a simulator/device with another app. The XCTest runner accepts `OBSERVATION_APP` when its project is generated. Generate it with `ruby scripts/native/observation/project.rb /tmp/observation-checks`, install the fixture, then run the `ObservationChecks` scheme on the selected simulator.

## Evidence needed before changing the decision

1. An authoritative entry-ID mapping and source/target invalidation contract from the native host.
2. An owner-supported contract for concurrent target mutation. The passing fixture defers mutation until UIKit finishes; the direct concurrent request stalled. Modal inner Back and host unload/reconnect now have native evidence for this specific Frame host.
3. Explicit capability negotiation and unavailable-event semantics on published Android dependencies and optional hosts.
4. A real consumer need that existing diagnostics cannot satisfy. An optional Jolt adapter follows a supported ownership contract, not this prototype alone.

Related: #136 established ownership; #145 owns this proposal. The v1 decision completes the scoped #145 investigation: no public observer/adapter is warranted now. The unsupported capabilities above are explicit limits, not implemented APIs or additional 0.1.0 release requirements. Reopening a public-adapter proposal requires the evidence listed above.

Primary references: [Apple interaction-change callback](<https://developer.apple.com/documentation/uikit/uiviewcontrollertransitioncoordinator/notifywheninteractionchanges(_:)>), [Apple transition completion](<https://developer.apple.com/documentation/uikit/uiviewcontrollertransitioncoordinator/animate(alongsidetransition:completion:)>), [Apple gesture target API](https://developer.apple.com/documentation/uikit/uigesturerecognizer), [upstream Android prototype](https://github.com/NativeScript/NativeScript/pull/11558).

## v1 lifecycle findings

Four native XCTest cases passed on iOS 26.0 (103.980 s), with seven lifecycle-model tests. Session IDs now include a subscription generation, so reconnecting the same host cannot reuse an earlier session ID. Frame unload reports `host-unloaded`; teardown drops its subscriber reference and gesture target callback as well as registrations. A subscriber disposing during the synchronous began delivery cannot leave an active session. UIKit still retains registered completion blocks until native completion; disposal cannot unregister those blocks.

The target negative control is material: a `setStack` request made during actual reversal entered a native back transition and did not settle within four seconds after the gesture. The passing test invalidates observation during the interaction, waits for the native completion, and only then replaces the stack. It proves late-delivery suppression and subsequent target replacement, **not safe arbitrary mutation of a covered controller during interaction**. These are research fixtures, outside required release CI.
