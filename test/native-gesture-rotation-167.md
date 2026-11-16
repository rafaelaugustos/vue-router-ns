# Native gesture rotation delivery and visual deferral — #167, stage 2

The app receives a changed device orientation during real native Back interaction,
but the tested platform-default iPad composition defers window rotation until
navigation finishes. This stage adds repeatable phase evidence and a strict
coverage audit; it **does not establish genuine gesture overlap or close #167**.
The [programmatic Core slide overlap](./native-programmatic-rotation-167.md) remains
separate accepted coverage.

## What is measured

`ROTATION_MODE=gesture` runs commit-intended and cancel-intended drags in both
rotation directions, plus settled and pending-modal controls. It retains the
existing adaptive drawer, two warmed named stacks, distinct drafts and full-window
preconditions. Both drag intentions request orientation after native navigation
is observed, while pointer interaction is active. The original `device` mode
still requests its committed control after UIKit's interaction decision.

A test-only observer records Apple's
[device-orientation notification](https://developer.apple.com/documentation/uikit/uidevice/orientationdidchangenotification),
the current navigation coordinator, its
[current interactive state](https://developer.apple.com/documentation/uikit/uiviewcontrollertransitioncoordinatorcontext/isinteractive),
progress and native edge/content recognizer states. Receipt must precede the
interaction decision, with the same coordinator current and an enabled recognizer
in its began/changed state. UIKit's interaction and completion callbacks must
agree on the actual outcome. Intention and outcome are reported separately.

At `viewWillTransition`, the classifier requires swapped initial full-window
dimensions and a distinct rotation coordinator before it considers visual overlap:

| Classification        | Native evidence                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `interactive-overlap` | Same current navigation context, still interactive, before the interaction decision and navigation completion. |
| `completion-overlap`  | Same current context in its noninteractive completion segment, before navigation completes.                    |
| `rotation-deferred`   | Every observed rotation begins after native navigation completion, with no completion pending.                 |
| `overlap-unconfirmed` | Pending completion, mismatched/currently absent context or unknown phase prevents either stronger conclusion.  |

Every rotation must have one matching completion and the final rotation must reach
the target. Existing identity, native/logical history, drafts, disposal, result
settlement, drawer geometry/accessibility and follow-up push/Back/guard checks
remain. Surviving instances and inactive state stay intact, and a rotation does
not settle the unrelated modal result.

The observer reads public native properties and listens for notifications. It
changes no gesture targets/delegates, animation durations, transition policy,
router runtime or installed Core implementation. Core's explicit custom-transition
path changes the delegate used for content Back, so the programmatic slide profile
is not reused to claim native gesture coverage.

## Local results

Native source: `f43d27eca18d222404a7c45eceeda09b933d1a65`. All recorded executable source
hashes match that commit. Both iPad Pro 11-inch M4 simulators use Xcode 27.2 / 27B52,
Node 20.19.4, published Core 9.1.4, NativeScript-Vue 3.1.3 and iOS runtime 9.1.0.
The installed Core digest matches the official package's 1,362 files, excluding
installation metadata in `package.json`.

| Profile                         | iPadOS 18.6 / 22G86                                            | iPadOS 26.2 / 23C54                       |
| ------------------------------- | -------------------------------------------------------------- | ----------------------------------------- |
| Gesture phase                   | 3 XCTest methods; 4 exercised + 2 known missing inset gestures | 3 methods; all 6 scenarios exercised      |
| Programmatic overlap regression | 2 methods; 6 scenarios; 4 actual overlaps                      | 2 methods; 6 scenarios; 4 actual overlaps |
| Original device regression      | 4 methods; 8 exercised + 2 known missing inset gestures        | 4 methods; all 10 scenarios exercised     |

All six reproduced gesture cases receive orientation during native pointer input,
then defer visual rotation. The two intentions produce one native commit and one
cancel per reproduced direction in these runs; this is an observed result, not an
assumption based on drag length. No gesture is retried. The missing 18.6 inset
cases remain unverified, with unchanged history/identity checks.

| iPadOS | Case               | Actual native outcome | Orientation receipt before interaction decision | Target rotation after navigation completion |
| ------ | ------------------ | --------------------- | ----------------------------------------------- | ------------------------------------------- |
| 18.6   | `cancel-landscape` | cancelled             | 605.2 ms                                        | 20.3 ms                                     |
| 18.6   | `commit-landscape` | committed             | 2869.6 ms                                       | 19.2 ms                                     |
| 26.2   | `cancel-landscape` | cancelled             | 590.4 ms                                        | 13.9 ms                                     |
| 26.2   | `cancel-portrait`  | cancelled             | 591.0 ms                                        | 12.1 ms                                     |
| 26.2   | `commit-landscape` | committed             | 2879.5 ms                                       | 13.4 ms                                     |
| 26.2   | `commit-portrait`  | committed             | 3074.6 ms                                       | 18.6 ms                                     |

The notification proves that the requested device orientation reached the app
while the native gesture was active. It does not prove that the interface rotated
at that time. These callbacks identify deferral within the tested UIKit/Core
composition; they do not establish a universal platform restriction or a router
defect, nor justify replacing native gesture/transition ownership.

The 23 new validator tests include positive synthetic overlap cases and negative
controls for delivery after interaction, missing recognizers, coordinator
confusion, incomplete callbacks, wrong targets and Reduce Motion. The combined
native harness passes all 51 checks. Unit tests pass 995 cases (10 skipped), and
typechecking passes.

The [hosted matrix](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43867651535)
is running the gesture phase, programmatic overlap and default regression profiles
on both OS versions. Hosted acceptance is pending.

[Validation, provenance and archive hashes](./evidence/gesture-rotation-167/validation.json)
retain final acceptance separately from diagnostics. The background-thread
orientation experiment was rejected by XCTest's main-thread requirement. Initial
phase probes ran only two methods and were rejected by the then-unchanged outer
full-suite method-count assertion; they are not final acceptance. The shipping
mode runs three methods and includes both controls.

## Strict coverage audit

```sh
node scripts/native/adaptive-drawer/gesture-overlap.mjs <gesture-output-directory>
```

This recomputes every gesture proof from raw reports and exits nonzero when any
of the four scenarios lacks actual visual overlap. It correctly exits **1** for
both final local runs: reproduced cases are deferred, and the two 18.6 inset cases
are missing. The retained `strict-overlap-audit.log` files contain those exact
failures. Passing the phase/state suite never substitutes for this stronger gate.
Synthetic unit cases exercise the positive overlap branches; no synthetic case
counts as native acceptance.

## Video and reproduction

[Watch the actual iPadOS 26.2 application recording](../docs/public/media/gesture-rotation-167.mp4).
It shows the two drag intentions in both directions, native commit/cancel,
subsequent window rotation, retained drafts and the settled/modal controls. The
complete 41.468333-second video preserves all 1,592 frames, presentation timestamps
and final-frame duration. [Video hashes and encoding metadata](./evidence/gesture-rotation-167/video.json)
identify the original and published files. Event evidence, rather than visual
estimation from the recording, determines overlap classification.

See [driver instructions](../scripts/native/adaptive-drawer/README.md#gesture-phase-and-strict-overlap-audit).
The focused `gesture-rotation` workflow runs all three profiles on both simulators;
it is not the full native release matrix. Physical iPads, Stage Manager/freeform
windows, arbitrary custom transitions and Reduce Motion are outside this stage's
animated acceptance. The remaining genuine gesture-overlap requirement stays open
in #167.
