# Native Back at an inset content edge — #168

These opt-in controls isolate native input from RouterDrawer. They do not install a router workaround, alter NativeScript delegates, synthesize a pop or disable gesture rules. The tests encode the observed **published baseline**, including unavailable gestures; a passing run does not mean all gestures work.

Requirements: macOS/Xcode, Ruby with `xcodeproj`, installed demo dependencies, and a dedicated booted iPad simulator. The runner reinstalls `org.nativescript.vuerouterns` and `org.router168.uikit` on the explicitly chosen simulator. Do not use a device containing app data you want to retain.

```sh
cd demo
ns build ios --for-device false --env.backedgeTest
cd ..
IOS_SIMULATOR=<dedicated-ipad-uuid> \
IOS_APP="$PWD/demo/platforms/ios/build/Debug-iphonesimulator/demo.app" \
OUT=/tmp/backedge-26 RECORD_VIDEO=1 \
node scripts/native/backedge/run.mjs
```

Use `RUBY=/path/to/ruby` and the appropriate `GEM_PATH` if Xcodeproj is installed outside the default Ruby. Run from the repository root. Choose a fresh `OUT` for each run because Xcode will not overwrite an existing result bundle.

`backedge-app.ts` uses only published Core. Its Frame is laid out at x=280, y=100 (or x=0 with `full-width`), with normal child-controller containment. `UIKitControl.swift` provides the same inset using a plain child UINavigationController. Launch arguments choose no delegate, `did-show` only, the nil-returning `animation` callback, the nil-returning `interaction` callback, or `both`. These are newly created standalone UIKit controls, not replacements for delegates in Core or the router.

The XCTest driver pushes Detail, drags from two points inside the content edge through empty lower content, checks the resulting page, and verifies the native header Back when the gesture does not pop. Each of six configurations is checked at full width and inset, for 12 observations per OS. The result bundle includes named text attachments with actual and expected outcomes. Logs and optional simulator video are stored in `OUT`.

The simulator baseline is iPadOS 18.6 and 26.0 on iPad Pro 11-inch M4. New OS/Core behavior may intentionally fail these baseline assertions: inspect the attachments and update the evidence before changing expectations. This is a manual investigation tool and adds no simulator job to the fast PR gate. It does not test rotation; the separate [rotation driver](../adaptive-drawer/README.md#rotation-during-active-navigation) still owns that coverage.
