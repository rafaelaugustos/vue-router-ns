# Inherited CSS direction investigation — #139

Tested 2026-10-25 with Core 9.1.3, iOS runtime 9.1.0, NativeScript-Vue 3.1.2 and, only in the router comparison entry, published vue-router-ns 0.1.0-rc.3. webpack is pinned to 5.111.1 because the subsequently resolved 5.112.2 removed an internal dependency used by NativeScript webpack 5.0.38's worker loader. This build-tool pin is not a router compatibility fix.

## Result

The failure is reproducible **without vue-router-ns**. A NativeScript-Vue Frame, two Pages, `$navigateTo`, a TextField and an inherited `direction="ltr"` suffice. There is no Drawer, guard, custom gesture recognizer or router plugin in that entry. Its no-direction control allows keyboard entry and native Back. Core-only controls pass; the exact Core/renderer/UIKit lifecycle cause is still unresolved.

| Entry / mode                                                              | iOS 18.6 iPhone 16                                   | iPadOS 18.6 iPad Pro 11 M4           |
| ------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------ |
| Core-only: none, inherited LTR, Frame LTR, Page LTR, direct-container LTR | Pass                                                 | Not rerun in this reduction          |
| Core-only: tabs with/without inherited LTR; direction set on root loaded  | Pass                                                 | Not rerun                            |
| Published router: tabs without inherited direction                        | Pass                                                 | Not rerun                            |
| Published router: inherited LTR, with or without tabs                     | App terminates when Draft is tapped                  | Original #139 fixture reproduced     |
| NativeScript-Vue only: no direction                                       | Pass, including keyboard and reversed/committed Back | Pass for keyboard and committed Back |
| NativeScript-Vue only: inherited LTR                                      | Same original UIKit assertion captured in LLDB       | App terminates when Draft is tapped  |

The same Vue-only pair was also tested on iPhone 17 / iOS 26.0: the no-direction control passed; inherited LTR terminated the app after the TextField tap. This is not limited to iOS 18.6.

The minimum physical-device comparison remains unverified; the separate rc.3 consumer pass on physical iOS 27.2 beta does not cover this inherited-direction fixture.

## Original exception, not just the secondary runtime crash

LLDB stopped in `objc_exception_throw` on the Vue-only iOS 18.6 entry:

```text
Invalid parameter not satisfying: targetNode
-[UIGestureGraphEdge initWithLabel:sourceNode:targetNode:directed:]
-[UIGestureGraph addUniqueEdgeWithLabel:sourceNode:targetNode:directed:properties:]
_UIGestureEnvironmentUpdate
-[UIGestureEnvironment _deliverEvent:toGestureRecognizers:usingBlock:]
-[UIGestureEnvironment _updateForEvent:window:]
-[UIWindow sendEvent:]
```

This matches the original #139 exception. The failed XCTest reports “Application ... is not running” after the TextField tap; that message alone is not the diagnosis.

## Disposition

Keep #139 open and carry the minimal Vue-only reproduction upstream. The evidence excludes the router and new Drawer as necessary causes, but does not prove that Core alone is at fault or identify a corrected upstream revision. No global semantic-direction patch, delegate replacement or always-active guard is added to the router.

`RouterDrawer.direction` retains its bounded container implementation from #117. Generic inherited CSS direction around navigation remains a documented limitation until an upstream correction passes this fixture. Users should not infer that every native container supports that composition.

[Reproduction and XCTest commands](../examples/ios-direction-repro/README.md). The PR video records the real no-direction control followed by the inherited-direction failure, including the application returning to SpringBoard after the crash.
