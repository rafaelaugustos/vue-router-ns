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

The required release workflows select `macos-15-intel` for iOS 18.6, retaining
`macos-26` for iPadOS 26.2. Devices, runtimes, cases, deadlines and assertions are
unchanged by this runner selection. The focused Intel job acquired a runner at
19:36 UTC; its native results remain separate from runner availability. The published [runner image inventory](https://github.com/actions/runner-images/blob/main/README.md)
and [Intel image](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-Readme.md)
list this label and the same 18.6 runtime. Hosted acceptance must prove availability
and compatibility; an image listing alone is not a passing native test. The full
release gate still requires every applicable lane on the final main commit.
