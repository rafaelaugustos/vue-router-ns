# Native navigator contracts (#63)

The fixture in `demo/src/testing/contracts-app.ts` uses real NativeScript Frames,
UIKit controllers and Android Fragments. It does not replace their navigation or
gesture methods. The Node/XCTest drivers tap native controls, reverse or commit
system gestures, and restart the process with saved history.

The scenarios cover push, replace, clearHistory, native pop, retained Page identity,
guard refusal, guarded native modal dismissal, one result settlement, covered-page
HMR, restored Back history, and repeated animated transitions. Assertions compare
logical history, native Page identities, rendered labels, controller/Fragment state
and diagnostics. An aborted gesture must have reported native progress.

## CI and ownership

`Native contracts / native-contracts` aggregates the following lanes:

| Lane                 | Environment                                        | Evidence                                                                                                               |
| -------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Contract Android     | API 34 and 36, Pixel 7 profile, x86_64 Google APIs | JSON per command, screenshots (including held gesture), UI XML, logcat, PIDs                                           |
| Contract iOS         | macOS 15 ARM, iOS 18.6, iPhone 16 Pro              | XCTest result bundle and screenshots, JSON per command, unified log, PIDs                                              |
| Native integration   | Android API 34 and foldable API 35                 | Existing tabs, drawer, sheets, deep links, shortcuts, state, conventions and fold/hinge suites                         |
| Native flows         | Android API 35 and iOS 18.6                        | System pickers, cancellation, results and lifecycle                                                                    |
| Predictive prototype | Android API 34/35/36, pinned candidate Core        | Legacy/Core comparison, native gestures and bitmap collection, Activity recreation and published-Core negative control |

