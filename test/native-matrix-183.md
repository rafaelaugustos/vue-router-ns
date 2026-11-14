# Full native matrix and guarded Split Back — #183 stage 4

The [full native run](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43600236191)
uses merged commit `35f772733b68519ed18e783079c37b03daa1610b`, attempt 1, on
2026-11-14. It expands the nine required groups into 20 device jobs. This is the
manual acceptance workflow, distinct from the PR aggregate that accepts skipped
device jobs. No matrix retry or timeout/budget change is part of this stage.

The two original #183 lanes passed together on that source: Android foldable and
iOS Vite. The complete matrix nevertheless exposed other failures. A focused
success, including the Split correction below, does not turn the original full
run green or satisfy release acceptance. The completed run has **16 successful
device jobs, three failures and one cancellation**. Its required aggregate failed.

| Required group       | Device jobs                       | Original run result                                             |
| -------------------- | --------------------------------- | --------------------------------------------------------------- |
| Android contracts    | API 34, 36                        | Both passed                                                     |
| iOS contracts        | iPhone 16 Pro / iOS 18.6          | Cancelled at the 40-minute job limit during native destinations |
| UIKit Split          | iPhone 16 Pro, iPad Pro 13 M4     | Both failed the selector described below                        |
| Integration          | Android 34, foldable 35, iOS Vite | All three passed                                                |
| Page actions         | Android, iOS                      | Both passed                                                     |
| iOS drawer           | iPhone 16, iPad Pro 11 M4         | Both passed; rotation coverage limit below                      |
| Native flows         | Android, iOS                      | Both passed                                                     |
| Predictive prototype | API 34, 35, 36                    | 34/35 passed; 36 failed zero-progress assertion                 |
| Native windows       | Android 34/36, iPad               | All three passed                                                |

## Guarded Back selector correction

Both UIKit Split jobs reached the guarded Back from `/detail/1` after completing
rotation, retained-Page/draft checks and guarded modal dismissal. XCTest then
failed at `SplitUITests.swift:22`, waiting for a navigation-bar button matching
`BackButton` or the label `Back`. The captured hierarchy contains the intended
button in the correct navigation bar, with identifier `router-guarded-back` and
label `/`. The test did not tap it. Native reports end at `guard`: sequence 17 on
iPhone and 19 on iPad, without a preceding native assertion error.

`src/guarded-back.ts` assigns that identifier to the guarded native button and
uses the preceding route's title for its accessibility label. The XCTest helper
now also matches that existing identifier, scoped to the requested navigation
bar. The standard native Back and previous-title alternatives remain. This
changes only test input selection. Guards, Page identities, modal settlement,
process restoration, deadlines and runtime code are unchanged.

## Other observations

- **iOS job cancellation:** GitHub's [retained annotation](./evidence/native-matrix-183/ios-annotations.json)
  explicitly reports the 40-minute job limit. The final destination scenario
  began at 14:11:07 UTC and was cancelled at 14:12:36 UTC. Its retained
  `before-system-back.json` contains 17 initial checks and no diagnostic issues,
  but there is no final system-Back/restoration result or completed XCTest log.
  Those remaining checks are **unverified**. The full original iOS archive was
  uploaded during cleanup and is retained; the cancellation is not converted to
  success. This needs a separate investigation of serial build/test duration and
  evidence capture, without assuming that a larger timeout fixes it.
  Earlier iOS contracts passed 19 positive reports, process restoration and the
  specific fault-build HMR control. The timing verdict has 40 samples at
  286.14/352.54 ms median/p95, zero live JS Pages and one retained native
  controller per batch, within the existing profile. This partial success does
  not cover the unfinished destination scenario.
- **Android predictive API 36:** the candidate-Core `cancel-check` failed
  `real progress received`. All 26 reported gesture samples had progress zero;
  input injection returned `CONTRACT_TOUCH_OK` with delivery lag 42 ms. The route
  and stack remained `/detail` and `[/, /detail]`. This establishes missing
  positive progress, not its cause. Later legacy/recreation scenarios did not
  execute in that job. API 34/35 passed 17 Core and 15 legacy reports, both
  recreation modes, and the API 35 published-Core control failed at the required
  `back-after-recreate` state. The prototype uses pinned Core revision
  `fadb58f034e403933028f86746280375ea9811ff`; it does not certify published
  Core predictive support. This failure requires a separate investigation.
