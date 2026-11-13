# Explicit intent window policy — #182 stage 4

Validated on 2026-11-13 from PR200 merge `8ed5bb4` plus this implementation.
[Source hashes](./evidence/intent-window-policy-stage4/sources.json) identify the
example, tests, native fixture, driver and recording. #182 remains open for
additional native transports and the remaining acceptance matrix.

The [copyable application recipe](../examples/intent-windows/README.md) composes
existing intent and window APIs. Applications explicitly choose reuse, activation
or creation, then append/reset and saved/fresh history. The registry, account
binding and native ports belong to the app. No package runtime API changes or
global owner registry are introduced.

## Native evidence

The fixture runs published Core 9.1.4, NativeScript-Vue 3.1.3 and iOS runtime 9.1.0
on a dedicated iPad iOS 18.6 simulator with Xcode 27.2, without dependency patches.
See the [environment](./evidence/intent-window-policy-stage4/environment.json) and
[eleven reports](./evidence/intent-window-policy-stage4/ios18.json).

| Action         | Observed behavior                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| Create saved B | Native creation, scoped snapshot load, then append the destination.                                    |
| Repeat         | Same delivery returns `repeat` without another allocation or activation.                               |
| Reuse B        | Navigate B without requesting activation; A remains unchanged.                                         |
| Activate A/B   | Explicit UIKit session requests, observed foreground activation and navigation in each selected owner. |
| Reset B        | Only B's native/logical history is replaced.                                                           |
| Wrong owner    | An intent asserting A cannot be delivered to B or activate it.                                         |
| Create fresh C | Skip C's seeded old snapshot and append to its public initial route.                                   |
| Close B        | Activate then close B; stale B delivery has no fallback or new allocation.                             |
| Guard refusal  | Ordinary guard rejects C's reset before clearing its history.                                          |
| Dispose        | A later request cannot create, activate or navigate a window.                                          |

Every report compares native/logical stacks, checks distinct native identities and
retains A's exact original Page and unsent draft. The driver verifies exactly two
allocations and final owners A/C. New-scene metadata contains an app key and unique
request token; abandoned arrivals cannot replace newer owners. Creation, readiness
and activation waits are bounded. The source scene is taken from the actual UI
action, independently of the selected destination owner.

The [actual native video](../docs/public/media/intent-window-policy.mp4) shows the
application creating separate scenes and applying these policies. Its H.264
encoding preserves every source frame and relative presentation timestamp; see
the [video metadata](./evidence/intent-window-policy-stage4/video.json).
Reproduce with the [driver](../scripts/native/intent-windows/README.md). Full local
reports, XCTest results and source recording remain under ignored
`scripts/native/out/windowpolicy182-activation/`.

## Validation

- **860 tests passed**, with 10 existing skips. Seventeen new cases exercise the
  recipe with real router instances and the unit native shims: validation before
  native work, explicit selection, saved/fresh/reset, bounded pending/recent
  deliveries, duplicate creation, same-key contention, owner changes, expiry,
  account disposal, guards and native errors.
- A negative control removed the post-activation ownership check. Disposal and
  registry-replacement regressions failed; restoring the check passed without
  changing assertions. This is unit evidence for those races, not a native race
  injection.
- Runtime and fixture typechecks, package/native builds, driver syntax checks and
  formatting pass. The package runtime is unchanged; packed-consumer acceptance
  from previous stages is not rerun or claimed here.
- Four-locale parity/build and browser checks cover the new window-policy anchor,
  language links, narrow layout, search, video playback and reduced motion. The
  existing documentation browser suite also passes.

## Boundaries

The saved histories are seeded, controlled snapshots, not process-death recovery.
Reuse is exercised in a visible scene. Activation observes native foreground state
after a UIKit request; multiple scenes can remain active, so it does not certify
system keyboard focus. The fixture activates B before closing it. An exploratory
background-close attempt timed out; this stage does not fix or certify that path.
An earlier activation run left A inactive and failed. The final fixture supplies
the requesting scene, waits for stable activation before navigating and passes
the same native assertions. This does not establish an OS-level root cause.

Delivery scope/id pairs are bounded in memory per account-session policy instance,
including refused attempts. They are not durable exactly-once delivery. Apps own
recipient verification, authorization, native resources and cleanup. Disposal
invalidates pending acquisition/activation handoffs; it cannot roll back OS work,
committed navigation or requests already inside the router's asynchronous guards.
Normal guards and explicit login suspension remain necessary.

This stage does not establish Android activation, physical-device behavior,
Stage Manager, external displays, natural memory pressure, persisted suspended
requests, native shortcut/Spotlight entrypoints or release-wide acceptance.
