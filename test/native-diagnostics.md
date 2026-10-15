# Native diagnostics validation — 2026-10-15

Follow-up for [#61](https://github.com/rafaelaugustos/vue-router-ns/issues/61), implemented independently of the window-navigation work in #46. The collector observes the existing Frame host and does not introduce a new navigator or a process-global debugger.

## Environments

- Android 15/API 35 arm64 emulator, NativeScript core/runtime 9.1.1.
- iPad Pro 11-inch (M5) simulator, iPadOS 26.5, NativeScript core 9.1.1/runtime 9.1.0.
- NativeScript-Vue 3.1.2, with no installed-package patch.

The debug demo contains an inspector under Settings. Tests used that real UI, runtime inspector snapshots, the actual Frame back stack and temporary application-owned references. A temporary window content resolver enabled a second native Activity/UIKit scene for collector-isolation checks. Those references, window configuration changes and HMR marker edits were removed after testing.

## Results

| Scenario                                                    | Android                                                       | iPad                         |
| ----------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------- |
| Asynchronous 350 ms guard is attributed to `guard`          | 352–353 ms                                                    | 350–351 ms                   |
| Deliberate 80 ms synchronous setup is attributed to `mount` | 81–86 ms                                                      | 86–87 ms                     |
| Native Frame pop without a router request                   | Recorded as `native` / `pop`                                  | Recorded as `native` / `pop` |
| Directly insert an unmanaged native Page                    | `unknown-native-page` and `stack-mismatch`                    | Same                         |
| Return from unmanaged Page                                  | Logical/native snapshots recover without diagnostic repair    | Same                         |
| Covered routed SFC reload through real HMR                  | `requested → deferred → applied → relink`; entry ID preserved | Same                         |
| Two native windows with separate collectors                 | Distinct router/window IDs and matching native histories      | Same                         |
| Private query/prop values                                   | Absent from JSON export; matched route patterns remain        | Same                         |
| Replace 35 pages with capacity 120                          | 120 retained, 362 discarded                                   | 120 retained, 362 discarded  |
| Guard rejection and page-result observation                 | Busy state clears; result observed once and value omitted     | Same                         |
| Stop collector, navigate again, close secondary window      | Frozen report; zero further subscriber callbacks              | Same                         |

The bounded exports in that fixture were approximately 43 KB of JSON. This demonstrates bounded retained diagnostic records, not a general native heap/leak certification. IDs are process-local and stable through native Page replacement; they are not restoration identities.

An initial iPad pop probe used global `Frame.topmost()` and reached another window's Frame. The corrected test used the owning tab's actual Frame, matching the demo's own page-bound target. This is evidence for observing ownership explicitly; the diagnostics feature does not claim to resolve the routing ownership work in #46.

## Automated coverage and limits

The full suite passes 183 tests, including typed readonly exports, disabled collection with zero diagnostic clock/window reads and no extra native listener, concurrent guard cancellation, redirects/failures, modal result settlement, unknown native pages, split placeholders, closed-window detection, buffer bounds, immutable reports, throwing subscribers and source release after stop. Existing HMR tests additionally check timeline deferral/discard behavior.

No native listeners are added by the collector; it hooks the router's existing operations and lifecycle observations. With collection disabled, no collector/buffer is created and the navigation function returns its existing execution promise directly. These structural checks establish the disabled path; no cross-device numerical overhead guarantee is made.

Timing uses a monotonic clock. Mount duration is synchronous router/Vue/native-view work; transition duration runs from commit to observable native completion and includes mounting. Their durations overlap. This report does not infer FPS, first-pixel latency or native rendering cost from JavaScript timing. NativeScript's Chrome debugger and platform profilers remain complementary tools. Physical-device profiling, OS scene reconnection and Activity recreation are not claimed by this validation.
