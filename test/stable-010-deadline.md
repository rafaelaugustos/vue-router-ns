# Release gesture observation deadline

The first 0.1.0 [release gate](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/44376420258)
failed in the iPadOS 26.2 default-transition profile. Gesture-phase and programmatic
overlap profiles passed. Publication did not occur.

## Observed failure

In `commit-landscape`, XCTest spent 1.76 seconds waiting for SpringBoard before
synthesizing the touch. The fixture recorded native admission 2,298 ms after
arming, a 2,874 ms interaction, then a successful native commit. Interaction end
arrived 5,172 ms after arming, outside the old single five-second observation
window. No orientation request was sent. The next two tests could not arm their
observer because that scenario had not received its rotation request; those
failures were consequences of the first failure.

[The timestamp summary](./evidence/stable-010-deadline/hosted-failure.json) and
[raw hosted evidence](./evidence/stable-010-deadline/hosted-failure.zip) preserve this
failed execution. It is not counted as acceptance.

## Correction and controls

The default committed gesture now waits at most five seconds for native admission,
then at most five seconds for interaction end. The gesture-phase/cancellation
paths keep their existing observation point. Distances, velocities, hold times,
actual cancellation requirements and the assertion that rotation is requested
before navigation ends are unchanged. No interaction is retried.

A temporary [control patch](./evidence/stable-010-deadline/delayed-input-control.patch)
delays input by three seconds after starting observation. It is not part of the
shipped test or router. With the fix, committed interactions ended 6,182/6,516 ms
after arming in the two orientations, while native interaction itself took
2,886/3,109 ms. Rotation was requested about 418 ms before native navigation ended.
This exercises a real input delay beyond the old total budget while preserving
the required native timing relationship.

All three local executions passed four XCTest methods with zero failures/skips:
normal iPadOS 26.2, delayed-input iPadOS 26.2, and normal iPadOS 18.6. The 18.6 run
retains the existing two unobserved inset-gesture cases; it is not evidence that
those gestures became supported. [Local validation](./evidence/stable-010-deadline/local-validation.json)
verifies all nine recorded source hashes per run. The 26.2 runs began before the
commit and correctly report a dirty source tree; their hashes match the fixed
source, except for the explicit temporary delay in the control. Native XCTest
bundles remain local; the three archives retain JSON and native logs.

[The recording](../docs/public/media/stable-010-gesture-deadline.mp4) shows the normal
26.2 sequence with the final observer, without an injected delay. [Video metadata](./evidence/stable-010-deadline/video.json)
records the hash and playback conversion. The test-only correction does not change
the 0.1.0 package contents.

## Hosted runner availability

The same release also left iOS 18.6 jobs without runners. GitHub cancelled the
first UIKit Split row without executing a step, reporting “The job was not acquired
by Runner of type hosted even after multiple attempts” and macOS ARM64 capacity
constraints. That cancellation is separate from the XCTest deadline failure.

An Intel runner was evaluated with the same 18.6 runtime. It acquired a machine,
compiled the app and completed simulator boot, but its first app launch exceeded
the existing 30-second bound and was killed without stdout/stderr. No XCTest ran,
and no native result artifact was produced. The [retained job log](./evidence/stable-010-deadline/hosted-intel18.log.gz)
records that failure. The proposed Intel selection was withdrawn; all release
lanes keep their established ARM64 runner/runtime baseline. Missing runner
capacity remains a publication blocker, not passing acceptance.

## Separate hosted gesture observation failure

At source 101875d, [the focused run](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/44380621476)
failed in the first gesture-phase committed case, before exercising the corrected
default profile. That unchanged path recorded no native navigation coordinator;
the later cases then failed to arm. The cause is unconfirmed. The internal XCTest
recording shows the detail page, while the simultaneous simctl recording stays
on the root page. The latter is not evidence that the push failed. Neither
recording alone proves native touch delivery.

[Failure metadata](./evidence/stable-010-deadline/hosted-gesture-unobserved.json) and
[raw evidence, including both recordings](./evidence/stable-010-deadline/hosted-gesture-unobserved.zip)
retain this result. One same-commit rerun was requested for comparison after the
Intel sibling finished; it is not a waiver or a diagnosed fix for that failure.
The corrected default/content-Back profile is also being tested independently.
The full release gate still requires every applicable lane on the final main
commit before publication.
