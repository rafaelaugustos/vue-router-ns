# Explicit intent window policy — #182 stage 4

This fixture imports the application example directly and drives real iPad scenes
with published dependencies. It does not change the router runtime or synthesize
native lifecycle/navigation callbacks.

```sh
npm run build
npx tsc --noEmit -p scripts/native/intent-windows/tsconfig.json
python3 scripts/native/entrypoints/prepare.py
ns build ios --path demo --for-device false --env.intentwindowsTest --no-hmr
IOS_SIMULATOR=<dedicated-iPad-UUID> RECORD_VIDEO=1 \
  OUT=scripts/native/out/intent-windows node scripts/native/intent-windows/ios.mjs
```

Use Node 20.19.4 for the NativeScript CLI, Xcode and Ruby's `xcodeproj` gem.
Select a dedicated iPad simulator; the driver reinstalls only the demo there and
does not stop or reset other simulators. XCTest is bounded to 300 seconds, with
fresh output/result directories per run. Creation/readiness/activation waits are
bounded individually in the fixture. The prepare step modifies only ignored demo
resources to enable multi-scene support.

Eleven reports cover saved-history creation, duplicate delivery, reuse without a
focus request, explicit focus A/B, reset only B, wrong-owner rejection, fresh C
creation, closure/stale B, ordinary guard refusal and policy disposal. Every
report checks distinct native owner ids, logical/native histories and the exact
source Page/draft retained in A. B is activated before closure and C activated
afterward; this does not certify closing a background scene. Activation uses an
explicit UIKit request and observed foreground state; multiple scenes may remain
active, so this does not certify system keyboard focus. The driver checks
exactly two new windows were requested and A/C remain after B closes.

Stored histories are seeded controlled snapshots to exercise load-policy choices.
No previous process is restored. New native request metadata contains an app key
and a unique correlation token, not a retained navigation Promise or credentials.
The content resolver refuses abandoned tokens and duplicate owners. Public
placeholder content is used for an abandoned late scene before requesting close.
The ordinary route guard still refuses the protected demonstration destination.

See the [copyable application example](../../../examples/intent-windows/README.md)
and [acceptance report](../../../test/native-intent-window-policy-stage4.md).
Android native activation, Spotlight/shortcut entrypoints, remote notifications,
process persistence, natural memory pressure and full release acceptance remain
outside this stage.
