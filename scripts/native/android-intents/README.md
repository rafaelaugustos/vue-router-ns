# Android navigation intents — #182 stage 6

The opt-in fixture imports the copyable Android adapter directly. The driver taps
real launcher shortcuts and notification drawer entries with `uiautomator` bounds;
it opens a URL through ACTION_VIEW. It never fabricates a native callback.

```sh
npm run build
npx tsc --noEmit -p scripts/native/android-intents/tsconfig.json
python3 scripts/native/android-intents/prepare.py
ns build android --path demo --env.androidintentsTest --no-hmr
ANDROID_SERIAL=<dedicated-emulator> \
  ANDROID_APP=demo/platforms/android/app/build/outputs/apk/debug/app-debug.apk \
  RECORD_VIDEO=1 OUT=scripts/native/out/android-intents \
  node scripts/native/android-intents/android.mjs
```

Use Node 20.19.4, Java 17 and an Android SDK configured through `ANDROID_HOME`.
The prepare script changes only ignored demo resources: a single-task Activity,
the custom URL scheme and notification permission. The driver clears only this
fixture's app data on the selected dedicated emulator. Other devices are untouched.
Use a fresh output directory. The validated launcher is the Google APIs API 34
Pixel launcher; set `ENTRYPOINT_APP_LABEL` if your app drawer label differs from
`Intent Lab`. Notification permission is granted through the actual system prompt.

Cold URL, cold launcher shortcut and cold notification use three process markers.
The shortcut case uses force-stop. The notification case backgrounds and kills
the process with `am kill`, preserving its posted PendingIntent; the driver asserts
the old PID is gone before tapping. Each process receives one initial callback
and starts signed out. Login is controlled fixture state, with an actual sign-in
button tap, no identity provider and no persistent suspended request.

Setup commands use a fixture-only broadcast receiver. Replay is explicitly an
app-level control; distinct system taps get new action identities. Every report
compares native/logical histories and the exact source Page/draft within its
process. The video records the actual display at original speed, with a 180-second
screenrecord limit; the driver fails if capture ends before acceptance completes.

See [the recipe](../../../examples/intent-entrypoints/android.md) and
[acceptance report](../../../test/native-android-intents-stage6.md).