- **Android contracts API 34/36:** both fixed builds passed all 18 reports and
  changed process for restoration. Each measured 40 transition pairs, with zero
  live JS Pages and native Fragments in all four retention batches. Median/p95
  were 505.37/635.52 ms on API 34 and 445.39/514.59 ms on API 36, below their
  unchanged profiles. Both former builds failed the specific covered-HMR native
  Page replacement assertion, with `fault: true`; these are valid negative
  controls, not unexplained failures.
- **Android foldable:** 21 fold and 21 hinge checkpoints, 38 adaptive drawer
  commands, native-input preservation and 20 adaptive hinge reports passed.
  The earlier settlement correction remains in place.
- **iOS Vite:** all 24 navigation/watch checks, seven template-retention
  invariants and cleanup passed. The source snapshot was clean and the four
  after-cleanup metadata queries completed. Observed versions: Xcode 16.4/16F6,
  CLI 9.1.2, iOS 18.6/22G86 ARM64, Core 9.1.4, Vue 3.1.2, iOS runtime 9.1.0,
  Vite 8.3.4 and native Vite 8.0.20. This does not establish the cause of the
  earlier HTTP-import failure or the historical November 9 launch timeout.
- **iPad drawer rotation:** the job passed its existing gate with eight exercised
  rotation cases. Its report explicitly says two gesture cases were **not
  reproduced**; those cases are not additional passing coverage.

## Local Split revalidation and video

The corrected XCTest passed on dedicated iPhone 16 Pro and iPad Pro 13 M4
simulators running iOS 18.6/22G86: **26 and 28 reports**, respectively, with no
native errors or diagnostic issues. Each run exercised the previously missed
guarded Back, exactly one modal settlement, replace/clear history and restoration
in a second process. The iPad also exercised the system sidebar controls.

The [local evidence index](./evidence/native-matrix-183/local-split.json) retains
complete XCTest result bundles, runtime/build logs, native reports and exact
environment. Local source is `35f7727` plus the selector change and documentation;
the environment correctly reports `dirty: true`. [Source hashes](./evidence/native-matrix-183/sources.json)
identify the change and the unchanged fixture, runner and runtime source. Local
Xcode is **27.2/27B52** on macOS ARM64 / M4 Max, Node 20.19.4, Core 9.1.4,
NativeScript-Vue 3.1.3 and NativeScript iOS 9.1.0. The failed hosted Split jobs
used Xcode **16.4/16F6**, macOS ARM64 / M1 Virtual and Node 22.23.4 with those
same native package versions. Local success is not hosted revalidation.

[Actual iPhone recording](../docs/public/media/uikit-split-guarded-back.mp4) shows
the corrected complete navigation scenario after the app's ready report:
rotation, guarded Back, modal dismissal/result, retained draft, replace/clear and
process restoration. In particular, the previously missed guarded Back occurs
around 50–57 seconds. The full recording has 1,379 frames over about 83 seconds;
the review copy is scaled to 604 pixels wide and re-encoded as H.264. Every frame
presentation timestamp is preserved, without cuts or overlays. [Video provenance](./evidence/native-matrix-183/video.json)
contains the original/review hashes and media metadata.

## Evidence retention

[Job records](./evidence/native-matrix-183/jobs.json) retain each step's result and
the complete job log compressed without changing its bytes. [Artifact records](./evidence/native-matrix-183/artifacts.json)
retain GitHub artifact IDs, original archive hashes, expiry dates and individual
retained-file hashes. The original archives for the Split and predictive failures
and cancelled iOS job are committed in full, including screenshots, XCTest
bundles and native logs.
For passing jobs the committed archives retain JSON/text/XML/log files byte for
byte, excluding binary XCTest attachments and videos; those complete originals
remain at the linked GitHub artifacts until expiry. The manifest explicitly marks
these subsets with `completeOriginal: false`.

## Remaining acceptance

The original matrix failed. The Split selector requires hosted revalidation;
the predictive API 36 zero-progress failure and iOS job timeout need separate
investigation, followed by a complete passing matrix on one acceptance commit.
#183 remains open until its complete acceptance criteria are met. No published
package, experimental API promotion or physical-device acceptance follows from
these simulator results.

The [ordinary PR CI](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43602836845)
passed 988 unit tests (ten existing skips), native shell-helper checks, formatting,
types, package build and documentation build on the selector correction. Device
jobs were skipped by the PR workflow, as documented above.
