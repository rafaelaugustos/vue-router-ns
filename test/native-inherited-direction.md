# Inherited CSS direction investigation — #139

Tested 2026-10-25 with Core 9.1.3, iOS runtime 9.1.0, NativeScript-Vue 3.1.2 and, only in the router comparison entry, published vue-router-ns 0.1.0-rc.3. webpack is pinned to 5.111.1 because the subsequently resolved 5.112.2 removed an internal dependency used by NativeScript webpack 5.0.38's worker loader. This build-tool pin is not a router compatibility fix.

## Published Core baseline

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

## Candidate correction: do not load controllers when requesting layout

The follow-up isolates the faulty Core access: iOS `View.requestLayout()` reads `viewController.view`. UIKit loads the view on that access. `direction` is an inherited property that affects layout, so attaching a Frame below a prebuilt direction-bearing root reaches this access before `UIApplicationMain`. Creating a Frame without loading its controller view is not sufficient to trigger the crash.

The candidate uses `viewController?.viewIfLoaded`. It retains the layout flags and ancestor propagation, calls `setNeedsLayout()` on existing native views, and avoids invalidating the same view twice. It does not modify direction semantics, gesture recognizers, delegates or navigation guards. Android already invalidates only an existing native view and has no equivalent controller getter.

| Run                                                                                             | Result                                         |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Original Core, prebuilt tree, explicit `frame.requestLayout()`, no direction, iOS 18.6          | App terminates on Draft tap                    |
| Original Core, prebuilt tree, explicit `controller.view` read, no direction, iOS 18.6           | App terminates on Draft tap                    |
| Candidate, Core prebuilt LTR / explicit requestLayout / no-direction, iOS 18.6                  | All pass keyboard and reversed/committed Back  |
| Candidate, explicit `controller.view` read before startup, iOS 18.6                             | Still terminates: intentional negative control |
| Candidate, Core factory LTR / prebuilt LTR / explicit requestLayout / no-direction, iPadOS 18.6 | All four pass                                  |
| Candidate, Vue-only inherited LTR / no-direction, iOS 18.6                                      | Both pass                                      |
| Candidate, published router inherited LTR / tabs LTR / tabs no-direction, iOS 18.6              | All three pass                                 |
| Candidate, published router inherited LTR / tabs LTR / no-direction, iOS 26.0                   | All three pass                                 |

These native runs use the same one-block correction applied to the fixture's locked Core 9.1.3. The [upstream PR #11587](https://github.com/NativeScript/NativeScript/pull/11587) is based on Core main `6bb01ea` and committed as `91337f9`. Its new unit regression fails against the original implementation; with the correction, all seven requestLayout tests pass and the full Core suite reports **568 passed, 1 skipped, 44 files passed**. Two native assertions are also added to upstream `apps/automated`; that entire upstream app suite was not run. The simulator fixture supplies the interaction evidence.

The XCTest checks text entry before Back and waits for the edited value after the reversing touch finishes. An immediate value read on iOS 26 returned an empty accessibility value even while the screenshot displayed the text, including in the no-direction control. The final run reinstalls the test runner and uses a predicate wait for the transition to settle, then asserts a committed Back returns home. These earlier assertion failures are not reported as application crashes or passing runs.

The [machine-readable candidate results](./evidence/inherited-direction-layout-fix.json) retain both failing controls and passing runs. `prebuilt-request-layout` on the patched iPad records `startup.loadedBefore: false` and `loadedAfter: false`; keyboard editing and Back remain enabled. A separate [opt-in helper](../examples/ios-direction-repro/scripts/core-layout-patch.mjs) makes the dependency experiment reproducible and reversible. It is not part of package installation or published router code.

The physical iPhone was unavailable during this pass. Dynamic RTL and arbitrary navigation hosts remain outside this validation. The new PR video shows the actual patched router fixture on iOS 18.6: inherited LTR, tabs without direction, and tabs with inherited LTR; each includes typing, cancelling Back and completing Back.

## Disposition

Keep #139 open until the Core correction is reviewed, published and validated as a released dependency. The Core-only startup-order reproduction is tracked in [NativeScript Core #11586](https://github.com/NativeScript/NativeScript/issues/11586). The earlier Vue-only reproduction is tracked upstream in [NativeScript-Vue #1186](https://github.com/nativescript-vue/nativescript-vue/issues/1186). The candidate above replaces the earlier unresolved mechanism with a tested Core change. No global semantic-direction patch, delegate replacement or always-active guard is added to the router.

`RouterDrawer.direction` retains its bounded container implementation from #117. Generic inherited CSS direction around navigation remains a documented limitation in published dependencies until the corrected Core version is available. Users should not infer that every native container supports that composition.

[Reproduction and XCTest commands](../examples/ios-direction-repro/README.md). The follow-up PR video records the real Core-only factory-created LTR control followed by the prebuilt-LTR failure, including the app returning to SpringBoard after the crash. The earlier Vue comparison video remains in PR #154.
