# Native-host transition observation — proposal v0 (#145)

**Decision: keep this as research; do not add a public observer or animation adapter yet.** A passive UIKit Frame prototype can report interaction-end and terminal cancellation/commit without owning navigation. That does not establish continuous progress, authoritative entry identities, all modal/native hosts, or a cross-platform controller. No package export or Jolt dependency is added.

## Ownership and capability shape

A future host can independently advertise:

```ts
type ObservationCapabilitiesV0 = {
  version: 0
  admission: 'native-owned' | 'host-owned' | 'unknown'
  progress: 'native-callback' | 'unavailable'
  interactionEnd: 'observable' | 'unavailable'
  terminal: 'observable' | 'unavailable'
  entryIdentity: 'authoritative' | 'unavailable'
}
```

No capability implies seek, finish, cancel or veto methods. UIKit/Core retain gesture admission and presentation. The router retains guard decisions, logical history, result settlement and entry disposal. An observer must never call `router.back()` or complete a pending route result because a callback says “committed”.

Each event carries window, host and subscription-local session identity. Source/target **entry** identity is nullable when the host cannot map it authoritatively; route paths are not entry IDs. A null identity forbids applying an animation/side effect to a guessed page. A native transition outcome is distinct from router reconciliation and from an observer being interrupted.

`session.ts` defines `began` (progress explicitly null), `interaction-ended`, and exactly one `terminal` outcome: committed, cancelled or interrupted. Interaction-end is not terminal completion. Replacement, host unload or unsubscribe interrupts **observation**, never forces native cancellation. Late UIKit callbacks are ignored. Subscriber exceptions cannot escape into native navigation, and the listener reference is released at terminal delivery.

## UIKit Frame prototype

`frame-ios.ts` adds a target to the known native Back recognizers while subscribed. It does not replace their delegates, set `enabled`, install a recognizer, swizzle controllers or run a timer/display link. Gesture callbacks discover an initially interactive coordinator; interaction-change and transition-completion blocks then produce passive observations. Coordinator identity deduplicates registration. The prototype reports no continuous progress and never converts gesture translation into animation progress.

It removes every target and its Frame unload listener on disposal. UIKit has no matching unregister API for already registered coordinator blocks: those closures can remain until UIKit releases the transition; the ended session suppresses delivery and drops its subscriber reference. One target object and up to two target registrations per subscribed Frame, plus a bounded active session, are the integration cost. No subscription exists unless the fixture requests it.

The native runs exposed a real gap: `viewControllerForKey` returned null for both endpoints in the observed context. The prototype leaves those entry IDs null. Waiting for later gesture callbacks did not establish a reliable identity mapping. The tests do not invent IDs from the current path or silently claim that this solves host authority.

## Host matrix and limits

| Host / surface                                      | Current evidence                                                                                                                                  | Public-contract implication                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Core 9.1.3 iOS Frame, ordinary UIKit Back           | Native interaction-end and cancellation/commit observed; guard refusal starts no session; unsubscribe/source replacement exercised in the fixture | Passive diagnostic observation only; entry mapping remains unavailable                             |
| UIKit zoom transitions                              | Prior #136 investigation can observe coordinators through fixture polling; this subscription prototype does not discover every zoom recognizer    | Unsupported by this adapter; do not replace UIKit delegates to fill the gap                        |
| Modal inner Frame Back                              | Not validated by this single-root subscription fixture                                                                                            | A separate host/window identity and lifetime proof are required; no automatic modal coverage claim |
| Covered target replacement                          | Pure lifecycle model rejects late completion after target invalidation; actual native target replacement is not proved here                       | Host must provide an authoritative invalidation signal before public adapters can rely on it       |
| Host unload                                         | Prototype binds unload cleanup; unit model checks late callbacks; real native teardown during interaction remains a gap                           | Requires dedicated native coverage before claiming production lifecycle support                    |
| Published Core Android Frame                        | Existing router predictive-back callback reports its gesture, not a Core-owned Fragment transaction                                               | No native transition observation capability claimed by this iOS prototype                          |
| Upstream Android candidate                          | NativeScript/NativeScript#11558 remains a separate unpublished presentation-session prototype                                                     | Do not duplicate or require it; no claim that it ships in Core                                     |
| UIKit split/custom/external hosts and other windows | Unverified                                                                                                                                        | Explicitly unavailable until their owner supplies and validates the capability                     |

Reduce Motion remains system/native-owned. This code changes neither preference nor animation choice. Absence of a coordinator/recognized interactive Back means no observation, not synthetic progress. Standard noninteractive button navigation is outside this recognizer-specific prototype. A future observer must distinguish unavailable capability from a missed event; this is another reason not to export it now.

## Native and lifecycle checks

See [the native report](../../test/native-transition-observation.md). The fixture uses real reversing/committed gestures, guards and router results. Its delayed replacement/unsubscribe commands are test stimuli; the observer itself has no polling or timers. Unit checks cover duplicate terminal callbacks, source/target replacement, unload/unsubscribe and subscriber errors. No production module imports these research files.

```sh
npm ci
npm run build
npm test -- test/transition-observation.spec.ts
cd demo
npm ci
ns build ios --env.observationTest
```

The normal demo bundle ID is `org.nativescript.vuerouterns`; use a separate local ID when sharing a simulator/device with another app. The XCTest runner accepts `OBSERVATION_APP` when its project is generated. Generate it with `ruby scripts/native/observation/project.rb /tmp/observation-checks`, install the fixture, then run the `ObservationChecks` scheme on the selected simulator.

## Evidence needed before changing the decision

1. An authoritative entry-ID mapping and source/target invalidation contract from the native host.
2. Native modal inner Back, target replacement and host unload during interaction, including reconnection without duplicate subscriptions.
3. Explicit capability negotiation and unavailable-event semantics on published Android dependencies and optional hosts.
4. A real consumer need that existing diagnostics cannot satisfy. An optional Jolt adapter follows a supported ownership contract, not this prototype alone.

Related: #136 established ownership; #145 owns this proposal. These remaining gaps stay in #145 and are not added as 0.1.0 release requirements.

Primary references: [Apple interaction-change callback](<https://developer.apple.com/documentation/uikit/uiviewcontrollertransitioncoordinator/notifywheninteractionchanges(_:)>), [Apple transition completion](<https://developer.apple.com/documentation/uikit/uiviewcontrollertransitioncoordinator/animate(alongsidetransition:completion:)>), [Apple gesture target API](https://developer.apple.com/documentation/uikit/uigesturerecognizer), [upstream Android prototype](https://github.com/NativeScript/NativeScript/pull/11558).
