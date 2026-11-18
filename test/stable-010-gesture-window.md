# Gesture orientation delivery window

The [release iPadOS 26.2 job](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/44393013369/job/135118900163)
passed its three XCTest methods but failed the native gesture-phase acceptance.
In `cancel-landscape`, the observed interactive coordinator lasted 149 ms and the
orientation notification reached the app 162 ms after the interaction decision.
In `cancel-portrait`, the observed interaction lasted 246 ms and the request itself
was already late. The unchanged native assertions correctly rejected both cases.
[Failure metadata](./evidence/stable-010-gesture-window/hosted-failure.json),
[raw evidence](./evidence/stable-010-gesture-window/hosted-failure.zip) and the
[job log](./evidence/stable-010-gesture-window/hosted-failure.log.gz) retain this run.
This differs from the earlier case with no observed native gesture.

The gesture-phase profile now holds the pointer for two seconds after dragging,
giving asynchronous XCTest orientation delivery a bounded input window. The
default-transition/content-Back profile retains its 0.3-second hold. Distances,
velocities, request signals, observation deadlines and all native phase assertions
are unchanged. Acceptance still requires orientation receipt while the same
native coordinator and recognizer are actively interactive; a request alone or a
notification after interaction ends still fails. No gesture is retried.

Normal iPadOS 26.2 and 18.6 each pass three XCTest methods with zero failures/skips.
All four 26.2 gestures receive orientation during native pointer interaction,
with more than two seconds remaining before the interaction decision. The 18.6
run retains the two previously unobserved inset gestures. They remain outside
its proven coverage.

A temporary [control patch](./evidence/stable-010-gesture-window/delayed-orientation-control.patch)
delays each gesture orientation request by one second. The timestamp and phase
snapshot are taken after this delay, preserving their meaning. The 26.2 control
passes all three tests and all native assertions, with orientation receipt still
1,172–1,305 ms before the two cancellation decisions. The temporary delay was
removed after validation. [Source verification and outcomes](./evidence/stable-010-gesture-window/local-validation.json)
check all nine recorded hashes per run against the final fixture, with the
explicit control patch as the only exception. The normal runs correctly identify
their pre-commit dirty source tree. Archives retain JSON and native logs:
[normal 26.2](./evidence/stable-010-gesture-window/normal26.zip),
[normal 18.6](./evidence/stable-010-gesture-window/normal18.zip),
and [delayed 26.2](./evidence/stable-010-gesture-window/delayed26.zip).

The gesture-phase profile records actual UIKit outcomes independently of drag
intent. The normal 26.2 inset cancellation intention committed; the delayed control
cancelled it. Both proved orientation receipt during native interaction. Required
actual inset cancellation remains enforced by the unchanged default profile.
UIKit deferred visual rotation until navigation ended in these runs; they do not
establish visual gesture/rotation overlap.

[The video](../docs/public/media/stable-010-gesture-window.mp4) records the normal
26.2 run with held gestures, rotation, retained state and modal controls. It has
no injected delay. [Video metadata](./evidence/stable-010-gesture-window/video.json)
records the native source and playback conversion. All 69 harness tests pass.
Hosted native acceptance and the complete final-main release gate remain required
before publication. Router runtime and package contents are unchanged.
