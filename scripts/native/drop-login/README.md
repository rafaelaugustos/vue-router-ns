# Drop login acceptance (#181 stage 4)

Use the dedicated Android 14/API 34 emulator and the public read-only inspector
from [stage 3](../android-drop/README.md). No accessibility service is enabled by
this runner. It restarts only the demo package and drives native long-press/move/release,
ordinary buttons, Control–O and Android system Back. It never invokes application
navigation callbacks or replaces native methods.

After preparing the ignored demo resources as described in [demo setup](../../../demo/README.md):

```sh
export ANDROID_HOME="$HOME/Library/Android/sdk"
export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home
export ANDROID_SERIAL=emulator-5580
npm ci
npm run build
npm --prefix demo ci
python3 scripts/native/android-drop/prepare.py
node scripts/native/android-drop/build-inspector.mjs
adb -s "$ANDROID_SERIAL" install -r /tmp/router-drop-inspector/inspector.apk
npx tsc --noEmit -p scripts/native/drop-login/tsconfig.json
ns build android --path demo --env.droploginTest --no-hmr
adb -s "$ANDROID_SERIAL" install -r demo/platforms/android/app/build/outputs/apk/debug/app-debug.apk
DROP_LOGIN_REPORT=/tmp/router-drop-login python3 scripts/native/drop-login/acceptance.py
```

The app is an opt-in fixture with controlled authentication. “Sign in (fixture)”
changes application test state; no external identity SDK or real credentials are
used. The native Login Page is pushed into the explicitly registered Inbox Frame.
Only successful resumption replaces that Login Page. A labeled button and Control–O
submit internal requests through the same policy.

Eleven actual drags cover successful login, cancellation, native Back, account
change, removed route, expiry, refusing guard, permission revocation during a guard,
target disposal, a newer request and an already authenticated destination. The
runner separately checks early/repeated callbacks, repeated delivery, supersession
without a second Login Page, and non-drag commands. Native Back is an OS key event;
a page leave guard cancels the pending continuation. The guard-race case waits for
the native “Revoke access during guard” button before completing the guard.

Each application report asserts source/Inbox Page identity, independent drafts and
native/logical history agreement. The source forces two native GC cycles per drag.
Outputs are `android34.json`, `raw.mp4` and diagnostic logs. The recording must remain
active through final cleanup. Use a fresh output directory. The [native report](../../../test/native-drop-login-stage4.md)
identifies the environment, evidence hashes and limitations. Android stage 3 is also
rerun with the new shared policy to check default behavior and TalkBack compatibility.