The active [Native navigation acceptance rule](https://github.com/rafaelaugustos/vue-router-ns/rules/25469946)
requires `native-contracts` from the GitHub Actions app on `main`, with the branch
up to date and no bypass actors. A check with the same name from another
integration does not satisfy it.

The aggregate runs on every PR, including documentation-only PRs, so a required
check never disappears due to workflow path filtering. It accepts skipped native
jobs only when change detection confirms that no relevant code changed. Source,
fixtures, native scripts, workflows and dependencies all require the native lanes.
Workflow dispatch and the weekly schedule run every lane.

Rafael Augusto owns the fixture and baseline review. A platform failure stays red
until its evidence distinguishes a fixture defect, router regression, upstream
dependency defect, or runner outage. Upload failed-run artifacts before changing
the test. Do not silently retry navigation assertions, remove a lane, turn a
failure into a warning, or widen a budget merely to obtain a green build.
SDK download retries are bounded and happen before the native acceptance run.

macOS 15 ARM is intentional: the separate native-flow investigation reproduced a
FileProvider failure in a UIKit-only control on the macOS 26 hosted runner.
See [native flows](./native-flows.md). Local iOS 26.5 is complementary evidence.

## Regression control

The `contractsTest + contractFault` build removes the destination component's
`ceReload` forwarding in webpack memory. This reproduces Vue's former child-only
reload path: the native Page is not replaced when returning to the covered route.
The control must fail with that specific HMR assertion and identify itself as a
fault build. A startup crash or arbitrary failure does not qualify.

The fixed build must pass that same scenario alongside the other contracts. Published
router sources and dependencies are never patched for the control. #4 remains
closed; this suite continuously protects the behavior it established.

In the broken iOS build, the old native Page may stop reacting altogether. The
negative-control driver therefore requires the persisted HMR failure report,
including its fault flag and PID; it does not rely on that broken Page updating
its status label. The positive XCTest always requires the visible pass label.

## Timing and retention

After five unmeasured warm-up pairs, measure four batches of ten animated
push/pop pairs (100 ms fade in each direction). Compare the median and p95 of all
40 pairs with the profile's measured value, multiplier and absolute jitter
allowance. Profiles match the platform, SDK, device model, host architecture and
simulator type or emulator display configuration; an absent or mismatched profile
fails.

Each batch checks that only the root Vue component remains mounted and that
native and logical history still agree. After three fixed rounds of yielding,
collecting and yielding again, count live JS Page weak references and native weak references:
`java.lang.ref.WeakReference<Fragment>` with a `ReferenceQueue` on Android and an Objective-C weak
`NSHashTable<UIViewController>` on iOS. Native lifetime is not inferred solely
from the JS wrapper's lifetime. Limits apply to every batch, so increasing
retention cannot be hidden in an average. These are regression indicators for the
fixture's navigation objects, not a claim that every allocation in the OS is
leak-free. Every collection round is retained in the report. A single collection
can observe JS wrappers disappearing before their native references are released;
the fixed three-round protocol gives both heaps time to collect without polling
until a desired count appears. Android requires zero remaining Pages/Fragments.
Android counts collected references from the queue without calling `get()`,
which would create strong bridge wrappers and contaminate subsequent observations.
It requests ART collection through `Runtime.getRuntime().gc()`: Android 14's
[`System.gc()` implementation](https://android.googlesource.com/platform/libcore/+/refs/heads/android14-release/ojluni/src/main/java/java/lang/System.java)
can defer the request until finalization, making it unsuitable for these fixed
observation rounds. The artifact's logcat includes ART's explicit collections.
The iOS profile includes an explicit bounded allowance for transient UIKit
controllers, based on its measured samples.

`validate.mjs` rejects missing scenarios, incomplete/invalid samples, reused PIDs,
wrong fault builds, slow transitions and retained objects. Its unit tests exercise
those rejection paths independently of the native app.

Artifacts also record the commit, dirty state, host/CPU, installed NativeScript
versions, runner image and device configuration. Android process death waits for
both `/proc` and ActivityManager to release the old PID before reopening the
saved task; it does not force-stop away that task or retry a failed restoration.

## Local execution

Use dedicated devices: both drivers clear this demo's application data.
Build the package, install demo dependencies, scaffold its `App_Resources` as in
the workflow, then:

```sh
node scripts/native/contracts/prepare.mjs
(cd demo && ns build android --env.contractsTest)
node scripts/native/contracts/build-touch.mjs
adb -s "$ANDROID_SERIAL" install -r demo/platforms/android/app/build/outputs/apk/debug/app-debug.apk
ANDROID_SERIAL="$ANDROID_SERIAL" node scripts/native/contracts/android.mjs
node scripts/native/contracts/validate.mjs scripts/native/out/contracts-android/results.json android-local-36

(cd demo && ns build ios --for-device false --env.contractsTest)
IOS_SIMULATOR="$IOS_SIMULATOR" node scripts/native/contracts/ios.mjs
```

For the negative control, rebuild with `--env.contractFault` and run the same
driver with `EXPECT_HMR_FAILURE=1` and a separate `OUT` directory. Pass that
variable to `validate.mjs` as well.

The reversing iOS touch path uses XCTest's event synthesizer in the test runner
only, as WebDriverAgent does. No private interface is added to the app or library.
A missing XCTest interface fails explicitly. The fixture pushes gesture targets
with animation enabled so UIKit actually provides an interactive transition.

Android uses a separate self-instrumented APK and the public
[UiAutomation input API](https://developer.android.com/reference/android/app/UiAutomation).
It injects one continuous MotionEvent sequence with a shared down time, including
the reversal, and captures the screen while the pointer is down. The router app's
PID must stay unchanged. The input driver waits for UI idle; the fixture also
checks that its Fragment is resumed, its Activity has focus and its Frame owns
native Back before accepting a gesture.

After changing navigation mode, the driver waits for two successful launcher
inspections before launching the fixture. A single, specifically identified
**Pixel Launcher** ANR can be dismissed, with its screenshot/XML and recovery
record retained. Repeated launcher ANRs fail the lane. App ANRs and failed
navigation scenarios are never dismissed or restarted into a passing run.

The older shell UI helpers bound accessibility dumps and use wall-clock deadlines
(including inspection time). A slow or hung hierarchy query cannot silently turn
a 60-second wait into many minutes. Startup-trace builds buffer native Page
disposal stacks, keeping evidence for the previously observed intermittent
`unknown-native-page` startup failure without altering disposal behavior.

## Complementary physical-device and accessibility lane

Simulator automation does not certify touch hardware, thermal behavior, VoiceOver
or TalkBack. Before a release that changes gestures, focus or transitions:

1. Record the device, OS, router/dependency revisions and accessibility settings.
2. On an iPhone and an Android phone, repeat cancelled/committed Back, a guarded
   Back, guarded sheet dismissal and successful dismissal with a result.
3. With VoiceOver/TalkBack, verify focus on the destination, no focus on covered
   pages, and focus restoration on pop/dismissal.
4. With reduced motion enabled, verify navigation remains correct without the
   normal transition motion.
5. Attach the recording/log and explicit pass/fail for each check to the release
   or PR. A simulator pass is never substituted for these checks.

This lane is complementary and manually recorded; the #63 automated run alone
does not claim that a physical-device accessibility pass occurred.
