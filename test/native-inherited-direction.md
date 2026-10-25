# Inherited CSS direction investigation — #139

Tested 2026-10-25 with Core 9.1.3, iOS runtime 9.1.0, NativeScript-Vue 3.1.2 and, only in the router comparison entry, published vue-router-ns 0.1.0-rc.3. webpack is pinned to 5.111.1 because the subsequently resolved 5.112.2 removed an internal dependency used by NativeScript webpack 5.0.38's worker loader. This build-tool pin is not a router compatibility fix.

## Result

The failure is reproducible **without vue-router-ns**. A NativeScript-Vue Frame, two Pages, `$navigateTo`, a TextField and an inherited `direction="ltr"` suffice. There is no Drawer, guard, custom gesture recognizer or router plugin in that entry. Its no-direction control allows keyboard entry and native Back. The original Core-only controls passed because they assembled the tree inside the `Application.run({ create })` callback. The follow-up below reproduces the same original exception using **Core alone** by assembling the tree before `Application.run()`. Vue is no longer necessary to reproduce the failure; an upstream production fix is still unresolved.

| Entry / mode                                                              | iOS 18.6 iPhone 16                                   | iPadOS 18.6 iPad Pro 11 M4           |
| ------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------ |
| Core-only: none, inherited LTR, Frame LTR, Page LTR, direct-container LTR | Pass                                                 | Not rerun in this reduction          |
| Core-only: tabs with/without inherited LTR; direction set on root loaded  | Pass                                                 | Not rerun                            |
| Published router: tabs without inherited direction                        | Pass                                                 | Not rerun                            |
| Published router: inherited LTR, with or without tabs                     | App terminates when Draft is tapped                  | Original #139 fixture reproduced     |
| NativeScript-Vue only: no direction                                       | Pass, including keyboard and reversed/committed Back | Pass for keyboard and committed Back |
| NativeScript-Vue only: inherited LTR                                      | Same original UIKit assertion captured in LLDB       | App terminates when Draft is tapped  |

The same Vue-only pair was also tested on iPhone 17 / iOS 26.0: the no-direction control passed; inherited LTR allowed text entry, but the reversing Back assertion failed because detail was no longer visible; XCTest also reported process termination during that gesture. The iOS 18.6 keyboard crash was not observed in that iOS 26 run, and the full interaction regression is not green there either.

The minimum physical-device comparison remains unverified; the separate rc.3 consumer pass on physical iOS 27.2 beta does not cover this inherited-direction fixture.

## Follow-up: startup order reproduces the crash without Vue

The Core entry now uses the same `createRoot()` for two orders:

```js
// Passing control: assemble the tree and inherited LTR inside the factory.
Application.run({ create: createRoot })

// Failing reproduction: assemble the identical tree and LTR before startup.
const root = createRoot()
Application.run({ create: () => root })
```

These are alternative runs, not two calls in one process. Both keep native Back enabled and import only `@nativescript/core`. `prebuilt-ltr` terminates on the pushed TextField tap on iPhone and iPad 18.6. LLDB on the Core-only iPhone run captured the same `targetNode` assertion and gesture-graph stack below.

| Core-only case                                           | iPhone 16 / iOS 18.6                                     | iPad Pro 11 M4 / iPadOS 18.6 |
| -------------------------------------------------------- | -------------------------------------------------------- | ---------------------------- |
| Factory-created tree, inherited LTR                      | Pass, including keyboard and reversed/committed Back     | Pass                         |
| Prebuilt tree, no direction                              | Pass                                                     | Pass                         |
| Prebuilt tree, inherited LTR                             | App terminates on Draft tap; original exception captured | App terminates on Draft tap  |
| Prebuilt tree, LTR set on root loaded                    | Pass                                                     | Not rerun                    |
| Only Frame created before startup                        | Pass                                                     | Not rerun                    |
| Only root layout created before startup                  | Pass                                                     | Not rerun                    |
| Frame navigation queued before attaching, inside factory | Pass                                                     | Not rerun                    |
| Explicit ActionBar, with/without LTR, inside factory     | Both pass                                                | Not rerun                    |

This excludes explicit ActionBar creation and early Frame construction alone as sufficient triggers in these controls. It identifies an assembly/initialization-order condition, not yet a specific faulty Core setter or UIKit implementation. In particular, the late-direction control is not a generic workaround: dynamic RTL, other navigation hosts and application lifecycle behavior have not been certified by it.

The machine-readable [startup-order results](./evidence/inherited-direction-startup.json) retain both passing controls and the intentionally failing reproduction. These research cases remain outside the required CI gate; a green PR does not mean the crash is fixed.

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

Keep #139 open. The Core-only startup-order reproduction is tracked in [NativeScript Core #11586](https://github.com/NativeScript/NativeScript/issues/11586). The earlier Vue-only reproduction is tracked upstream in [NativeScript-Vue #1186](https://github.com/nativescript-vue/nativescript-vue/issues/1186). The new Core-only reproduction supersedes the earlier narrowing to a Core/renderer interaction. It excludes Vue, the router and Drawer as necessary dependencies. No corrected upstream revision has been established. No global semantic-direction patch, delegate replacement or always-active guard is added to the router.

`RouterDrawer.direction` retains its bounded container implementation from #117. Generic inherited CSS direction around navigation remains a documented limitation until an upstream correction passes this fixture. Users should not infer that every native container supports that composition.

[Reproduction and XCTest commands](../examples/ios-direction-repro/README.md). The follow-up PR video records the real Core-only factory-created LTR control followed by the prebuilt-LTR failure, including the app returning to SpringBoard after the crash. The earlier Vue comparison video remains in PR #154.
