# Android state startup diagnostics and acceptance — #183

The Android integration job in [run 43772034713](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43772034713/job/132989971275)
passed the smoke, tabs, drawer, middleware, layouts and file-routing checks,
then stopped at the initial state fixture launch. Its failure screenshot shows
the NativeScript splash, the hierarchy is empty, and the state artifact has no
`STATE_RESULT` records or process-death transitions. The failure occurred before
the restoration assertions ran.

The [original artifact](./evidence/android-state-183/original/native-smoke-android.zip)
and [job log](./evidence/android-state-183/original/job.log) are preserved. The
filtered runtime log only contains automation startup/shutdown messages. It
does not establish why the app remained at the splash, and this stage does not
claim to fix an identified router or NativeScript startup defect.

## Delivered diagnostics

The state driver now streams a complete timestamped system log in addition to
the existing JavaScript/AndroidRuntime log. Its environment report records the
source identity, package versions, host and device fingerprint. On failure it
retains the current phase, Activity and window dumps, and process exit records
alongside the existing screenshot and hierarchy.

The fixture emits `STATE_BOOT` markers when its entry executes, when it starts
waiting for the router, and when the router becomes ready. These markers narrow
a future startup failure without treating absence of JavaScript output as a
specific diagnosis. A manual `android` selection runs the complete Android
integration sequence without starting the separate foldable/iOS Vite jobs.
The default `all` selection and reusable workflow retain all three jobs.

The eight state stages, native history/identity/scroll checks, six genuine
process deaths, deadlines and failure behavior are unchanged. There is no
automatic failed-start restart or scenario retry. The package runtime and
dependencies are unchanged.

## Local validation

The unchanged baseline and instrumented fixture were built separately from
`a52e11d` and `3d26a43`. Both use published Core 9.1.4, NativeScript-Vue 3.1.3 and
Android runtime 9.1.1, with an isolated Pixel 7 / Google APIs 34 ARM emulator on
macOS ARM. Its fingerprint is
`google/sdk_gphone64_arm64/emu64a:14/UE1A.230829.050/12077443:userdebug/dev-keys`.
The original hosted job used API 34 x86_64; its driver did not record a device
fingerprint, so the local fingerprint is not attributed to that run.

| Execution                                       | Result                                                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Unchanged baseline                              | Eight stages passed across six `am kill` process deaths                                                                      |
| Instrumented fixture/driver                     | Same eight stages and six deaths passed; 21 startup markers across seven processes                                           |
| Same candidate APK, deliberate startup blockage | Exit 1 at `initial-prepared`; no accepted result or process transition; full system/window evidence identifies debugger wait |

The passing runs restore two instances of `/edit` with different drafts and
native ScrollView offsets, preserve their entry keys, verify Back reveals the
earlier instance, and exercise migration, expiry, removed routes, signed-out
guards and legacy snapshots. Every recorded process transition changes PID.

The negative control uses Android's per-application wait-for-debugger setting
on the dedicated emulator. It blocks startup before JavaScript executes,
exercising the missing evidence in the original driver. The existing initial
wait expires and acceptance fails; the runner does not dismiss the dialog or
restart the app. This is a diagnostic control, **not a reproduction or
explanation of the original splash hang**. The debugger setting was cleared
and verified before deleting the dedicated emulator.

All 995 unit tests passed, with 10 existing skips. Type checking and the native
helper checks passed. No new mock test substitutes for native restoration.

[Local inventory](./evidence/android-state-183/local-validation.json) and
[provenance](./evidence/android-state-183/provenance.json) retain both APK hashes,
source hashes, passing runs and the deliberate failure. The unchanged baseline
also passing is evidence against attributing the local success to these
diagnostic additions; the original intermittent failure remains unexplained.

## Recordings

[Complete restoration acceptance](../docs/public/media/android-state-acceptance.mp4)
shows the actual app over 96.6 seconds: distinct drafts and reading positions,
process deaths and restoration, Back, and the five compatibility scenarios.
The native reports establish process identity and the assertions beyond what
is visible in the recording.

[Blocked-start control](../docs/public/media/android-state-startup-control.mp4)
shows the real Android debugger-wait dialog over 70.3 seconds. The retained
failure phase and system/window logs establish that the driver rejected this
launch at its existing deadline. Both videos preserve the recorded timeline,
with H264 compression and no cuts, overlays or generated frames; hashes and
media metadata are in [the recording manifest](./evidence/android-state-183/videos.json).
