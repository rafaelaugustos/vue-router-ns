# Android drag/drop acceptance (#181 stage 3)

Use a dedicated Android 14/API 34 emulator with TalkBack installed. The runner
restarts only `org.nativescript.vuerouterns`, records its screen, enables TalkBack
for its final command and restores the original secure accessibility settings in
`finally`. Begin with accessibility services disabled. Do not use a personal app
installation: installing this fixture replaces the demo APK.

Prepare the ignored NativeScript resources as described in [demo setup](../../../demo/README.md).
From the repository root, with Node 20.19.4+, Java 17 and Android SDK installed:

```sh
export ANDROID_HOME="$HOME/Library/Android/sdk"
export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home
export ANDROID_SERIAL=emulator-5580
npm ci
npm run build
npm --prefix demo ci
python3 scripts/native/android-drop/prepare.py
npx tsc --noEmit -p scripts/native/android-drop/tsconfig.json
ns build android --path demo --env.androiddropTest --no-hmr
node scripts/native/android-drop/build-inspector.mjs
adb -s "$ANDROID_SERIAL" install -r demo/platforms/android/app/build/outputs/apk/debug/app-debug.apk
adb -s "$ANDROID_SERIAL" install -r /tmp/router-drop-inspector/inspector.apk
DROP_REPORT=/tmp/router-android-drop python3 scripts/native/android-drop/acceptance.py
```

The manifest preparation only changes the fixture label and launch mode. The
bridge itself requires no permissions. The inspector builder uses platform 36 and
the latest installed build tools. It compiles a small, separate instrumentation
APK using public `UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES`. It reads
native node bounds and accessibility focus while TalkBack stays enabled; it does
not click nodes, invoke app callbacks or use hidden APIs. See the [public flag](https://developer.android.com/reference/android/app/UiAutomation#FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES).

The driver injects real OS `input draganddrop`, taps and Control–O input. TalkBack
focus comes from emulator-console touchscreen events (device 0); two more
touches activate the focused button. A single local console connection keeps the
double-tap timing independent of adb process startup; it reads the standard local
emulator console token for authentication and never records it. The first touch
must focus without navigating.
On the recorded image, shell-injected taps reached the app directly, so they are
not used as evidence of TalkBack touch exploration. See the [emulator event interface](https://developer.android.com/studio/run/emulator-console). App reports verify TalkBack's enabled spoken service and touch exploration
at navigation. This proves reachability/activation, not spoken text or recorded
audio. The read-only inspector never substitutes for a native gesture.

Each report checks exact retained Page identities, independent drafts and agreement
between native/logical histories. Ten drag gestures cover valid and repeated drops,
cancellation, multiple/unsupported items, malformed/expired destinations, removed
routes, a refusing guard and a disposed target. Additional actions cover captured
intent replay, button, keyboard, TalkBack and final disposal. The fixture forces
native GC twice per drag to exercise callback-wrapper lifetime. Reports and tree
snapshots must remain in one app process.

Outputs: `android34.json`, `trees.json`, `accessibility.json`, diagnostic log and
`raw.mp4`. The video records the actual app, with no trimmed checks or replacement
frames. Reuse a fresh output directory. A recording that ends before final disposal
fails acceptance. [Stage 3 evidence](../../../test/native-android-drop-stage3.md)
describes the recorded environment and the remaining #181 boundaries.
