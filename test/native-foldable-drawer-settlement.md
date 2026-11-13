# Foldable drawer settlement and focused CI — #183

2026-11-13. This stage fixes the Android overlay-state failure in #183. The iOS Vite launch investigation and full release-matrix acceptance remain separate.

## Cause and correction

The [archived hosted run](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/42628023178/job/129196832455) failed immediately after the adaptive fixture's `open` command. Its [report](./evidence/foldable-settlement/archived-ci.json) places the pane at `x=0`, visible, with `open=false`, `model=false`, no `opened` callback and content still accessible. Physical position was observed before DrawerLayout completed its state transition.

The same assertion failed on the current router with published Core 9.1.4, NativeScript-Vue 3.1.3, Android runtime 9.1.1 and an API 35 ARM64 fold emulator. A later snapshot of that same process, without another opening request, reported `open=true`, `model=true`, one `opened` callback and hidden covered content. See [before](./evidence/foldable-settlement/local-before.json) and [later](./evidence/foldable-settlement/local-later.json). The dependency update alone did not fix this timing assumption.

The fixture now observes the real [DrawerLayout motion-state callbacks](https://developer.android.com/reference/androidx/drawerlayout/widget/DrawerLayout.DrawerListener). Android snapshots require idle motion and completed layout, observed in two consecutive samples, within three seconds. The observer neither drives the drawer nor repeats commands. A missing endpoint, incorrect model/accessibility state or changed identity still fails the original assertions. Its trace and elapsed time are included in the report. The runtime router implementation is unchanged; UIKit retains its existing 500 ms fixture timing.

Host ADB operations now have a 20-second process limit. Readiness/reply loops use elapsed deadlines, and error replies are saved before assertion failure. This bounds stalled transport as well as native settlement.

## Native and automated checks

- [38 native contract commands](./evidence/foldable-settlement/local-contracts.json) passed, including pending modal results, interrupted opening, repeated presentations, RTL, resize and refused Back. The final intentional pop still invalidates retained page/entry identity as the negative control requires.
- Native Android input passed on API 35 ARM64 with host GPU/4 GB: typed draft, inactive stack retention, accessibility reachability, persistent-pane input and system Back.
- Six [adaptive hinge checkpoints](./evidence/foldable-settlement/local-hinge.json) passed: flat/half-open, RTL, horizontal hinge below a modal, observer re-enable and restored portrait, preserving native identities/history and excluding the physical hinge.
- The initial local 2 GB/software-rendered emulator produced an app input-dispatch ANR while typing. Logs also showed system/keyboard frame stalls and load 27.1. That run remains a failure; it was not recovered by dismissing the app ANR. Passing on the fresh host-GPU/4 GB configuration does not by itself identify which environment difference caused it.
- Three fixture-observer tests verify delayed native completion, bounded failure when idle never arrives, and prompt completion/observer cleanup for settled commands. The full suite passed: 664 tests, 10 existing skips. Root/demo types, build, documentation/locales, formatting and shell-driver checks passed.

## CI performance and scope

The original failed foldable job took 440 seconds: 174 seconds building its two fixtures and 206 seconds in emulator startup/tests. The containing native matrix took approximately 41 minutes. These are a failed-run baseline, not an equivalent successful before/after benchmark.

`gh workflow run native.yml --ref <candidate-branch> -f lane=foldable` now runs just the complete foldable acceptance lane. It retains both 21-checkpoint fold/hinge suites, adaptive contracts, native input and adaptive hinge checks. The opening regression runs first, before the posture suites. Gradle dependencies are cached, and a newer manual run on the same non-main branch cancels an obsolete one. Default/full-workflow callers retain all integration lanes.

The targeted hosted result and duration will be recorded after the candidate completes. A focused green result does not close the iOS half of #183 or certify the full release matrix.

## Actual application recording

[16-second native recording](../docs/public/media/foldable-drawer-settlement.mp4), captured from the API 35 fold emulator at 1104 × 920. It shows overlay open/close, permanent presentation, the retained detail draft after switching tabs, and a modal result. The recording driver validates retained native identity at every step. The clip was transcoded to H.264 without changing playback timing; it is not a simulated UI or a performance benchmark.
