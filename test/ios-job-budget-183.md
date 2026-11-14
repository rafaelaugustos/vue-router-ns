# iOS job duration and live XCTest evidence — #183 stage 5

The original [full native run](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43600236191)
cancelled its serial iOS job at the 40-minute job limit. Native destinations only
started after almost 37 minutes of setup and unrelated fixture builds/tests; it
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
jobs and the merged Split selector correction. Results are being collected.
The Android foldable job has already failed a 3,000-ms drawer-settlement
assertion; it passed on the preceding matrix, so this remains an unresolved
failure, not a proven regression from this iOS-only change. No retry or assertion
change is used to conceal it. #183 remains open and the full matrix is not green.

Ordinary PR CI skips device jobs; its aggregate is not native acceptance. This
stage does not close the separate predictive API 36 progress investigation,
authorize a release or establish physical-device acceptance.
