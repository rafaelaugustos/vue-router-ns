# iOS job duration and live XCTest evidence — #183 stage 5

The original [full native run](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43600236191)
cancelled its serial iOS job at the 40-minute job limit. Native destinations only
started 38 minutes 43 seconds after the job began, following setup and unrelated
fixture builds/tests; it
received 89 seconds before cancellation. The command's own 180-second deadline
had not expired. The retained 17 initial destination checks do not establish
system-Back or process-restoration acceptance. The [original evidence](./native-matrix-183.md)
remains intact.

## Change

The iOS group now calls a reusable workflow with two independent jobs, each with
a 30-minute limit and its own simulator and artifact:

- **contracts:** fixed navigation/HMR contracts, former-HMR negative control,
  timing/retention budgets and native controller destinations/restoration.
- **composition:** real tab taps, tab appearance and visibility, cancelled
  gestures, real HTTP route data and native Suspense composition/gestures.

Both jobs must pass the existing required aggregate. The parent still requires
all nine groups; the expanded matrix now contains 21 device jobs. The original
23 steps and command bodies are preserved, apart from suite conditions and
simulator/artifact names. [The comparison](./evidence/ios-job-budget-183/workflow-audit.json)
records this check against merged base `ed58059f6688a4f747428c45c1ec3be3746722fc`.
Per-scenario deadlines, performance profiles, native assertions, dependencies
and fault controls are unchanged. Parallel jobs remove shared serial setup/test
time from the final scenario's deadline; this does not increase that scenario's
command timeout.

The destination runner now writes stdout and stderr to its log while XCTest
runs. Previously it only wrote the buffered output after the command returned;
termination of the outer CI process could therefore lose all pending output.
The helper retains `execFile` exit, timeout and buffer-limit behavior, including
the destination command's 180-second/32-MiB limits. A failed or timed-out command
still fails acceptance. Output already written remains available to the
existing always-run artifact upload.

## Local regression evidence and video

Four process tests verify live stdout/stderr, nonzero exit, timeout and
interruption of the outer runner. All pass, together with the existing native
shell helpers and nine observer tests. A buffered control implementing the old
write-after-exit behavior fails the two live/interruption tests as expected.
The [local archive](./evidence/ios-job-budget-183/local-destinations.zip) retains
both implementations/tests and their complete output.

The actual native destination scenario passed on clean source
`c953afe0766a1907920600cc5d5ee9d5452b87d0`, using a dedicated iPhone 16 Pro
simulator, iOS 18.6/22G86, Xcode 27.2/27B52, macOS ARM64/M4 Max, Node 20.19.4,
Core 9.1.4, NativeScript-Vue 3.1.3 and iOS runtime 9.1.0. Fresh blank-template
resources matched CI's setup; their exact files are retained. Original local
resources were restored and only the task's simulator was removed afterward.

The runner passed roundtrips, guarded results, native interactive Back, three
zero-instance GC rounds and restoration from PID 6025 to 6285. Before restart,
17 native instances had been created and 16 disposed, leaving only the visible
restore destination. The new process created/disposed one instance and returned
to `/`, with no diagnostic issues. While the runner was still executing, an
independent observer read the first 431 bytes of its XCTest log; that exact
prefix remained in the final 74,026-byte log. [The evidence index](./evidence/ios-job-budget-183/local.json)
contains these observations, reports, environment, complete XCTest result bundle
and individual retained-file hashes.

[Actual application video](../docs/public/media/ios-contract-destinations.mov)
shows the destination roundtrips, system-Back gesture and restoration screen.
It is the original 28-second simulator recording, with 349 frames, retained byte
for byte. [Video metadata and hash](./evidence/ios-job-budget-183/video.json)
identify the recording. Local success is separate from hosted acceptance.

## Hosted acceptance

The [complete native matrix](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43641895641)
was dispatched once on the same code commit `c953afe`, including both new iOS
jobs and the merged Split selector correction. The contracts job passed in
**17 minutes 17 seconds**, including the final destination scenario in 113
seconds. [Recorded timestamps](./evidence/ios-job-budget-183/durations.json) place
the destination start at 14m59s into the new job, versus 38m43s previously.
These durations exclude queue wait and are two observations, not a performance
benchmark. It produced 19 positive reports; the former fixture failed specifically
on covered-HMR native Page replacement with `fault: true`, as required. Forty
transition samples measured 267.96/304.47 ms median/p95 against unchanged
518.5/632.5-ms limits. All four retention batches had zero live JS Pages and one
retained native controller. Destinations passed three zero-instance GC rounds,
system Back and restoration from PID 35936 to 40794; the completed XCTest log is
retained. Hosted source was clean, on macOS ARM64/M1 Virtual, Node 22.23.4,
Xcode 16.4 and the same native package versions as the local run.

