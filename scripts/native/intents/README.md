# Navigation intents — #182 stage 1

The fixture uses two actual retained native Frames on a dedicated iPad simulator.
XCTest taps the app's controls and opens a real OS URL. The app checks both native
and logical histories and writes a report after each step. It does not replace
native navigation or synthesize OS callbacks.

From the repository root, with the demo's published dependencies and ignored native
resources already installed:

```sh
npm run build
npx tsc --noEmit -p scripts/native/intents/tsconfig.json
python3 scripts/native/entrypoints/prepare.py
ns build ios --path demo --for-device false --env.intentsTest --no-hmr
IOS_SIMULATOR=<dedicated-iPad-UUID> RECORD_VIDEO=1 \
  OUT=scripts/native/out/intents node scripts/native/intents/ios.mjs
```

Use Node 20.19.4 for the NativeScript CLI, Xcode and Ruby with the `xcodeproj` gem.
The resource preparation registers the existing fixture URL scheme. The driver
uninstalls/reinstalls only the demo app on the explicitly selected simulator,
bounds XCTest to 300 seconds and retains reports, environment, logs and optional
video. Use a fresh output directory for each run; Xcode does not overwrite results.

Eleven reports cover pure resolution, named-route and URL execution, delivery
deduplication across app-defined source labels, refused/overlapping guards, owner
mismatch, expiry, route removal, modal presentation/disposal and the existing OS
link entrypoint. The source Frame must retain its home Page throughout. The source
labels are application data; changing a label does not simulate a notification SDK.

This is one-window/two-Frame native evidence. Unit tests cover cold readiness,
restoration, pending target disposal, multiple router owners and bounded queues.
Authentication resumption, new-window policy, notification adapters, Android native
acceptance and physical-device accessibility remain outside this first stage.
