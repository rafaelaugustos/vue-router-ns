# Android native gesture startup — #183

The [original full-matrix run](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43641895641)
failed its Android 36 cancellation check: the fixture observed 24 native gesture
events, all with zero progress. The current native Frame was resumed, focused
and topmost, and the cancelled page/history remained intact. The original
[artifact](./evidence/ios-job-budget-183/hosted/artifacts/contracts-android-36.zip)
is retained, including SystemUI's slow-dispatch messages during gesture startup.

## Correction

The contract input driver now crosses the system edge threshold with a short
initial movement, waits for the app to acknowledge native gesture startup, and
then continues its outward movement before cancelling. The fixture publishes a
fresh PID/sequence token on the next app turn after its first public
`useBackGesture` observation. The driver requires that exact token and an active
gesture, with a five-second acknowledgement deadline. The existing outer ADB
timeout still bounds the instrumentation command.

All motion remains real system input through public `UiAutomation`. The fixture
does not invoke native callbacks, manufacture progress, replace a Frame or
change router behavior. Cancellation still requires positive native progress,
the same Page, unchanged native/logical history and reset transforms. Commit,
guard, modal, process restoration and retention checks remain intact. Calls
without a token retain their previous input sequence, including the separate
predictive-Back suite.

Android 16's
[native callback dispatcher](https://android.googlesource.com/platform/frameworks/base/+/android-16.0.0_r1/core/java/android/window/WindowOnBackInvokedDispatcher.java)
arms its motion tracker while handling Back start and resets the start location
on the first subsequent move. The
[touch tracker](https://android.googlesource.com/platform/frameworks/base/+/android-16.0.0_r1/core/java/android/window/BackTouchTracker.java)
clamps inward displacement to zero. If app startup processing is delayed until
the outward segment has ended, a cancelling drag can therefore produce native
events without positive progress. The controlled experiment below exercises
that condition; it does not establish the exact queue delay in the original CI
failure.

The Android job is also extracted into `native-contracts-android.yml`, callable
from the existing matrix and independently dispatchable after merge. Its two
API levels, steps, negative control, budgets and 30-minute deadline are preserved
verbatim. The required aggregate still includes Android.

## Local validation

All local runs use published Core 9.1.4, NativeScript-Vue 3.1.3 and Android
runtime 9.1.1 on a dedicated Pixel 7 ARM emulator, 1080×2400 / density 420.
The existing Android 36 beta image was used for the initial controlled pair;
the downloaded Google APIs r07 image uses Android 16 build
`BE2A.250530.026.F3/13894323`, matching the original CI build identifier with a
different CPU architecture.

| Image   | App/driver                       | Result                        | Cancel events / peak |
| ------- | -------------------------------- | ----------------------------- | -------------------- |
| 36 beta | Original, no delay               | All 18 reports passed         | 55 / 0.3345          |
| 36 beta | Original + 650 ms callback delay | Expected cancellation failure | 30 / 0               |
| 36 beta | Corrected + same 650 ms delay    | All 18 reports passed         | 54 / 0.2413          |
| 36 r07  | Corrected, no delay              | All 18 reports passed         | 60 / 0.3167          |
| 36 r07  | Original + 650 ms callback delay | Expected cancellation failure | 30 / 0               |
| 36 r07  | Corrected + same 650 ms delay    | All 18 reports passed         | 57 / 0.2413          |

The delay exists only in isolated fixture builds, immediately after counting
the first native gesture event. It is absent from the committed fixture. The
exact [original control patch](./evidence/android-gesture-start-183/delayed-fixture.patch)
and [corrected control patch](./evidence/android-gesture-start-183/delayed-ready-fixture.patch)
are retained. A separate
[mismatched-token control](./evidence/android-gesture-start-183/stale-token-driver.patch)
failed with `App did not acknowledge native gesture start within 5000ms`,
without reporting a successful gesture. Acknowledgement cannot substitute for
the unchanged positive-progress assertion.

The former-HMR control also detected its intended regression on r07. Its first
local build was invalid: the temporary worktree's `dist` symlink resolved
outside the existing webpack fault-loader include path, so `fault=true` was
present without the intentional code replacement. The acceptance check rejected
that build. After replacing only the temporary symlink with an identical real
copy, inspection confirmed `child.ceReload = undefined` in the APK and the
negative validator passed. Both attempts are retained.

The [local inventory](./evidence/android-gesture-start-183/local-validation.json)
and [build provenance](./evidence/android-gesture-start-183/local-provenance.json)
include all runs, logs, reports, environment metadata, APK hashes and deliberate
failures. Unit tests passed: 988, with 10 existing skips. Type checking, build,
documentation build, formatting and native helper checks also passed.

Local correctness runs do not claim the x86 CI timing baseline: the baseline
validator checks host, architecture, model and display metadata. Hosted
validation applies the existing reviewed profiles.

## Hosted validation

Both Android contract jobs in
[run 43772034713](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43772034713)
passed on `f7892f0254b78ec3589f30f1539faa1a56474d34`, attempt 1:

| API | Job duration | Cancel events / peak | Native-start acknowledgement | Median / p95 |
| --- | ------------ | -------------------- | ---------------------------- | ------------ |
| 34  | 9m56s        | 26 / 0.3045          | 211 ms                       | 461 / 556 ms |
| 36  | 11m45s       | 26 / 0.2425          | 311 ms                       | 461 / 507 ms |

Each job completed all 18 positive reports, detected the former-HMR regression,
validated native destinations and incoming links/launcher entries, and passed
the unchanged timing/retention profiles. All four measurement batches retained
zero JS Pages and zero native Fragments. The process restoration checks used
different PIDs. Both jobs remained within their unchanged 30-minute limits;
there were no job retries or raised acceptance thresholds.

The separate predictive suite passed on APIs 34, 35 and 36, exercising the
driver's existing behavior without a readiness token. The broader matrix also
recorded a separate Android flows timeout waiting for the system document
picker. Other jobs were still running when this evidence snapshot was taken;
this report establishes the Android contract result, not closure of #183.

[Hosted validation and environments](./evidence/android-gesture-start-183/hosted/validation.json),
[job records](./evidence/android-gesture-start-183/hosted/jobs.json),
[artifact metadata](./evidence/android-gesture-start-183/hosted/artifacts.json)
and both original archives/logs are retained. The runtime, fixture, driver and
workflow files in the later evidence commit are identical to the tested code
commit.

## Recording

[Actual Android 36 app recording](../docs/public/media/android-gesture-start-evidence.mp4)
is the unmodified 80.7-second screen recording of the normal r07 run. Around
7–12 seconds it shows a real cancelled Back and `PASS cancel-check`; around
12–17 seconds it shows a committed Back and `PASS commit-check`. The rest covers
guard refusal/allowance, modal result and process restoration. Precise progress,
identity and PID checks are recorded in the accompanying native reports.
