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

## Explicit data preparation — stage 2

Build with `--env.preloaddataTest --no-hmr` instead of `preloadTest`. This separate
fixture makes real HTTP requests to a local endpoint with a controlled **900 ms**
response delay. Enable fixture-only local transport in the ignored demo resources
before building:

```sh
python3 scripts/native/loaders/prepare.py
npm run build
cd demo
ns build ios --for-device false --env.preloaddataTest --no-hmr
cd ..
IOS_SIMULATOR=<dedicated-booted-iPad-UDID> PRELOAD_DATA_TEST=1 RECORD_VIDEO=1 OUT=scripts/native/out/preloaddata node scripts/native/preload/ios.mjs
```

The same driver starts and closes `data-server.mjs` on port **18819**. For manual
use, start that server separately; do not run a manual server while using the
driver. Both modes use the same fixture typecheck/project. The transport setup
is confined to demo resources and does not alter router/application policy.

The data sequence requires twelve application reports plus independent HTTP
counts. It covers a cold page presenting while data is pending, prepared data
reused after release, abandoned drag, denied speculative authorization (zero
requests), a refusing navigation guard after preparation, account A invalidated
during HTTP followed by a separate account B request, and owner disposal.
The HTTP log must contain exactly seven requests, all completed; neither release
to a prepared page nor denied preparation adds a request.

The fixture's fetch adapter deliberately cannot abort transport. It records
cancellation callbacks and verifies that late responses cannot restore cancelled
interest or publish into the new account. A client with request/subscription
cancellation can adapt the same callback without cancelling other consumers.
Counters use the stage-1 instrumentation above. Timing demonstrates the controlled
server delay moving before release, not network performance. The same simulator,
hardware, Android and collection limits apply.
