# iOS environment diagnostics — #183 stage 2

The iOS Vite runner now records failed environment probes and continues to actual
native acceptance. The metadata probe deadline stays at 20 seconds. All four
commands settle before the environment report is written, preserving successful
fields and final command journals. Unavailable values are `null`, and
`device.metadata.complete: false` plus `device.metadata.errors` prevents an
incomplete report from masquerading as a verified toolchain. The 24 native checks,
seven template-retention invariants, launch ownership and cleanup gates are unchanged.

## Observed regression

[Hosted run 43557043051](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43557043051)
on `d621ad90da5111ef3a6a3ad83a0f66e2c7d47cab` failed in the environment collection
introduced by PR #210. `xcodebuild -version` exceeded its 20-second deadline and
was killed with SIGKILL, without output. The fail-fast `Promise.all` exited before
spawning the NativeScript CLI, leaving the other three command journals marked
running. This run never built or launched the app and supplies no native acceptance
result. PR #210 had already merged when this result arrived.

The [original artifact and full job log](./evidence/ios-vite-environment-183/original/provenance.json)
are preserved with GitHub ids and hashes. The evidence establishes a diagnostic
failure blocking acceptance, not why the hosted version command stalled. It is
separate from the November 9 launch timeout investigated in
[stage 1](./native-ios-vite-183.md).

## Regression control and local acceptance

The [test-only shim](../scripts/native/conventions/fail-environment.py) makes only
the runner-owned `xcodebuild -version` return exit code 7. Actual CLI commands and
native builds remain enabled. Both runners use the same real iPhone 16 Pro /
iOS 18.6 ARM64 simulator, and comparisons run sequentially:

| Run                                                                                 | Metadata                                                   | Native acceptance                          | Cleanup               |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------ | --------------------- |
| Former runner at `3fc652ef32d0bd62395959b6e60faa37894e5739`, injected probe failure | Process exits before report                                | App never spawned                          | No fixture edits made |
| Corrected runner, same injection                                                    | Xcode `null`, explicit error code 7; other probes retained | 24 checks + seven template invariants pass | Pass                  |
| Corrected runner, normal PATH                                                       | Complete, no metadata errors                               | 24 checks + seven template invariants pass | Pass                  |

[Comparison and parent traces](./evidence/ios-vite-environment-183/controlled/comparison.json),
[controlled results](./evidence/ios-vite-environment-183/controlled/results.json),
[normal results](./evidence/ios-vite-environment-183/normal/results.json), command
journals, CLI logs, environment reports, template probes and cleanup outcomes are
retained alongside [source hashes](./evidence/ios-vite-environment-183/sources.json).
The control proves failure isolation; an injected nonzero exit does not reproduce
the hosted OS timeout. Unit coverage separately verifies timeout signal retention.

The normal local environment is Xcode 27.2, Node 20.19.4, NativeScript CLI 9.1.2,
Core 9.1.4, NativeScript-Vue 3.1.2, iOS runtime 9.1.0, native Vite 8.0.20 and
Vite 8.3.4. Nine Node tests pass, including real subprocess failure, waiting for
other outstanding command journals, malformed simulator metadata, missing selected
runtime, timeout details, launch ownership and independent cleanup. The ordinary
native shell/helper checks, 987 library tests (ten existing skips), root types and
formatting pass.

[Actual application video](../docs/public/media/ios-vite-environment.mp4) records
the controlled corrected run: startup, page/modal navigation, live template,
middleware and route edits, invalid-metadata recovery and the final 24-check
screen. The complete 40.23-second H.264 recording retains all 870 frames and
relative timestamps; only the MP4 container is remuxed for streaming.
[Video metadata and hashes](./evidence/ios-vite-environment-183/video.json) identify
that exact run. The injected error remains in the environment report and command
journal, rather than being hidden by the successful native result.

## Hosted validation and remaining scope

[Focused hosted run 43558005810](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43558005810)
passed on `ff06e39cd0ae761150e8423c11d35f6209f05c7b`: 24 native checks, all seven
template invariants and cleanup. The [retained hosted evidence](./evidence/ios-vite-environment-183/hosted/provenance.json)
includes the complete original artifact, command journals and job/CLI logs.

All four environment commands hit their unchanged deadlines in this hosted run.
Their SIGKILL failures were preserved and every journal settled; native acceptance
then ran successfully. The report correctly marks metadata incomplete, with
Xcode/CLI/runtime fields null. This naturally exercises the correction beyond the
local injected control. The reason for the command stalls remains undiagnosed.

Verified hosted metadata: macOS ARM64, Apple M1 virtual host, Node 22.23.4, runner
image `20261104.0514.1`, Core 9.1.4, NativeScript-Vue 3.1.2, NativeScript iOS 9.1.0,
native Vite 8.0.20 and Vite 8.3.4. The workflow requests iPhone 16 Pro / iOS 18.6,
but no exact simulator runtime build, Xcode version or CLI version is inferred from
that configuration. The [stage 3 follow-up](./native-ios-vite-provenance-183.md) subsequently captured
complete toolchain provenance on a run that failed native startup; it preserves
that failure separately.
Later commits only add the evidence/report, test shim and a Node test ordering
correction; acceptance runner and observer source hashes match the hosted commit.

The Android foldable mismatch was already fixed by PRs #186/#187, with two
[complete focused hosted passes](./native-foldable-drawer-settlement.md).
This stage keeps #183 open. The historical hosted launch cause and a complete
required native matrix on one acceptance commit remain separate work.
A passing focused lane does not certify the full matrix,
physical devices or release readiness. Reproduce the control using the
[runner instructions](../scripts/native/conventions/README.md#controlled-environment-failure).