The composition job passed in **26 minutes 17 seconds**. All five scenario
steps completed: real native tab taps, 18 appearance reports, 20 visibility
reports and cancelled-Back XCTest, 21 real-HTTP reports, and 71 Suspense
observations with its native gesture tests. These report counts include commands
and snapshots, not 130 independent tests. Both iOS jobs stayed within their
30-minute limits with unchanged per-command limits.

The completed matrix has **17 successful device jobs, three failures and one
cancellation**, so its required aggregate failed. All jobs use the same source
commit and attempt 1; there was no matrix retry.

| Required group       | Device results                               |
| -------------------- | -------------------------------------------- |
| Android contracts    | API 34 passed; API 36 failed                 |
| iOS contracts        | Contracts and composition both passed        |
| UIKit Split          | iPhone and iPad both passed                  |
| Integration          | Android and iOS Vite passed; foldable failed |
| Page actions         | Android and iOS passed                       |
| iOS drawer           | iPhone passed; iPad cancelled                |
| Native flows         | Android and iOS passed                       |
| Predictive prototype | API 34, 35 and 36 passed                     |
| Native windows       | Android 34/36 passed; iPad failed            |

The merged Split correction now has hosted validation: 26 iPhone and 28 iPad
reports, each with no diagnostic issues and restoration in a second process.
The iPad's additional destination/scene-entrypoint steps also passed. iOS Vite
passed its 24 checks and cleanup on a clean source snapshot. All three
predictive prototype jobs passed 17 Core and 15 legacy reports, both recreation
modes, and the API 35 published-Core control failed at the expected
`back-after-recreate` state. API 36 now recorded 19 cancellation samples with
peak progress 0.1523. That success does not explain the preceding zero-progress
failure or certify published-Core predictive support.

Four nonpassing jobs require separate investigation:

- Android contracts API 36 stops at the fixed fixture's `cancel-check`: 24 native
  gesture events, peak progress zero, despite the Activity being resumed/focused.
  Its first four reports passed. Later contracts, budgets and the former-HMR
  control did not run. This uses published Core 9.1.4, distinct from the passing
  candidate-Core predictive job.
- Foldable fails its first `mode: overlay` command: drawer settlement exceeded
  3,000 ms with `state: 0`, `layoutRequested: false` and no events. The original
  uploaded artifact contains only that failed command report; this workflow did
  not capture a hierarchy or logcat at this failure. The complete job log is
  retained. The preceding matrix passed this same fixture; cause is unresolved.
- iPad windows passes normal lifecycle and cold scene restoration, then fails
  waiting 90 seconds for `PASS reconnect`/`FAIL reconnect` in the same-process
  reconnect scenario. The last native report is successful `detached`, PID
  19208; XCTest's failure hierarchy shows PID 21785. The evidence establishes
  missing reconnection acknowledgement and a changed process, not why it changed.
  Full uploaded XCTest bundles and reports are retained.
- iPad drawer is cancelled at its separate 20-minute job limit during
  `iPad rotation requested during active navigation`, confirmed by the GitHub
  annotation. The rotation artifact contains four setup commands and no completed
  rotation case; those remaining cases are unverified. Earlier steps succeeded
  and cleanup uploaded the original archive. This stage does not change the
  drawer workflow's deadline.

No retry, timeout extension or assertion change is used for these failures.
#183 remains open and the full matrix is not green.

Ordinary PR CI skips device jobs; its aggregate is not native acceptance. This
stage does not close the separate predictive API 36 progress investigation,
authorize a release or establish physical-device acceptance.

## Retained evidence

[Run metadata](./evidence/ios-job-budget-183/hosted/run.json) identifies the source
and attempt. [Job records](./evidence/ios-job-budget-183/hosted/jobs.json) retain
all 23 job logs, individual step outcomes and annotations for nonpassing jobs.
[Artifact records](./evidence/ios-job-budget-183/hosted/artifacts.json) identify
all 21 uploaded archives, GitHub digests/expiry dates and retained-file hashes.
Both iOS suite archives and all four nonpassing device archives are preserved
in full. Other passing archives retain JSON/text/XML/log files byte for byte;
their binary attachments remain in the original GitHub archives until expiry.
Those committed subsets are explicitly marked `completeOriginal: false`.

[Source hashes](./evidence/ios-job-budget-183/sources.json) identify the workflow
and logging change and the unchanged destination fixture, native gesture test,
validators and performance profiles. Later commits only add documentation and
evidence to the tested code commit.

The [ordinary PR CI](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43642652399)
passed 988 unit tests (ten existing skips), the native shell helpers, nine
observer and four command-log tests, formatting, types, package build and
documentation build.
