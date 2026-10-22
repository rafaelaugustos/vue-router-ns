# NativeWindow acceptance (#46)

Run in a separate worktree with generated `demo/App_Resources` and installed demo dependencies. Resource preparation sets Android `launchMode="standard"` and enables multiple iPad scenes. Use dedicated test simulators: the drivers clear the demo's data.

```sh
npm run build
node scripts/native/windows/prepare.mjs
cd demo
ns build android --env.windowsTest --no-hmr
cd ..
ANDROID_SERIAL=emulator-5554 \
ANDROID_APP=demo/platforms/android/app/build/outputs/apk/debug/app-debug.apk \
OUT=scripts/native/out/windows-android \
node scripts/native/windows/android.mjs
```

The Android driver requires all of these on published, unmodified dependencies:

- Separate native tasks/histories, guarded back and simultaneous modal results.
- Genuine process death (missing old PID, different new PID), stable per-entry identities and different drafts in two reconstructed windows. Reconstruction is application-owned: a new primary task restores key `a`, and the app reopens document `b` with its stable key.
- An OS-delivered `ACTION_VIEW` intent targets only the second window.
- Actual Activity replacement keeps every Vue page mounted. Back, retained reactivity and another push work after replacement.
- Script HMR through Vue’s runtime reloads both windows without losing their histories; navigation still works afterward.
- Permanent window closure unmounts all its page apps and clears only its snapshot.
- After finishing the original Activity, the surviving router opens a third native window with the correct typed destination.

The router uses public `createNativeView()` mount/unmount and reload APIs. There is no lifecycle-control transform or installed-package patch. The historical failing control is recorded in `test/native-windows.md`; the current CI lane requires passing behavior on API 34 and 36.

For the iPad baseline:

```sh
cd demo
ns build ios --env.windowsTest --emulator --no-hmr
cd ..
IOS_SIMULATOR=<dedicated-iPad-UUID> node scripts/native/windows/ios.mjs
```

This checks native window isolation, independent modal results, background/foreground reactivity, multi-window script HMR and closure. `scene-coverage.json` records whether UIKit actually disconnected a scene before resume. A background/foreground pass **does not** establish OS-driven disconnect/reconnect. Restoration into a new process is checked separately below; same-process OS-driven scene detach/reconnect remains unverified.

Artifacts contain command reports with logical/native histories, native identities, entry keys, cleanup counts, PIDs and diagnostics. The broadcast receiver and command UI are fixture-only. Actual webpack/Vite HMR also runs in the native contract/conventions suites.

## OS-task reconstruction acceptance

`RESTORE_TASKS=1` resumes the original Android task records after killing the process. It uses `am task lock <id>` followed by `am task lock stop` to bring each existing task forward, requires the secondary content resolver to run, and checks that task IDs did not change. It never counts reopening document B in a new task as a restoration pass.

This strict path now passes on published Core 9.1.3 with the router's scoped Android 29+ pre-create compatibility observer. CI requires both application-owned reconstruction and original-task restoration on API 34/36. The first Activity may receive a fresh Core window ID; stable document keys and original task IDs are required, and B retains its original native window ID. The observer discards stale Fragment/root references only in a marked bundle from a previous process and preserves same-process Activity recreation.

## UIKit session reconstruction after process death

```sh
IOS_SIMULATOR=<dedicated-iPad-UUID> RESTORE_SCENES=1 \
  OUT=scripts/native/out/windows-ios-restored node scripts/native/windows/ios.mjs
```

This mode sends `SIGKILL` to the fixture app in a **dedicated simulator**. It first matches the PID recorded by the fixture against that simulator's `launchctl list`, including the application bundle ID; unrelated processes are never selected. SpringBoard restart alone does not consistently end the app process on hosted runners, while graceful termination can discard sessions. Two separate XCTest invocations prepare the windows and reactivate the app; the driver requires a different PID, each document's original scene ID and stable entry keys, followed by multi-window HMR, navigation and cleanup. An application-owned mapping preserves document identity even when UIKit reconnects B before A. A passing test cannot silently substitute new scene sessions or swap the documents.

UIKit may initially reconnect only the last foreground window. The fixture looks up both original `UISceneSession` objects in `UIApplication.openSessions` and requests their activation, equivalent to selecting each saved window. Missing sessions fail the check; it never requests a new session to make restoration pass.

This proves cold reconstruction, not a same-process disconnect/reconnect. `scene-coverage.json` records the distinction. No manual invocation of scene delegates is counted as OS lifecycle evidence.
