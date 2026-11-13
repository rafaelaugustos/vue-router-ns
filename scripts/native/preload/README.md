# Code-only route preloading acceptance — #179, stage 1

The opt-in demo uses real touch-down, release and abandoned drag events on a
native card. A lazy factory waits **900 ms** before importing the detail module,
making preparation observable. This controlled delay is not a cold-module or
device-performance benchmark; the JavaScript module cache may already be warm.

Prepare the ignored resources following [the demo setup](../../../demo/README.md).
Use macOS, Xcode, Ruby with `xcodeproj`, NativeScript CLI and a dedicated booted
iPad simulator. The driver reinstalls `org.nativescript.vuerouterns` on that
simulator. From the repository root:

```sh
npm ci
npm run build
npm --prefix demo ci
cd demo
ns build ios --for-device false --env.preloadTest --no-hmr
cd ..
IOS_SIMULATOR=<dedicated-booted-iPad-UDID> RECORD_VIDEO=1 node scripts/native/preload/ios.mjs
```

`OUT` selects a fresh output directory (default `scripts/native/out/preload`).
`XCTEST_PROJECT` selects the generated test project directory. Set
`XCTEST_PREPARED=1` only to reuse an existing project. Run simulators sequentially
when sharing that directory. The driver preserves the XCTest log/result bundle,
actual recording, final screenshot and seven JSON reports, all of which must pass.
Typecheck with `demo/node_modules/.bin/tsc --noEmit -p scripts/native/preload/tsconfig.json`.

The sequence covers immediate navigation, code ready before release, an abandoned
drag whose import finishes late, prepared code followed by guard refusal, and
owner disposal during an import. The fixture instruments public NativeScript-Vue
element registration and `renderer.createApp`, counting Page/Frame construction
and unique iOS controllers exposed by those objects. It compares original Page
identity and stable history IDs, and counts route setup, guards and data loaders.
No native delegate or installed dependency is patched. XCTest uses its public
tap, press and drag APIs.

These are construction-boundary counters, not a heap profiler or a guarantee
about all operating-system allocations. The fixture holds Page references for
identity checks. It does not establish garbage collection, physical-device
performance, screen-reader behavior or Android native touch acceptance. Contract
tests separately cover budgets, concurrent consumers, window boundaries,
invalidation, errors and normal navigation settlement.
