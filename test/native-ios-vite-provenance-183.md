# Complete iOS toolchain provenance — #183 stage 3

The iOS Vite runner now measures native tool versions once after acceptance and
owned-process cleanup. Source commit, initial dirty state, host and installed
package versions are captured before the fixture edits files and preserved in the
final report. Native query deadlines remain 20 seconds; failed probes remain
explicit, and no retries, readiness increases or assertion changes are introduced.

## Evidence for moving the observation

[The stage 2 hosted run](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43558005810)
passed all native checks, but all four environment queries immediately after
simulator boot timed out. Later simulator diagnostics in the same run succeeded;
for example, `launchctl list` completed in 3,375 ms. The complete original artifact
and journals remain in the [stage 2 evidence](./evidence/ios-vite-environment-183/hosted/provenance.json).
This supports testing a later observation phase, without claiming to diagnose why
the original subprocesses stalled.

The initial environment report now has `device.metadata.phase: "pending"`.
After native acceptance, recorder/CLI shutdown, source restoration and app-stop
attempts, the four version/runtime probes run once. The final report records
`phase: "after-cleanup"` and `collectedAt`. Its source/package snapshot is kept
from the start, rather than re-reading the checkout while acceptance is editing it.
If a probe fails, its null value and error remain explicit. If a cleanup step fails,
later steps still run; the existing outcome gate still reports that failure.

## Local validation and recording

The normal run at `75accbeb5c5b3152a8fae2e968b421ad887ba602` passed all 24 native
navigation/watch checks, seven template-retention invariants and cleanup, with
complete metadata: Xcode 27.2 / 27B52, NativeScript CLI 9.1.2, iPhone 16 Pro /
iOS 18.6 / 22G86 ARM64 simulator, Node 20.19.4, Core 9.1.4, NativeScript-Vue 3.1.2,
NativeScript iOS 9.1.0, native Vite 8.0.20 and Vite 8.3.4.

The retained [initial report](./evidence/ios-vite-provenance-183/normal/environment-initial.json)
and [completed report](./evidence/ios-vite-provenance-183/normal/environment.json)
have identical source, initial dirty state and package snapshots. The initial
checkout was clean. [Command ordering](./evidence/ios-vite-provenance-183/normal/probe-order.json)
shows exactly four probes after app-stop completion, each using the unchanged
20-second deadline. [Native results](./evidence/ios-vite-provenance-183/normal/results.json),
template state, CLI logs and cleanup outcome are retained with
[source hashes](./evidence/ios-vite-provenance-183/sources.json).

The existing [controlled version failure](../scripts/native/conventions/fail-environment.py)
was also exercised with the new ordering. All 24 + 7 native checks and cleanup
passed. The Xcode query still reports exit code 7, Xcode remains null and metadata
is marked incomplete in the [control report](./evidence/ios-vite-provenance-183/control/environment.json).
The [control journal](./evidence/ios-vite-provenance-183/control/probe-order.json)
confirms the failed query was attempted once after cleanup. This guards the prior
failure-isolation behavior; it does not reproduce a hosted OS stall.

[Actual application recording](../docs/public/media/ios-vite-provenance.mp4) shows
startup, native page/modal navigation, live template/middleware/route edits,
invalid-metadata recovery and the final 24-check screen of the normal run. The
complete 43.31-second H.264 video retains all 835 frames and relative timestamps;
only its MP4 container was remuxed for streaming. The recording ends before the
cleanup-time probes, whose ordering and results are established by the journals.
[Video metadata](./evidence/ios-vite-provenance-183/video.json) includes hashes.

The nine existing observer/subprocess/metadata/cleanup tests and native helper
checks pass. The 987 library tests pass, with ten existing skips.

## Hosted validation

[Hosted run 43559694354](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43559694354)
on `75accbeb5c5b3152a8fae2e968b421ad887ba602` completed all four metadata probes
after cleanup attempts, without retries. Exact observed versions: Xcode **16.4 /
16F6**, NativeScript CLI **9.1.2**, iOS **18.6 / 22G86** on the dedicated iPhone
16 Pro simulator. The host is macOS ARM64 / Apple M1 Virtual, Node 22.23.4, runner
image `20261104.0514.1`. The installed package versions match the local list above.
The initial source snapshot is clean; metadata is complete with no probe errors.
[The command ordering](./evidence/ios-vite-provenance-183/hosted/probe-order.json)
records 574 ms for Xcode, 5,791 ms for the CLI, and 1,463/1,424 ms for simulator
devices/runtimes, within the unchanged 20-second deadlines.

**Native acceptance failed in this run.** Build, installation and bundle transfer
completed, but the app reported HTTP import network errors for
`/ns/core/debugger/devtools-elements.common` and `/ns/m/src/app.ts` from the Vite
server. The runtime reported a fatal main-module instantiation error and never
produced a ready phase or native results. The runner subsequently exhausted its
existing readiness deadline. Recorder cleanup also required SIGKILL; that secondary
failure is retained, and the unsuccessful run remains unsuccessful.

The [full original artifact and job/CLI logs](./evidence/ios-vite-provenance-183/hosted/provenance.json),
including the failed recording, diagnostics and complete environment report, are
preserved with hashes. Completing provenance on this failed run demonstrates the
failure path; it does not establish passing hosted navigation/HMR or diagnose
the HTTP failure. Later commits only add documentation/evidence; runner and helper
source hashes match this hosted commit.

## Remaining #183 scope

The Android foldable drawer mismatch was already corrected by merged PRs #186/#187,
with two complete hosted focused passes; see [the settlement report](./native-foldable-drawer-settlement.md).
This stage corrects earlier reports that mistakenly described that fix as pending.
The newly observed HTTP-import startup failure needs a separate investigation.
Revalidation in the complete required native matrix on one acceptance commit is
still outstanding. A successful focused lane does not certify that matrix or a
release. The exact cause of the historical November 9 iOS launch timeout remains
unproven; the reproduced competing launch and diagnostic-failure corrections are
documented separately. No merge, release or physical-device claim is made here.
