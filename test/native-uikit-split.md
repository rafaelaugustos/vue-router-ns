# UIKit split navigation acceptance (#50)

`RouterUIKitSplitView` is an opt-in window-root component. It uses NativeScript
Core's `SplitView` and a **double-column UISplitViewController**, with the list
and detail in their original Frames/UINavigationControllers. The pinned list
and detail history are one router stack. It does not replace `RouterSplitView`
or add a UIKit imitation on Android.

## Controller ownership

Core creates the split controller, owns child containment and performs layout.
The router wraps its split delegate and forwards collapse/expand and visibility
callbacks. It does **not** replace the Frame navigation delegates. In compact
mode UIKit can put the secondary navigation controller into the primary
navigation controller's controller array. The Pages still belong to their
original Frames; the fixture checks that ownership after every operation.

The detail placeholder navigation starts before revealing its column: iOS 18
rejects an empty nested UINavigationController. Expanded columns use UIKit's
tiled behavior so rotation does not put the primary over the detail.

The adapter chooses the primary column when collapsing an empty detail, uses
UIKit's proposed expansion mode, and leaves system sidebar controls to UIKit.
Core's manual button helpers are suppressed because they overwrite application
ActionItems and can insert an empty display-mode button in compact mode. These
are isolated overrides in `src/uikit-split.ts`, protected by native CI. No patch
to installed Core or NativeScript-Vue files is required.

The primary column owns this window's sidebar. `RouterDrawer` remains an Android
container; nesting this window-root host inside a drawer, tab or Page is not
supported. Supplementary/inspector columns and independent NativeWindow scene
restoration are outside this two-column implementation.

## Reproduction

Use dedicated simulators; the driver uninstalls the demo bundle on the selected
simulator. Prepare normal NativeScript iOS App_Resources first. Then:

```sh
npm ci
npm run build
(cd demo && npm install)
node scripts/native/uikit-split/prepare.mjs
(cd demo && ns build ios --for-device false --env.uikitsplitTest)
IOS_SIMULATOR=<phone-udid> OUT=/tmp/split-phone node scripts/native/uikit-split/ios.mjs
IOS_SIMULATOR=<ipad-udid> OUT=/tmp/split-pad node scripts/native/uikit-split/ios.mjs
IOS_SIMULATOR=<ipad-ios26-udid> SPLIT_RESIZE=1 OUT=/tmp/split-resize node scripts/native/uikit-split/ios.mjs
```

The prepare script disables `UIRequiresFullScreen`. With it enabled, iPadOS 26
may scale the app in a compatibility window while the UIKit window retains its
old bounds. The resize test must change actual UIWindow bounds and observe
`UISplitViewController.collapsed` become true **and then false**. Merely dragging
a window or changing a JavaScript ref cannot pass.

The XCTest project requires Ruby's `xcodeproj` gem. Each invocation needs a new
`OUT` directory because an xcresult bundle cannot be overwritten. Use different
`XCTEST_PROJECT` directories when running two simulators concurrently.

## Coverage and artifacts

The navigation suite runs on both iPhone and iPad:

- Native nested detail history and Page/controller containment.
- Rotation with identical Page objects, native stacks and unsaved draft.
- System sidebar hide/show on iPad, preserving application ActionItems.
- Native Back denied by a leave guard at both nested and first detail.
- UIKit sheet dismissal denied by a guard; modal result delivered exactly once.
- Returning from the modal preserves the underlying Pages and draft.
- Native Back to the list, replace, clearHistory with pinned root.
- Relaunch into a fresh process, restored history and per-entry draft, then Back.

The iPadOS 26 resize suite uses XCTest touch input on the **system-owned window
handle**, checks identical Pages/draft through collapse and expansion, and also
repeats resizing with an empty detail column so the list remains reachable.

Every command writes native frame Page identities, UINavigationController
counts/ownership, actual window bounds, UIKit collapsed state, router history,
process ID and diagnostics. The driver rejects any assertion/diagnostic failure,
missing restoration process, missing modal result, or missing resize transition.
Artifacts include `results.json`, `environment.json`, `xcodebuild.log`, native
reports, screenshot and the XCTest result bundle with screenshots.

## Version matrix

| Environment                                           | Controller/runtime                                         | Checks                                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| iPhone 16 Pro simulator, iOS 18.6                     | Core 9.1.3 / NativeScript iOS 9.1 / NativeScript-Vue 3.1.2 | Required CI navigation suite                                               |
| iPad Pro 13-inch M4 simulator, iPadOS 18.6            | Same                                                       | Required CI navigation suite including system sidebar                      |
| iPhone 17 Pro simulator, iOS 26.5                     | Same                                                       | Local navigation suite                                                     |
| iPad Pro 13-inch M4 simulator, iPadOS 26.5            | Same                                                       | Local navigation and OS window-resize suites                               |
| Android / older Core without SplitView / iOS below 18 | No UIKit backend                                           | `supportsUIKitSplitView()` returns false; app can choose `RouterSplitView` |

The new iOS 18.6 lanes are part of the required `native-contracts` check. Existing
Android contracts and flows still run on router changes. The unit host contract
also runs against this adapter, including cancellation, concurrent navigation,
results and disposal. Simulator evidence is not a physical-device or VoiceOver
validation claim.
