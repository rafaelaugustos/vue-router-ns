# Gesture rotation integration after #226

PR #225 incorporates merged #226 at `371d6f5`. The Swift driver retains the
gesture-phase orientation signal, and `test-ui.sh` runs both the gesture-overlap
and SystemUI recovery tests in its single Node invocation. The Android fixture,
diagnostic recovery and workflow corrections from #226 remain unchanged.

Integration validation exposed a preexisting cancellation-input instability.
The 8% inset drag committed instead of cancelling both with the integrated fixture
and with the original #226 fixture. Baseline `a2b5cda` and merged main `a77d44a`
have the identical Git tree `92a0096fe27e6b685aaa63f61b2b52157ff7dd6e`.
Both rejected native results are retained. Successful XCTest invocation alone
did not satisfy the host's actual-cancellation assertion.

At native source `0ece729`, only the iPadOS 26+ inset cancellation input changes
to 4% of recognizer width at 40 points/second, retaining the 0.3-second hold.
The earlier rejected 4% experiment in #226 used the default 250-point/second
velocity and a 0.1-second hold. The slower input allows a longer recognition
interval while keeping the movement short. UIKit must still report the required
native outcome and interaction timing. No outcome, identity, history, full-window,
disposal, guard or overlap assertion is weakened. Library runtime is unchanged.

## Current local validation

All six runs use source `0ece729`; all nine recorded native source hashes were
checked. Both simulators use published Core 9.1.4 and the same built fixture.

| Profile              | iPadOS 18.6                                                   | iPadOS 26.2                                         |
| -------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| Gesture phase        | 3 XCTest methods; 4 exercised, 2 known missing inset gestures | 3 methods; all 6 scenarios exercised                |
| Programmatic overlap | 2 methods; 6 scenarios, including 4 actual overlaps           | 2 methods; 6 scenarios, including 4 actual overlaps |
| Default controls     | 4 methods; 8 exercised, 2 known missing inset gestures        | 4 methods; all 10 scenarios exercised               |

The complete 26.2 default profile also passed an independent second run. Both
native interaction/end callbacks report cancellation for the inset control. The
gesture profile delivers orientation during native interaction and still finds
visual deferral. The separate strict coverage audit exits 1 on both OS versions
because genuine gesture overlap remains missing. This does not close #167.

Local unit tests (995 passed, 10 skipped), the combined native harness (66 passed),
typechecking, package build and formatting passed. The final source's PR CI also
passed; its change-detection job first received GitHub's temporary diff/server-load
error and succeeded when rerun.

## Hosted validation and retained failures

The [final-source iPadOS 26.2 job](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/44365174655/job/135016864803)
passed all three profiles at `0ece729`: 3 gesture methods, 2 programmatic methods
and 4 default methods. All 6/6/10 selected scenarios were exercised, including four
actual programmatic overlaps and the required native inset cancellation. The nine
native source hashes match the tested commit; raw proofs and archives were verified
after download. The strict gesture-overlap audit still correctly rejects deferral.

The [iPadOS 18.6 job](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/44365174655/job/135016865424)
was cancelled before executing any steps. GitHub reports that a hosted runner was
not acquired after multiple attempts, with macOS arm64 capacity constraints. The
workflow remains failed overall because of this unavailable job. This revision has
complete local 18.6 acceptance, but no fresh hosted 18.6 acceptance is claimed.

The [first integration attempt](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/44360488160/attempts/1)
failed at `371d6f5`: the 26.2 edge-cancellation input did not produce a native
navigation-start signal, before reaching the changed inset input. On 18.6, the
gesture profile and both programmatic XCTest methods passed, but the recorder
required SIGKILL after its ten-second shutdown grace. The four raw programmatic
overlap proofs also pass their validator, but the job remains failed. Neither
default profile ran in that hosted attempt. Attempt 2 was cancelled to supersede
the old input with the final-source run. The underlying causes of the missed edge
gesture and recorder shutdown remain unproven; this input adjustment does not
claim to fix either.

[Verification and archive hashes](./evidence/gesture-rotation-167/integration-validation.json)
identify successful local runs, the repeated control, rejected cancellation
baselines and failed hosted attempt. Raw JSON and logs remain in separate archives.

## Actual application recording

[Watch the final-source iPadOS 26.2 gesture profile](../docs/public/media/gesture-rotation-integration-225.mp4).
It shows both drag intentions in both directions, native commit/cancel, subsequent
rotation, retained drafts and the settled/modal controls. The actual simulator
recording is resized to 720px width and resampled to 60fps for playback; no
scenario is cut. Native JSON establishes timing.
[Video provenance](./evidence/gesture-rotation-167/integration-video.json) records
both files' hashes and encoding metadata. No physical-device or full native-matrix
acceptance is claimed.
