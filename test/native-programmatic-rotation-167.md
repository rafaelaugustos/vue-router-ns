# Native programmatic rotation overlap — #167, stage 1

This stage proves a target-orientation rotation during an active native push and
programmatic Back, in both directions, on iPadOS 18.6 and 26.2 simulators. It uses
published Core 9.1.4's public `slide` transition with `duration: 1500`. The original
platform-default transition and content-Back suite remain separate regression
controls. No router runtime, installed Core implementation, navigation delegate
or gesture policy is patched by the test observer.

## Controlled composition and timing

The existing adaptive RouterDrawer retains two warmed named stacks and different
drafts. The overlap profile supplies the public Core transition option to push;
Core applies the corresponding reverse transition on Back. Core owns its animator
and delegate selection. The fixture observer only observes the resulting UIKit
coordinators.

XCTest dispatches orientation immediately after the fixture reports that a case
is armed. The requests therefore race near navigation admission. The orientation
request can precede navigation observation, and `requestedDuringNavigation`
explicitly reports that fact. Acceptance does **not** infer overlap from dispatch
order, a pending promise, a duration setting or a fixed delay.

At the target `viewWillTransition` callback, the observer checks for the native
navigation coordinator in addition to its ordinary polling point. This avoids
missing a current navigation context merely because its polling callback has not
run yet. It excludes the rotation callback's own coordinator and never reads an
expired stored context after navigation completion.

Each of the four programmatic cases must prove:

- A current, noninteractive native navigation coordinator with the actual
  1.5-second duration, source/destination controllers matching the Frame and one
  successful completion for that coordinator.
- A target-size rotation with the same navigation coordinator still current and
  completion pending, before its native completion timestamp. The rotation
  coordinator must have a distinct identity. A compatibility-window resize does
  not match the required swapped full-window dimensions.
- Exactly one completion for every observed rotation. The observer tracks rotations
  in flight and requires the last completed rotation to match the target before
  capturing final state.
- The existing surviving Frame/Page/Vue/native-view/entry identities, inactive
  stack/drafts, logical/native history, disposal, result settlement, layout and
  accessibility-state assertions. Follow-up push/Back, rejecting guard, drawer
  open/close and a later stable snapshot must still pass.

UIKit returned null for transition source/destination keys in the tested nested
composition. These nulls remain explicit in the evidence; the observer records
Frame source and navigation-controller destination identities as endpoints. It
also records the independently current navigation coordinator, its actual native
duration, its distinct rotation coordinator and its completion callback.

The new mode runs two XCTest methods and six scenarios: the four required
programmatic overlaps, rotation after navigation settles, and rotation with an
unrelated pending modal result. The default mode retains its ten scenarios,
original request-after-observation requirement and native gesture outcome checks.
There are no gesture retries in either mode.

## Observed interruption behavior

All eight local programmatic cases reached the target orientation while the
native navigation context remained current, roughly 1.50 seconds before its
completion. UIKit then temporarily returned to the initial orientation and
reached the target again after navigation completed. The full three-transition
sequence is retained, including individual coordinator IDs and completion events.

This is real overlap with an interruption, not a claim of a seamless simultaneous
animation. Final history, identities, drafts and presentation remained coherent.
The result does not establish overlap for every transition configuration or for
interactive gestures.

## Validation

Native source: `65f61c8576a2190faebf485357cbe6c23e223115`. Every recorded fixture,
Swift driver and host-validator source hash matches this commit. Both local OS
runs use iPad Pro 11-inch M4 simulators, Xcode 27.2 / 27B52, Node 20.19.4,
NativeScript-Vue 3.1.3 and iOS runtime 9.1.0. Installed Core matches the official
9.1.4 package's 1,362-file digest retained by the preceding acceptance.

| Local run                     | XCTest methods | Scenarios                                    | Required native overlaps |
| ----------------------------- | -------------- | -------------------------------------------- | ------------------------ |
| Overlap / iPadOS 18.6 / 22G86 | 2 passed       | 6 passed                                     | 4 of 4                   |
| Overlap / iPadOS 26.2 / 23C54 | 2 passed       | 6 passed                                     | 4 of 4                   |
| Default / iPadOS 18.6 / 22G86 | 4 passed       | 8 exercised + 2 known missing inset gestures | Separate control         |
| Default / iPadOS 26.2 / 23C54 | 4 passed       | 10 exercised                                 | Separate control         |

All six or ten selected window checks precede arming and end with full-window
bounds. Fifteen validator tests reject false positives such as deferred rotation,
pending completion with a different coordinator, the rotation coordinator being
mistaken for navigation, incomplete callbacks, resized windows and Reduce Motion.
Formatting, typechecking and the native harness checks pass locally. The unit suite passes 995 tests (10 skipped), and the documentation build passes in all four locales.

The initial hosted run, [43858903471](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43858903471), passed both modes on 18.6. Its 26.2 run proved all four overlaps but the strict final-state check rejected a snapshot taken after the temporary orientation return, before the queued final rotation. The observer now waits for target dimensions as well as zero rotations in flight. This adds no rotation retry and preserves the final geometry assertion. The failed artifact is retained separately.

The final [hosted matrix](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43860859914) is in progress on this native source. Hosted acceptance remains pending until both overlap and default-control steps pass on both OS versions; local results above are already verified.

[Validation, provenance and archive hashes](./evidence/programmatic-rotation-overlap-167/validation.json)
retain accepted runs separately from diagnostic probes. Public
[scene geometry requests](<https://developer.apple.com/documentation/uikit/uiwindowscene/requestgeometryupdate(_:errorhandler:)>)
were denied or deferred in the attempted configuration, including a denial outside
XCTest. Extending the slide duration while still waiting for navigation observation
also did not reliably produce overlap. Those probes are not accepted coverage and
the scene-request experiment is not shipped in the fixture.

## Recording and reproduction

[Watch the actual iPadOS 18.6 application recording](../docs/public/media/programmatic-rotation-overlap-167.mp4).
It shows the four programmatic cases, their orientation reversals, and the settled
and modal controls. The complete 28.116667-second recording preserves all 830 frames,
presentation timestamps and final-frame duration. Its source and published hashes
are in [video.json](./evidence/programmatic-rotation-overlap-167/video.json).

Use the [overlap driver instructions](../scripts/native/adaptive-drawer/README.md#programmatic-overlap).
The focused workflow runs the new mode and the original device mode on both OS
versions. Full native acceptance, registry-consumer acceptance, physical devices,
Stage Manager/freeform windows and arbitrary custom transitions are not certified
by this stage. The remaining genuine gesture-overlap requirements keep #167 open.
