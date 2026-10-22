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

This checks native window isolation, independent modal results, background/foreground reactivity and closure. `scene-coverage.json` records whether UIKit actually disconnected a scene before resume. A background/foreground pass **does not** establish OS-driven disconnect/reconnect. Automatic reconstruction of OS-owned Android task records or UIKit sessions also remains separate acceptance work.

Artifacts contain command reports with logical/native histories, native identities, entry keys, cleanup counts, PIDs and diagnostics. The broadcast receiver and command UI are fixture-only. Actual webpack/Vite HMR also runs in the native contract/conventions suites.
