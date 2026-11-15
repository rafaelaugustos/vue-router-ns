# iOS drawer job duration — #183 stage 6

The [previous full matrix](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43641895641)
cancelled the iPad drawer job at its 20-minute job limit. The rotation scenario
started at 21:43:21 UTC, **18m54s after the job began**, and was interrupted 80
seconds later. GitHub's retained annotation identifies the job limit. The
rotation command's own 240-second deadline had not expired. Its artifact
contains only four setup commands; no completed rotation case can be inferred
from that run. The [original evidence](./ios-job-budget-183.md) remains intact.

## Change

The drawer workflow now runs two independent suites on each existing device:

- **drawer:** binding, accessibility and lifecycle, Reduce Motion, real input,
  navigation and rotation with the basic fixture.
- **adaptive:** identity, history and modal results, Reduce Motion, real input
  and rotation with the adaptive fixture. On iPad this also runs orientation
  requests during active native navigation.

All four jobs retain the original **20-minute job limit**, with separate
simulators and artifacts. The parent workflow still requires the drawer group
and all other eight groups. Its expanded full matrix now has 23 device jobs.
The adaptive fixture is built before simulator creation in its own job, avoiding
the basic fixture's earlier builds and tests in the same deadline.

All 20 original step bodies are preserved. Changes are suite conditions, the
position of the adaptive build, unique simulator/artifact names, and enabling
the rotation driver's existing video recorder. The static comparison retains
the original device profiles and required aggregate. No package runtime,
fixture, native input, identity/history assertion or negative control changes.

The rotation runner reuses the command-log helper introduced in #214, writing
XCTest stdout/stderr while the command executes. Its **240-second/16-MiB**
limits and failure propagation remain. Its entire case collection/validation
and follow-up navigation section is unchanged, including the explicit handling
of gestures that were not reproduced. Existing process tests cover live output,
nonzero exit, deadline and interruption of the outer runner.

## Acceptance

The [focused four-job workflow](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43763592731)
runs on `941d13bb377889e737d64b60a734d9f1e53e04cd`, based on merged #214
(`fbfb7b6e399d125a7aaec39b1ded4f271250316b`). Its first attempt completed with
**three successful jobs and one failure**, without a job timeout or retry:

| Device         | Suite    | Duration | Result                    |
| -------------- | -------- | -------- | ------------------------- |
| iPhone 16      | drawer   | 10m47s   | Passed                    |
| iPhone 16      | adaptive | 12m06s   | Passed                    |
| iPad Pro 11 M4 | drawer   | 12m44s   | Passed                    |
| iPad Pro 11 M4 | adaptive | 11m07s   | Failed in rotation XCTest |

Both basic jobs completed 18 ordinary and 18 Reduce Motion reports plus their
native input/navigation XCTest. Both adaptive jobs completed 38 ordinary and
38 Reduce Motion reports plus their native input XCTest. Their intentional-pop
negative controls correctly report lost Page/entry preservation after the pop,
with no diagnostic issues. The iPad-only rotation then failed as described below.

The iPad rotation started **9m13s after runner allocation**, instead of 18m54s,
and ran for 97 seconds before XCTest returned a failure. Job time includes
cleanup and excludes queue wait; these are individual observations, not a
performance benchmark. This execution establishes that the job deadline no
longer interrupted the rotation command. **It does not establish passing
rotation acceptance or a green drawer group.**

The native shell helpers, nine observer tests and four command-log tests passed
locally, as did JavaScript syntax, formatting and the workflow/assertion audit.

## First rotation failure

`test01ProgrammaticNavigation` passed its four push/back directions and wrote
four finished reports. Each reports one settlement and an orientation request
during native navigation; UIKit deferred the visible rotation until navigation
ended. These reports are partial evidence: the JavaScript runner's complete
ten-case validation and follow-up guard/modal checks were **not reached**.

The first meaningful failure is `test02IntendedCommit`: the driver did not
observe an active native navigation coordinator within its unchanged five-second
observation deadline. XCTest records the first drag starting at `(80.1, 388.4)`
relative to the application origin, with a horizontal offset of 613.1 points.
The test derives this position from a text field's accessibility frame; its log
also records interface-orientation changes around that frame query. That makes
input geometry/readiness a concrete follow-up to investigate, **not a proven
root cause**. No native gesture-origin report was copied for this failed case.

The following intended-cancel and settled/modal methods fail to arm their
rotation observer. The runner preserves the nonzero XCTest result and fails;
it does not count the programmatic subset as a successful matrix. Gesture
coordinates, observation deadlines and the existing distinction between
exercised and not-reproduced gestures are unchanged in this stage.

The workflow and logging changes are reviewable, but the PR remains a draft
while this native acceptance failure is unresolved. A green ordinary PR CI must
not be interpreted as a passing rotation scenario.

## Video and provenance

[Original hosted simulator recording](../docs/public/media/ios-drawer-rotation-evidence.mp4)
shows the actual iPad application, programmatic orientation changes and the
attempted gesture that fails to start navigation. It is **failure evidence**,
not a passing demonstration of all rotation cases. The full 61.74-second,
329-frame recording is preserved byte for byte, without cuts or overlays.
[Video metadata](./evidence/ios-drawer-budget-183/video.json) records its hash,
source job and archive member.

[Run metadata](./evidence/ios-drawer-budget-183/run.json),
[job records](./evidence/ios-drawer-budget-183/jobs.json) and
[artifact inventories](./evidence/ios-drawer-budget-183/artifacts.json) retain all
four complete original uploaded archives, the four original job logs, XCTest
bundles, native reports and file hashes. The
[workflow audit](./evidence/ios-drawer-budget-183/workflow-audit.json) and
[source hashes](./evidence/ios-drawer-budget-183/sources.json) identify the
preserved commands, fixture and native-input implementation. The
[prior cancellation record](./evidence/ios-drawer-budget-183/original-cancellation.json)
references the already-retained full original archive and annotation.

The iPad job log records macOS 15.8.2/24H232, ARM64 image
`20261104.0514.1`, Xcode 16.4 and an iOS 18.6 simulator. The tested demo manifest
pins Core 9.1.4, NativeScript-Vue 3.1.3 and iOS runtime 9.1.0. These package
versions are manifest pins; this workflow did not independently export an
installed-package inventory or the CLI version. Later commits retain evidence
and documentation only; the tested code remains unchanged.

This focused workflow is separate from full-matrix acceptance. The last full
run also failed Android API 36 gesture progress, foldable drawer settlement and
iPad window reconnection. Those causes remain separate investigations. Ordinary
PR CI skips device jobs, and #183 remains open until the complete required
matrix passes on one acceptance commit. No merge, release or physical-device
acceptance follows from this stage.
