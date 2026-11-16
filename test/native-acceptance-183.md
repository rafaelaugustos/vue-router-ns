# Native acceptance and physical iPad revalidation — #183

This evidence stage validates the merged source
`63e43ec79a025776c368d2d8f9bc37786bb6027b` (PR #219). It changes no router,
fixture, driver, dependency, assertion or timeout. Physical-device evidence and
the full hosted matrix must be assessed separately: the connected iPad exercises
the public window baseline; deterministic scene disconnection uses the existing
simulator-only helper.

## Connected iPad

An isolated application identifier (`org.nativescript.routerwindows183`) was
installed on an iPad Pro 11-inch (3rd generation), iPadOS 27.0 (24A5418b), ARM64.
The local build used Xcode 27.2 (27B52), Core 9.1.4, NativeScript-Vue 3.1.3 and
iOS runtime 9.1.0. Existing application data was not reused or cleared.

The existing `WindowUITests/testWindows` ran unchanged except for its target
bundle identifier. Both executions passed all four reports:

| Execution           | Reports                     | Process             |
| ------------------- | --------------------------- | ------------------- |
| Baseline            | prepare, resume, HMR, close | PID 1756 throughout |
| Recorded repetition | prepare, resume, HMR, close | PID 1765 throughout |

The reports require independent native windows and histories, guarded Back,
independent modal results, retained drafts and reactivity after backgrounding,
script HMR in both windows, subsequent navigation, and complete Vue page cleanup
when B closes while A survives. The same PID is required within each execution;
the recorded repetition starts with a fresh installation of the isolated app.
Device orientation was unchanged before and after the run.

[Local provenance](./evidence/native-acceptance-183/local-validation.json),
[baseline reports](./evidence/native-acceptance-183/physical-baseline/) and
[recorded reports](./evidence/native-acceptance-183/physical-recorded/) retain the
results, source hashes and sanitized XCTest logs. Private device/signing identity
and local workspace paths are removed from published logs. The three raw archives
listed in provenance preserve byte-exact fixture JSON; readable copies differ
only in whitespace. Original XCTest bundles remain local.

This public baseline does not certify forced disconnection on hardware, natural
memory pressure, Stage Manager or repeated iPad resource collection. The broader
lifecycle coverage tracked by #188 remains separate.

## Same-process scene reconnect

A dedicated iPad Pro 13-inch (M4) / iPadOS 18.6 ARM64 simulator passed the existing
`RECONNECT_SCENES=1` driver. All five reports retain PID 76013. UIKit delivered a
real `sceneDidDisconnect` followed by another `sceneWillConnect` for the original
session. The checks require a new scene object, the retained Pages/Vue apps, an
actual controller stack matching the routes, and a pending result that remains
unsettled through disconnect and blocked Back before completing exactly once.
Retained reactivity, navigation, HMR and closure also pass.

[Reports and scene coverage](./evidence/native-acceptance-183/simulator-reconnect/)
record the actual lifecycle. This is the pre-existing simulator-only SpringBoard
fault injection, not a manual scene-delegate call or a physical-device claim.

An initial driver invocation stopped before native execution because its Ruby
child selected the system Ruby instead of the installed Ruby 3.3 used by the
project generator. Setting the local Ruby environment resolved that tooling
error; the unchanged native scenario then passed once. The initial environment
failure is retained alongside the successful driver log.

## Hosted acceptance

The full, unfiltered [Native contracts run 43811586390](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43811586390)
passed on the same merged source, attempt 1: **25 successful jobs**, including
23 native jobs, change detection and the aggregate gate. No job failed, skipped
or was cancelled. This supplies the same-commit full-matrix revalidation that
was missing after the individual fixes.

| Required group                             | Successful native jobs |
| ------------------------------------------ | ---------------------: |
| Android contracts, API 34/36               |                      2 |
| iOS contracts and composition              |                      2 |
| Android integration, foldable and iOS Vite |                      3 |
| UIKit Split on iPhone/iPad                 |                      2 |
| Drawer and adaptive drawer on iPhone/iPad  |                      4 |
| Native page actions on Android/iOS         |                      2 |
| System picker flows on Android/iOS         |                      2 |
| Predictive Back, API 34/35/36              |                      3 |
| Windows on Android 34/36 and iPad          |                      3 |

The two originally affected lanes both pass here: Vite records 24 checks,
seven template-retention invariants and successful cleanup; foldable records
38 adaptive commands, 21 fold checkpoints and 21 occluding-hinge checkpoints,
plus native input and adaptive hinge acceptance. Vite's captured environment
is macOS ARM64, Xcode 16.4 (16F6), iOS 18.6 (22G86), Node 22.23.4, CLI 9.1.2,
Core 9.1.4, Vue 3.1.2, iOS runtime 9.1.0, native Vite 8.0.20 and Vite 8.3.4.
The example's Vue pin is separate from the demo's 3.1.3. Android integration
also passes 29 Material visibility checks, 21 Core checks and all eight state
stages with six verified process deaths.

The [hosted iPad job](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43811586390/job/133114358955)
passes all three modes: baseline (four reports, PID 20598), cold reconstruction
(four reports, two different PIDs), and same-process reconnect (five reports,
PID 28012 throughout). The last mode records an actual scene disconnect and
reconnect for the original session, then passes retained Pages/results, HMR and
closure. [iPad validation](./evidence/native-acceptance-183/hosted/ipad-validation.json)
keeps those coverage distinctions explicit. The original
[iPad artifact](./evidence/native-acceptance-183/hosted/native-windows-ipad.zip)
includes the native reports and XCTest evidence.

[Run metadata](./evidence/native-acceptance-183/hosted/run.json),
[all jobs and steps](./evidence/native-acceptance-183/hosted/jobs.json),
[artifact inventory](./evidence/native-acceptance-183/hosted/artifacts.json) and
[validation summary](./evidence/native-acceptance-183/hosted/validation.json)
identify the acceptance source. Every original artifact was downloaded and its
SHA-256 checked against GitHub: 23 archives, 95,106,496 bytes. All 25 complete job
logs and text members of every artifact are committed. Full original archives
remain local; the complete iPad archive is also committed. The text archives
omit binary screenshots and XCTest objects, as recorded in the inventory.

## Investigation history and limits

The original November 9 logs and both affected artifacts are already preserved
with hashes in [original provenance](./evidence/ios-vite-183/original/provenance.json).
The stages leading to this acceptance remain independently reviewable:

- [Foldable settlement](./native-foldable-drawer-settlement.md), PRs #186/#187:
  a reproduced fixture synchronization defect observed drawer state before native
  completion. A later snapshot in the same process established the race on
  Core 9.1.4; native idle/layout observation replaced the timing assumption.
- [Vite launch ownership](./native-ios-vite-183.md), PR #210: a controlled delayed
  CLI launch demonstrated the runner issuing a competing launch. Launch ownership
  now stays with the CLI. [Environment collection](./native-ios-vite-environment-183.md)
  and [provenance/shutdown](./native-ios-vite-provenance-183.md), PRs #211/#212,
  retain diagnostic failures and fix the separately reproduced watcher shutdown
  defect with a real-server negative control.
- Later matrix findings were addressed separately: Split selectors (#213), iOS
  job scope (#214), native drawer edge coordinates (#215), Android gesture startup
  (#216), system-picker crash reporting (#217), state startup diagnostics (#218)
  and [tab bridge readiness](./tabs-bridge-readiness-183.md) (#219).

The original Vite launch timeout, later HTTP stalls and historical intermittent
Android startup failures lack enough original evidence to establish their exact
underlying causes. Controlled defects and successful revalidation do not prove
those historical causes. The previous hosted iPad reconnect failure did not
recur locally or in this full hosted matrix; its cause remains unproven. No
retry, weakened assertion or larger deadline is introduced in this evidence
stage. This completes current native revalidation without promoting experimental
features or authorizing a release.

## Actual physical-device video

[The 27-second iPad recording](../docs/public/media/ipad-windows-acceptance-183.mp4)
shows the actual app's two windows, modal interactions, retained draft after
resume, HMR and the surviving window after closure. It belongs to the recorded
execution (PID 1765), captured directly over USB with AVFoundation and no audio.

Personal Home-screen intervals during launch/background/closure and the trailing
idle period were removed. Playback speed within retained intervals is unchanged;
the published clip is not an uninterrupted timing record. [Video metadata](./evidence/native-acceptance-183/video.json)
lists exact source intervals, encoding, original and published hashes. The
untrimmed capture remains private.
