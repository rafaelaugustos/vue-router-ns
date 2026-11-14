# Cross-window iPad drag/drop — #181 stage 2

Install demo dependencies and generate its ignored native resources using the
[demo setup](../../../demo/README.md). Then run from the repository root:

```sh
npm run build
npx tsc --noEmit -p scripts/native/window-drop/tsconfig.json
python3 scripts/native/drag-drop/prepare.py
ns build ios --path demo --for-device false --env.windowdropTest --no-hmr
IOS_SIMULATOR=<dedicated-iPad-UUID> RECORD_VIDEO=1 \
  OUT=scripts/native/out/window-drop node scripts/native/window-drop/ios.mjs
```

Use Node 20.19.4, Xcode, Ruby's `xcodeproj` gem and a dedicated booted iPad simulator
with Split View enabled. Preparation declares the data UTI and scene support in
ignored demo resources. The driver reinstalls only the demo on the explicitly
selected simulator. Use a fresh output directory per run.

The “create” control requests a second scene with public UIKit standard placement
and the actual requesting scene. XCTest asserts disjoint native window rectangles
before dragging, then performs seven actual long-press-and-drag gestures. It does
not invoke drag or lifecycle delegates to fake transfer. Both windows intentionally
name their Frame `main`; native reports assert distinct window/scene ids and that
only the receiving router's guards/history change. Forced JS collection runs
between native callbacks.

The driver covers success, a new drag to the same destination, captured-intent
replay, guard refusal, account replacement and document removal while provider data
is pending, cancellation, an actual accessible button and real receiver closure
after accepting a slow provider. It waits beyond that provider's delay to check
that late data leaves no navigation or replacement window. Draft retention is
checked on the exact live root Pages. The closed receiver's final snapshot is
explicitly taken before closure; no destroyed Page is treated as retained UI.

This is two same-process app windows on the iOS 18.6 iPad simulator, not physical
hardware, Stage Manager, external-app transfer or window creation by dragging.
See the [recipe](../../../examples/drag-drop/windows.md) and
[acceptance report](../../../test/native-window-drop-stage2.md).
