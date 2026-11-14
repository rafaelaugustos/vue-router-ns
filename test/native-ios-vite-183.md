# iOS Vite startup investigation — #183 stage 1

The native acceptance runner now leaves iOS application stop/start to the
NativeScript CLI. It no longer launches a second process after observing
“Restarting application” and a temporarily absent PID. Post-sync log fallback is
read-only; a timed-out log service is not repeatedly queried. Navigation and HMR
assertions and their readiness budgets are unchanged. This fixes a reproduced
runner synchronization race, without claiming that the original hosted timeout's
root cause has been established. No router runtime or application dependency changes.

## Original failure preserved

The November 9 [full native run](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/42628023178)
used `b142ff6e8ceded3ae4fd7c27f947be34429e832c`. Both affected artifacts and job logs
are retained in [original evidence](./evidence/ios-vite-183/original/provenance.json),
with GitHub artifact ids and SHA-256 hashes. The foldable archive preserves the
separate investigation; this stage does not diagnose or correct its drawer state.

The iOS CLI completed build, install and bundle transfer, then stopped logging at
its restart announcement. The runner reported a simulator log-query timeout,
observed no fixture PID and requested another launch. That command timed out with
SIGTERM and empty stdout/stderr. The final screenshot shows SpringBoard. There is
no run-identified native acceptance result, crash diagnosis or successful HMR
observation in that run. Neither dependency adoption nor a later passing run
explains that historical failure.

## Reproduced race and correction

A clean lockfile install on the current source first passed all 24 native
navigation/watch checks and seven template-retention invariants with the former
runner. The historical timeout did not reproduce locally. Next, the
[test-only command wrapper](../scripts/native/conventions/trace-xcrun.py) delayed
CLI-owned launch calls by three seconds on the real iOS simulator:

| Runner                                                    | Extra runner-owned launches | Native navigation/watch checks | Outcome                                                  |
| --------------------------------------------------------- | --------------------------- | ------------------------------ | -------------------------------------------------------- |
| Former, source `231e8548af5b85f4ab89805ed59bae1ce9367dec` | 1                           | 24 passed                      | Runner launches before the pending CLI launch completes. |
| Corrected                                                 | 0                           | 24 passed                      | CLI retains launch ownership throughout the delay.       |

The [retained command trace](./evidence/ios-vite-183/launch-control.json) records
actual parent processes, timestamps and arguments. Under this injected delay the
unchanged CLI itself issues two launch commands; these are reported explicitly.
The control proves the runner's competing launch, not a natural OS timeout or a
router navigation defect. Normal final acceptance runs without the wrapper/delay.

The runner additionally persists each command before execution and after success
or failure, including duration, deadline, stdout/stderr, code and signal. Commands
are bounded and a killed command stays failed. Source restoration and owned-process
cleanup are attempted independently; a diagnostic failure cannot skip later steps
or replace the primary acceptance error. CLI output is drained before its log closes.
Environment metadata reads the file-routing example's installed packages. The
Native workflow now supports selecting only the iOS Vite lane for this investigation;
default and reusable full-matrix execution keep all lanes.

## Local acceptance and video

Local environment: iPhone 16 Pro / iOS 18.6 (22G86) ARM64 simulator, Xcode 27.2,
Node 20.19.4, NativeScript CLI 9.1.2, Core 9.1.4, NativeScript-Vue 3.1.2,
iOS runtime 9.1.0, native Vite 8.0.20 and Vite 8.3.4. The example's Vue pin differs
from the demo's 3.1.3; no version is inferred from the demo.

[Results](./evidence/ios-vite-183/results.json),
[template invariants](./evidence/ios-vite-183/template-probe.log),
[cleanup outcome](./evidence/ios-vite-183/outcome.json),
[environment](./evidence/ios-vite-183/environment.json) and
[source hashes](./evidence/ios-vite-183/sources.json) identify the final run.
The [actual application recording](../docs/public/media/ios-vite-launch.mp4) includes
build/startup, native page/modal navigation, live template/middleware/route edits,
invalid metadata recovery and the final passing screen. All frames and timestamps
are preserved in a lossless H.264 remux; [video metadata](./evidence/ios-vite-183/video.json)
records the exact duration, count and hashes.

The unchanged fixture requires 24 distinct native assertions and seven template
invariants: exact Page/setup identity, reactive/native drafts, route, back stack
and the unrelated stack. Six new Node tests cover delayed startup observation,
current-run failure versus stale output, unavailable log services, real command
failure/timeout retention and independent cleanup. The ordinary 987 tests pass
with ten existing skips; root/example types, shell checks, formatting and the
four-locale documentation build pass.

## Hosted scope

The focused [hosted run 43557043051](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43557043051)
at `d621ad90da5111ef3a6a3ad83a0f66e2c7d47cab` failed before the app started:
the new `xcodebuild -version` environment probe reached its 20-second deadline
and was killed with SIGKILL, without output. The fail-fast metadata collection
exited before the NativeScript CLI was spawned; this run did not exercise native
navigation or HMR. PR #210 had already merged when the result arrived.
Its original artifact and full job log are retained with hashes in the
[follow-up evidence](./evidence/ios-vite-environment-183/original/provenance.json).
The [environment follow-up](./native-ios-vite-environment-183.md) isolates
diagnostic failures and records subsequent validation separately.
This stage keeps #183 open: the Android foldable correction and complete required
native matrix on one release acceptance commit remain outstanding. A passing
focused lane does not certify the full matrix, physical devices or a release.

See [reproduction](../scripts/native/conventions/README.md). The previous
[Vite acceptance](./native-vite.md) retains its own package/platform scope, including
the separate macro limitation. This work changes the runner, not the public Vite
plugin or the native navigation contract.
