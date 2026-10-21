# NativeWindow acceptance (#46)

Run in a separate worktree with generated `demo/App_Resources` and installed demo dependencies. The resource preparation changes only that worktree's generated Android manifest to `launchMode="standard"`. Use a dedicated test emulator: the driver clears the demo package's data.

```sh
npm run build
node scripts/native/windows/prepare.mjs
cd demo
ns build android --env.windowsTest --no-hmr
cd ..
ANDROID_SERIAL=emulator-5554 \
ANDROID_APP=demo/platforms/android/app/build/outputs/apk/debug/app-debug.apk \
OUT=scripts/native/out/windows-published EXPECT_RECREATION_FAILURE=1 \
node scripts/native/windows/android.mjs
```

The driver checks separate native tasks/histories, guarded back, simultaneous modal results, real process death (missing old PID and a different new PID), stable page entry identities and different drafts in two reconstructed windows, and an Android-delivered `ACTION_VIEW` intent targeting only the second window. Reconstruction is **application-owned**: a fresh primary task restores key `a`, and the app reopens document `b` with its stable key. This does not assert automatic reconstruction of Android's old task records or UIKit scene sessions. Scroll offsets remain covered by the single-window state fixture.

NativeScript-Vue 3.1.2 disposes retained Vue page apps during Activity recreation. `EXPECT_RECREATION_FAILURE=1` requires that exact failure: after a real replacement Activity, logical history is empty while the native Frame still has two pages. It does not tolerate arbitrary failures and does not mark recreation as supported.

For a diagnostic comparison, rebuild with `--env.windowsTest --env.windowLifecycleControl`, then run the driver **without** `EXPECT_RECREATION_FAILURE`. The loader applies only the disposal change from [NativeScript-Vue #1178](https://github.com/nativescript-vue/nativescript-vue/pull/1178), revision `e31806b7fed28cd4b4aa3af3f564492b43ecba91`. It fails if the expected published implementation no longer matches. This build must pass recreated-Activity history, Vue reactivity, subsequent navigation, permanent window closure and snapshot isolation. No installed dependency is modified; the loader is available only in this fixture and is not shipped in the npm package.

`.github/workflows/native-windows.yml` builds and runs both variants. A green diagnostic control is evidence for the upstream fix, **not** full #46 acceptance on supported published dependencies. iOS OS-driven scene disconnect/reconnect, OS-owned session reconstruction and the Core launcher scenario from #11526 remain separate acceptance work.

Artifacts include per-command JSON with the exact logical/native stacks, stable entry keys, native window/task/Activity identities, diagnostic timelines, process IDs and logcat. The fixture's broadcast receiver is test-only; it is not part of the normal demo entrypoint or router package.
