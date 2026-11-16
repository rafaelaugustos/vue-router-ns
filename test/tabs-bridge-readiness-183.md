# Native tab visibility bridge readiness — #183

The visibility driver now waits for a readiness reply from a loaded native
tab host and Page. Previously, it accepted the existence of `result.json`,
which `File.fromPath` creates empty before the native host becomes available.
This started the command deadline prematurely on a slow launch.

Each process now supplies a fresh session identifier. The driver waits for
that session on initial launch, saved-history restoration and the cold OS
link, replacing the two fixed restart sleeps. Commands carry the session and
are published by rename so the fixture cannot consume a partially copied
request. File errors retain their command identity and stack. The initial
30-second readiness budget and the existing 80 command polls are unchanged.

Failure evidence now includes the phase, last raw reply/read error, actual
command/result files, source/device identity and, on Android, logcat,
Activity/window state and process exit records. Launch failures are covered
by the same diagnostic cleanup as scenario failures. Package runtime code,
dependencies and native scenario assertions are unchanged.

## Original failure and limits

[Run 43795665265](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43795665265/job/133063792200)
passed smoke, tabs and tab appearance, then failed at visibility's first
`snapshot` with `undefined !== 1`. Its only visibility artifact was the
outbound command. It retained no reply or runtime evidence for this fixture,
so it cannot establish whether the host was delayed, the process failed, or
the bridge encountered a file error. State acceptance was not reached.

The [original artifact](./evidence/tabs-bridge-183/original/native-smoke-android.zip)
and [job log](./evidence/tabs-bridge-183/original/job.log.gz) are preserved with
their source and checksums in [provenance](./evidence/tabs-bridge-183/provenance.json).
The controlled reproduction below establishes the readiness defect; it does
not identify the original CI failure's underlying cause.

## Native validation

Android runs used an isolated Pixel 7 / API 34 Google APIs ARM emulator,
Core 9.1.4, NativeScript-Vue 3.1.3 and Android runtime 9.1.1. The generated
manifest includes the workflow's RTL, predictive Back and `vuerouterns`
intent-filter settings. Hosted Android uses x86_64; the original job did not
record its fingerprint. UIKit regression used a dedicated iPhone 16 simulator
with iOS 18.6 and runtime 9.1.0.

| Execution                                                           | Outcome                                                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Unchanged baseline `52fe65c`                                        | 29 Material checks pass                                                                                                  |
| Candidate `8e5c85a`                                                 | 29 Material checks, 21 signed-release Core checks and 20 UIKit checks pass                                               |
| Baseline with root reference delayed 20 seconds                     | First `snapshot` fails with the original `undefined !== 1` error                                                         |
| Candidate with the identical delay                                  | All 29 checks pass, including fresh sessions after both process restarts                                                 |
| Candidate driver with baseline app (empty file, no readiness reply) | Fails at the 30-second readiness boundary; sends no command and retains raw empty reply, parse error and system evidence |

The delay controls change only the fixture's `onLoaded` assignment to use a
20-second timer. Their patches are in the [raw local archive](./evidence/tabs-bridge-183/local-runs.zip),
alongside every native driver log, result and the negative-control diagnostics.
They do not change the router or driver deadlines. The delayed fixture is not
shipped. The ordinary candidate and baseline also passing locally means this
stage does not attribute all successful starts to the new handshake.

Material acceptance retains cancelled and committed native Back, Page identity,
hidden-bar accessibility and reclaimed height/rail width, guards, modal
isolation, visible overrides, failed routes, deep links and restored histories.
The three distinct sessions in each Android candidate run cover initial
launch, restoration and the cold link. UIKit checks two process sessions.
The iOS gesture/cold-link XCTest was not rerun for this bridge-only change.

All 995 unit tests passed with 10 existing skips. Root/demo type checking,
native helper checks, formatting and documentation build passed.
[Local inventory](./evidence/tabs-bridge-183/local-validation.json) summarizes
the raw runs without replacing their evidence.

## Recording

[Android acceptance video](../docs/public/media/android-tabs-bridge-183.mp4)
shows the real app over 41.1 seconds: hidden/visible tabs, native Back, guards,
modal navigation, rail changes, restoration and a cold link. It corresponds
to the 29-check `recorded` run in the local archive. The video preserves the
recorded timeline with H264 compression only; [metadata and hashes](./evidence/tabs-bridge-183/video.json)
identify the original capture and the published file.
