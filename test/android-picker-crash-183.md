# Isolate Android picker inspection and reject native crashes — #183

The Android flows job in
[run 43772034713](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43772034713/job/132989971192)
ended with a timeout waiting for the second document picker. Its first meaningful
failure was earlier: `com.google.android.documentsui` crashed in
`AsyncTaskLoader.onCancelLoad`, called from `MultiRootDocumentsLoader.QueryTask`
on a provider thread. The app then received cancellation and reported `pick:user`.
The capture named `system-picker` already shows the app's picker page, not the
system UI. The old driver subsequently sent Back to that page, accepted the
earlier cancellation as success, and continued with a disposed page.

The [original artifact](./evidence/android-picker-183/original/flows-android.zip),
[job log](./evidence/android-picker-183/original/job.log), native crash log and
hierarchy remain intact. This establishes a system-process crash and a driver
failure cascade; it does not establish the internal cause of Android's loader
exception. The router did not emit a fatal JavaScript error in that run.

Android documents that a child Activity crash can return `RESULT_CANCELED` to
its caller. Consequently, the app's cancellation outcome alone cannot prove a
successful user-driven cancellation test.
[Android Activity reference](<https://developer.android.com/reference/android/app/Activity#onActivityResult(int,int,android.content.Intent)>).

## Shared-storage interference

The first candidate's [hosted run 43791144765](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43791144765)
passed the first cancellation and selection, then failed to find the document
after rotation. Its system log shows repeated MediaProvider deletions attributed
to `com.android.shell` and DocumentsUI content reloads whenever the driver
removed/recreated `/sdcard/flow-ui.xml`. There was no native fatal exception in
this attempt. The unmodified iOS job passed all six XCTest cases. Both artifacts
and the Android failure log are [retained](./evidence/android-picker-183/hosted-attempt1/).

A controlled comparison used the same open picker and APK, changing only the
dump path for five consecutive observations per phase:

| Dump location                   | MediaProvider deletions attributed to shell | DocumentsUI content updates |
| ------------------------------- | ------------------------------------------: | --------------------------: |
| Shared storage, first phase     |                                           4 |                          18 |
| `/data/local/tmp`, middle phase |                                           0 |                           0 |
| Shared storage, final phase     |                                           5 |                          19 |

The [probe archive](./evidence/android-picker-183/provider-probe.zip) contains all
15 hierarchies, the full system log with phase markers, counts, fingerprint and
reproduction script. The first shared phase starts without a dump file, hence
four deletions for five observations. The picker remained visible throughout.
This verifies that inspection was modifying the provider being tested; it does
not prove that these notifications caused the original Android loader NPE.

## Transient missing observations

The second candidate's [hosted run 43792609235](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43792609235)
stopped at its first picker visibility check: `uiautomator` exited zero without
creating a hierarchy file while the Activity was opening. The immediately
following failure capture contained DocumentsUI, with no fatal process crash.
The [full artifact and job log](./evidence/android-picker-183/hosted-attempt2/)
are retained. iOS again passed six tests.

The final helper removes the old XML before inspection and treats only the
specific missing-file result as an unavailable observation. Existing visibility
waits can observe again within the same deadline; empty XML cannot authorize
Back. `observations.json` retains the dump's stdout/stderr and read error.
Permission/transport errors and nonzero dump commands still fail. Fatal process
logs are checked even when a hierarchy is unavailable.

## Correction and boundaries

Hierarchy dumps now use `/data/local/tmp/router-flow-ui.xml`, outside shared
storage, so repeated inspection does not create/delete MediaStore documents.

The driver resolves the actual picker package, correlates fatal AndroidRuntime
blocks by PID/process, and rejects app or picker crashes before accepting
outcomes or issuing further input. It requires a fresh hierarchy belonging to
the picker immediately before Back. Old hierarchy files are removed before
each dump. A failed observation cannot reuse a previous window's XML.

The driver retains a structured failure, input-action timestamps, the exact
package/version and device environment, and full timestamped system logs.
All twelve scenarios and their existing deadlines remain enabled. The final
owner-closure cleanup only sends Back if the picker still exists; the preceding
closure/disposal assertions still run. An explicit emulator serial is required.

There are no package-runtime, app-fixture, emulator-image or workflow changes.
There is no automatic picker restart or scenario retry. This stage removes inspection-induced provider changes, false
acceptance and misleading follow-on input; **it does not patch DocumentsUI's
loader crash**. A recurrence must fail acceptance at the original crash.
Hierarchy inspection and system input are separate OS operations, so this does
not claim an atomic guarantee against a crash occurring between them. The
post-input log check also rejects such a crash.

## Local reproduction and validation

All local native executions use one unchanged APK built at
`f98385e013add4039f7bbd670d3310db5ebc35c0`, published Core 9.1.4,
NativeScript-Vue 3.1.3 and Android runtime 9.1.1. The dedicated Pixel 7 emulator
uses Google APIs Android 35 r09 ARM, build `AE3A.240806.043/12960925`, with
DocumentsUI version 15 / code 350820300, on macOS ARM. The original CI image was
Google APIs Android 35 r09 x86_64; its old driver did not record the fingerprint
or picker version. The first candidate hosted run records build
`AE3A.240806.043/12960925` and DocumentsUI version 15 / code 350820300.

| Execution                                 | Outcome                                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Original driver, ordinary run             | All 12 native outcomes passed                                                                      |
| Original driver, induced picker crash     | Incorrectly accepted `pick:user`, popped the page, then timed out                                  |
| Corrected driver, identical induced crash | Failed immediately on the native crash; no Back sent and no accepted `pick:user`                   |
| Corrected driver, ordinary run            | All 12 native outcomes passed                                                                      |
| Corrected crash control, recording        | Same expected failure; no Back sent and picker page remained visible                               |
| Private-path driver, ordinary run         | All 12 native outcomes passed; no shell MediaProvider deletions or DocumentsUI content-update logs |
| Private-path driver, induced crash        | Failed on the native crash; only guard accepted, no Back sent                                      |

The final `7ea14b2` driver was then validated separately: all twelve outcomes
passed, and an identical induced native crash again accepted only the guard
case and sent no Back. Both final runs have their own archived artifacts and
source identities in the inventory below.

The first corrected runs use candidate `8710040`; private-path runs use
`86a9824`. The final driver is `7ea14b2`, adding transient missing-observation
handling without changing scenario deadlines or allowing stale XML.

The crash controls use Android's `am crash` once while the real picker is open.
They leave the APK and router unchanged. They reproduce the driver cascade,
not Android's particular loader NPE. The injection exists only in isolated
copies of the driver; the exact original/corrected patches are retained. The
corrected control's accepted-results file contains only the preceding guard
case, and its actions contain no `back-requested` or `back-sent` entry.

Seven regression tests cover the original CI fatal log and returned-app XML,
interleaved process crashes, unrelated processes, normal automation shutdown,
empty hierarchies, stale-file removal, missing observations, command failures
and package names appearing only as text. The full suite
passed 995 tests, with 10 existing skips. Types, build, documentation build,
formatting and native helpers also passed. An earlier local full run timed out
in the unchanged webpack-watch test; the subsequent full run with the dedicated
emulator stopped passed without changing its timeout. Both logs are retained.

[Local inventory](./evidence/android-picker-183/local-validation.json) and
[provenance](./evidence/android-picker-183/provenance.json) retain the ordinary
runs, deliberate failures, binary/source hashes and recording metadata.

## Recordings

[Normal native suite](../docs/public/media/android-picker-normal-evidence.mp4)
is the complete 114.8-second recording, compressed to H264 without cuts or speed changes. It shows actual cancellation, document
selection, rotation, concurrent requests, disposal, modal presentation,
Activity recreation, process recovery and owner closure. The native reports
provide the identity, history and exactly-once checks. Both videos use the final
`7ea14b2` driver and record to the shell temporary directory.

[Controlled system crash](../docs/public/media/android-picker-crash-evidence.mp4)
is the complete 20.0-second recording, compressed with the original timeline.
The real picker is visible around 17 seconds and the unchanged app page returns
around 20 seconds. Its `pick:user` label reflects Android's cancellation callback;
the corrected runner rejects that result and sends no Back. The accompanying
failure/actions logs establish that rejection, rather than the app label alone.
