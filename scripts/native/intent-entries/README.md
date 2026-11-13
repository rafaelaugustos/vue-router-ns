# Scene intent entrypoints — #182 stage 5

The fixture imports the copyable app-owned ingress directly, with automatic system
links disabled. XCTest taps actual SpringBoard quick actions and Core Spotlight
results; it does not fabricate callback objects. Two process terminations exercise
cold quick-action and Spotlight delivery, each followed by explicit login/resume.
Native completion is independent of login/readiness waits.

```sh
npm run build
npx tsc --noEmit -p scripts/native/intent-entries/tsconfig.json
python3 scripts/native/entrypoints/prepare.py
ns build ios --path demo --for-device false --env.intententriesTest --no-hmr
IOS_SIMULATOR=<dedicated-iPad-UUID> RECORD_VIDEO=1 \
  OUT=scripts/native/out/intent-entries node scripts/native/intent-entries/ios.mjs
```

Use Node 20.19.4 for the NativeScript CLI, Xcode and Ruby's `xcodeproj` gem. The
prepare step changes only ignored demo resources. The driver reinstalls only this
app on the selected dedicated iPad; it does not reset other simulators. Use a fresh
output directory each run. XCTest is bounded to 600 seconds. An independent Swift
indexing probe runs before the app; this stage requires a responsive service and
does not count a skip as Spotlight acceptance. Search reissues its query for at
most two minutes while the native service commits acknowledged indexing.

Twenty reports cover publication, path rename without republishing, warm shortcut
login, replay, intentional repeat, cold shortcut login, native indexing, cold
Spotlight login, warm search repeat, app-side content removal, native URL delivery,
internal/notification comparisons, deleted shortcut destination and app cleanup.
The driver verifies three distinct process markers, one initial native callback
in each process, native/logical histories, normal guards, exact source Page/draft
within each process and removal of quick actions. Draft persistence between
processes is not asserted. Replaying a captured request is explicitly an app-level
control; it does not claim the OS delivered a duplicate.

The fixture's sign-in is controlled state with no external identity provider. It
indexes one public item, removes only its own Spotlight domain and retains no
credentials or suspended request across process death. Native events select the
primary router explicitly. Android, full multi-window behavior, physical devices,
background navigation and release-wide acceptance remain outside this stage.

See the [application recipe](../../../examples/intent-entrypoints/README.md) and
[acceptance report](../../../test/native-scene-intents-stage5.md).
