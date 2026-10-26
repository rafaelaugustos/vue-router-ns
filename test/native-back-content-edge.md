# Native Back from inset iPad content — #168

## Result and scope

The missing permanent-drawer Back gesture is reproducible without Vue or vue-router-ns, using published NativeScript Core 9.1.3. A plain Core Frame at x=280, y=100 does not pop in response to the tested content-edge drag on iPadOS 18.6 or 26.0. Moving the same Frame to x=0 restores the gesture; its native header Back also works in the inset layout.

A standalone UIKit control establishes that the same inset geometry and input work on iPadOS 26.0 with the default navigation delegate or a delegate implementing only `didShow`. Exposing the optional custom animation callback, even when it returns `nil`, prevents this tested gesture. Core exposes that callback for all Frame navigation, including default transitions. This is evidence for investigating Core's delegate selection, rather than adding a gesture override to RouterDrawer. It is not proof that changing that callback alone safely fixes Core's lifecycle, custom transitions or shared transitions.

No production router behavior, NativeScript package or delegate is patched. These tests characterize current behavior; a passing baseline includes the explicitly unavailable gestures. The outstanding landscape-to-portrait rotation-during-Back cases in [the rotation report](./native-drawer-rotation.md) remain outstanding. A normal Back button is not substituted for an interactive gesture in that report.

## Controls and method

Dedicated iPad Pro 11-inch M4 simulators running iPadOS 18.6 and 26.0; Core 9.1.3 and iOS runtime 9.1.0. The Core control imports no Vue/router code. Both controls use a child navigation controller with normal parent containment, y=100, and x=0 or x=280. The inset landscape content is 930 points wide in a 1210-point window.

XCTest pushes Detail, then drags from two points inside the content edge, at 75% of the window height through empty content. The drag spans 80% of the text-field width, uses slow velocity and holds for 0.3 seconds. The test reads the resulting native route and verifies normal native header Back after every non-pop. Each result is attached to the XCTest bundle with configuration and outcome.

The UIKit variants install delegates only on their newly created standalone navigation controller. `animation` and `interaction` return `nil`; neither supplies a custom animator or gesture. `both` exposes both optional methods, and all delegate variants also implement `didShow`. The Core control retains Core's own delegates and gesture policy.

## Observed matrix

“Pop” means the actual input returned from Detail to Root. “No pop” means Detail remained visible until the separately tested header Back. These are observed simulator outcomes, not a cross-version API guarantee.

| Control                          | 18.6 full width | 18.6 inset | 26.0 full width | 26.0 inset |
| -------------------------------- | --------------- | ---------- | --------------- | ---------- |
| UIKit, no delegate               | Pop             | No pop     | Pop             | Pop        |
| UIKit, `didShow` only            | Pop             | No pop     | Pop             | Pop        |
| UIKit, `animation` returns nil   | No pop          | No pop     | No pop          | No pop     |
| UIKit, `interaction` returns nil | Pop             | No pop     | Pop             | Pop        |
| UIKit, both optional callbacks   | No pop          | No pop     | No pop          | No pop     |
| Published Core Frame             | Pop             | No pop     | Pop             | No pop     |

Core's full-width result differs from the plain UIKit custom-animation control: Core explicitly assigns its navigation controller as the **screen-edge** recognizer delegate in Page `viewDidAppear`. For the iOS 26 content recognizer, it changes `enabled` but does not make the same delegate assignment. This report does not recommend copying that assignment or bypassing UIKit gesture eligibility rules.

Apple describes [`interactivePopGestureRecognizer`](https://developer.apple.com/documentation/uikit/uinavigationcontroller/interactivepopgesturerecognizer) as a leading **screen-edge** gesture. On iOS 26, [`interactiveContentPopGestureRecognizer`](https://developer.apple.com/documentation/uikit/uinavigationcontroller/interactivecontentpopgesturerecognizer) supports a leading-to-trailing pan in the content area. The 18.6 inset result should therefore not be presented as a RouterDrawer state-retention defect.

All 24 expected baseline observations were reproduced (12 per OS), including native header Back after non-popping gestures. The fixture TypeScript check and documentation build/localization checks also pass.

## Reproduction and remaining work

Run the [Back control driver](../scripts/native/backedge/README.md) separately for each OS. It generates a temporary Xcode project and captures 12 observations per OS, logs, named XCTest attachments and optional real simulator video. It is opt-in and does not lengthen the fast PR gate.

Keep an explicit Back action available in permanent layouts. [NativeScript #11589](https://github.com/NativeScript/NativeScript/issues/11589) tracks Core's default/custom navigation delegate handling, preserving custom transitions, interactive cancellation and lifecycle bookkeeping. Once a supported dependency can start a real inset-content Back, rerun both committed and cancelled landscape-to-portrait cases with the existing rotation driver and retain the actual coordinator outcome. Until then, #168 remains open for that missing coverage.

No physical iPad, Stage Manager, iPadOS 27, custom transition or spoken screen-reader claim follows from this matrix. This is separate from #139's inherited CSS-direction crash; no unpublished Core patch is used.
