# External NativeHost acceptance

Requirements: Node 22 for repository tests, NativeScript CLI, Xcode with an iOS
18.6 simulator runtime, Ruby with xcodeproj and CocoaPods. This lane uses published
Core 9.1.4, NativeScript-Vue 3.1.3 and iOS runtime 9.1.0 without dependency patches.

From the repository root:

```sh
npm ci
HOST_PACK_OUT=scripts/native/out/native-host-pack node scripts/native/native-host/prepare.mjs
cd examples/native-host-app
ns build ios --for-device false --no-hmr
cd ../..
```

Preparation packs this router, installs the tarball into the independent adapter,
builds/packs that adapter, installs both tarballs into the consumer and typechecks
it. `HOST_RESOURCES` can point to existing blank NativeScript App_Resources;
otherwise the script creates a blank scaffold. `HOST_SKIP_RESOURCES=1` runs only
the portable package/type checks without requiring the CLI. No source aliases or
router-internal imports are installed in the adapter.

Create and boot a dedicated simulator, then run:

```sh
IOS_SIMULATOR=<udid> OUT=scripts/native/out/native-host RECORD_VIDEO=1 \
  node scripts/native/native-host/ios.mjs
```

Use a fresh output directory on each run, because Xcode result bundles cannot be
overwritten. The driver installs only the isolated fixture, runs XCTest and saves
nine JSON reports, the XCTest log/result bundle, a final screenshot and optionally
the actual app recording. Every report must pass. A missing or failed command
fails the run. The app writes the full public harness report in conformance.json.

CI generates and builds the XCTest project before booting the simulator, then
uses `XCTEST_PREPARED=1` to reuse that project. This keeps Ruby/gem startup and
Swift compilation away from the simulator's cold-start workload. The driver
checks that the prepared project exists; native assertions and execution budgets
are unchanged. Local runs prepare the project automatically by default.

The reversing touch path uses the existing XCTest-only ContractTouch helper.
It is never compiled into the router or consumer. A fixture-only UIKit observer
requires measured movement for cancellation and commitment, and no movement for
the guard-blocked attempt. Native Page identities, result counts, Vue unmounts
and real controller counts are checked separately.

Temporary unloading means covering the host's retained parent Page using native
navigation, then revealing it. Removing a Frame from its parent destroys its
native controller and requires a fresh owner/host; it is not this temporary case.

The focused workflow runs packed imports/typechecking for relevant PRs and runs
the iOS lane manually/weekly. The [versioned report](../../../test/native-host-conformance-v1.md)
records local and hosted evidence separately. No Android/hardware/collection
support is inferred from these checks.
