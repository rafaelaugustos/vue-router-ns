# Retained entry history acceptance

This opt-in demo fixture exercises the first stage of #178 on two real Frame
stacks. It uses public router APIs; native Page references are retained only by
the fixture to compare identity. It is not a garbage-collection measurement.

Prepare the ignored demo resources following [the demo setup](../../../demo/README.md).
Use macOS, Xcode, Ruby with `xcodeproj`, NativeScript CLI and a dedicated iPad
simulator. The driver reinstalls `org.nativescript.vuerouterns` on that simulator.
From the repository root:

```sh
npm ci
npm run build
npm --prefix demo ci
cd demo
ns build ios --for-device false --env.historyTest --no-hmr
cd ..
IOS_SIMULATOR=<dedicated-booted-iPad-UDID> RECORD_VIDEO=1 node scripts/native/history/ios.mjs
```

`OUT` selects a fresh output directory (default `scripts/native/out/history`).
`XCTEST_PROJECT` selects the generated test project directory. If the project was
already generated and built, `XCTEST_PREPARED=1` reuses it. The driver preserves
the XCTest log/result bundle, recording, final screenshot and eight application
reports; every report must pass. Run the fixture typecheck with
`demo/node_modules/.bin/tsc --noEmit -p scripts/native/history/tsconfig.json`.

The sequence seeds duplicate paths in Inbox and a separate Archive stack;
refuses an exact selection through a guard; selects the older duplicate while
preserving its Page and every Archive Page; rejects the removed duplicate's
address; reverses and then commits actual UIKit Back gestures; and closes both
owners. Reports check native/logical identity, all result settlements and every
destination's single unmount. The gesture page uses an animated transition so
the reversed gesture can cancel. The reversing touch helper uses XCTest-only
event APIs; no private touch API is included in the app or router.

This fixture validates iOS simulator behavior. It does not establish physical
hardware, Android gesture behavior, process-death execution, accessibility of a
history menu or repeated resource collection. Window boundaries, reconstructed
identities, pinned roots, unloaded hosts and asynchronous races also have focused
contract tests. The optional Back history menu is a later stage.
