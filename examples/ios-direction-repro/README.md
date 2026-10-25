# Inherited direction: isolated native controls (#139)

Three build entries share one locked project. `src/app.js` imports only NativeScript Core; `src/vue.js` imports Core indirectly through NativeScript-Vue and uses its published `$navigateTo`; `src/router.js` adds the exact published router rc.3. Installing a dependency does not import it into the Core/Vue controls. There is no Drawer, custom recognizer, native delegate override or permanent leave guard in the Vue control.

```sh
cd examples/ios-direction-repro
npm ci
node scripts/resources.mjs
ns build ios                         # Core-only
ns build ios --env.vue               # NativeScript-Vue, no router
ns build ios --env.router            # published router comparison
```

Install the built simulator app, then launch it with `direction-mode=none` or `direction-mode=inherited-ltr`. Tap **Push detail**, tap **Draft**, type, dismiss the keyboard, reverse an edge Back, then complete Back. The affected build terminates when Draft is tapped. Do not interpret a failed negative control as a keyboard-only defect.

```sh
xcrun simctl install SIMULATOR platforms/ios/build/Debug-iphonesimulator/iosdirectionrepro.app
xcrun simctl launch SIMULATOR org.nativescript.directionrepro direction-mode=inherited-ltr
```

Core-only modes additionally isolate `frame-ltr`, `page-ltr`, `container-ltr` (direct container semantic attribute), `late-ltr` (CSS set when the root loads), `tabs-none` and `tabs-ltr`. Router comparisons support the first three and tabs; Vue-only supports `none` and `inherited-ltr`. Select only applicable XCTest cases for each entry.

Generate the XCTest runner from the repository root (Ruby `xcodeproj` gem required):

```sh
ruby scripts/native/direction/project.rb /tmp/direction-checks
xcodebuild test -project /tmp/direction-checks/DirectionChecks.xcodeproj \
  -scheme DirectionChecks -destination 'platform=iOS Simulator,id=SIMULATOR' \
  -only-testing:DirectionChecks/DirectionUITests/testControl \
  -only-testing:DirectionChecks/DirectionUITests/testInheritedLTR
```

The inherited-LTR Vue case is a **known failing regression reproduction** on iOS/iPadOS 18.6. It is deliberately not made green by disabling native Back. These manual research cases are not added to the required CI gate while upstream is unresolved. The reversing touch helper is compiled only into the XCTest runner, never the application or library.

For the original exception, attach LLDB to the launched simulator app and break at `objc_exception_throw` before tapping Draft. Print `(id)$x0` on arm64 and capture the stack. See [the investigation report](../../test/native-inherited-direction.md). App resources, native build products and installed dependencies are ignored; no signing team is committed.
