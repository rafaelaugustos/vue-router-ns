# Adaptive drawer acceptance

Build the package with `npm run build`, install the demo dependencies and prepare `demo/App_Resources` as described in the [demo setup](../../../demo/README.md). The fixture is selected only by `--env.adaptivedrawerTest`.

The drivers reinstall/clear the fixture app `org.nativescript.vuerouterns`; use dedicated test devices. They save JSON reports in `scripts/native/out`, and input drivers also retain accessibility trees/screenshots or XCTest attachments. The fixture compares actual Page/Frame objects, native Frame views, Vue state objects, logical/native entry IDs and drafts; the file bridge is not part of the library.

## iOS

```sh
cd demo
ns build ios --for-device false --env.adaptivedrawerTest
cd ..
IOS_SIMULATOR=<dedicated-booted-uuid> node scripts/native/adaptive-drawer/run.mjs
```

Repeat on iPhone 16 and iPad Pro 11-inch M4 with iOS 18.6. To test Reduce Motion, save the current `com.apple.Accessibility ReduceMotionEnabled` preference, set it with `xcrun simctl spawn <uuid> defaults write com.apple.Accessibility ReduceMotionEnabled -bool YES`, rerun the driver, then restore the original preference. The report records the actual UIKit Reduce Motion value.

For real keyboard input, native accessibility reachability, tab navigation, modal results and rotation, reinstall the app to clear the bridge run's saved navigation state, then:

```sh
ruby scripts/native/adaptive-drawer/project.rb /tmp/router-adaptive-tests
xcodebuild test \
  -project /tmp/router-adaptive-tests/AdaptiveDrawerChecks.xcodeproj \
  -scheme AdaptiveDrawerChecks \
  -destination 'platform=iOS Simulator,id=<uuid>' \
  -derivedDataPath /tmp/router-adaptive-tests/build \
  -collect-test-diagnostics never \
  -resultBundlePath scripts/native/out/adaptive-ios/checks.xcresult
```

The result bundle path must not already exist. The iPad test verifies the actual `auto` transition at 840 DIPs between portrait and landscape; the phone also exercises explicit permanent presentation.

## Rotation during active navigation

Use a dedicated, booted iPad Pro 11-inch M4 with the adaptive fixture built above. This companion requires Ruby with the xcodeproj gem and Xcode. It reinstalls the app, warms two named stacks with distinct drafts, generates its XCTest project in a temporary directory and reads simulator files directly to avoid XCTest's implicit app-idle synchronization before orientation requests.

```sh
IOS_SIMULATOR=<dedicated-booted-ipad-uuid> OUT=scripts/native/out/adaptive-rotation \
  node scripts/native/adaptive-drawer/rotation.mjs
```

Use a new output directory for each run because Xcode result bundles cannot already exist. Optionally set `RECORD_VIDEO=1` to retain a real simulator recording, and `RUBY=/path/to/ruby` if your configured Ruby is not on PATH. The driver bounds simulator commands (30 seconds, 120 seconds for installation), reuses the resolved app container, and logs preparation milestones. Requested recordings are observed from process start and have a ten-second shutdown deadline; recording failures fail the run. The driver has a six-minute XCTest timeout (including compilation and runner startup) and copies per-case JSON and XCTest logs even when XCTest fails. Build products stay in a temporary directory rather than the uploaded artifacts.

The rotation suite targets a **maximized, full-size application window**, matching #168's original 1210-point landscape baseline. Before every case, after its initial orientation and fixture preparation, it waits up to five seconds for usable accessibility geometry, uses SpringBoard's normal window-controls/Zoom buttons when necessary, and requires the application's accessibility window to match the screen-sized application frame. A Zoom action has a separate five-second geometry deadline. Each gesture rechecks the full-window assertion. `window-setup.json` contains one named check per scenario, with before/after geometry and a timestamp; the host requires every selected check to precede its native observer (ten in device mode, six in overlap mode). Setup never runs during an armed transition and failed gestures are not retried. See the [CI follow-up](../../../test/native-window-precondition-222.md). On iPadOS 26.2 the default full-screen compatibility resources can still launch a reduced window. Missing inset gestures in that configuration are retained as diagnostics, not accepted coverage. This suite does not certify windowed/Stage Manager input.

The probe attempts ten scenarios across push, programmatic Back, swipe commit/cancel and settled/modal controls. Each active case must prove that the orientation request preceded native navigation completion. The report separately labels `overlap`, `rotation-deferred`, `overlap-unconfirmed`, `settled-control` and `gesture-not-reproduced`. If navigation completion is pending but its coordinator is no longer current, overlap remains unconfirmed. A missing gesture is accepted only for the two permanent-content cases on iPadOS 18.6, with unchanged identity/history assertions. It fails on iPadOS 26 and later.

On iPadOS 26+, the permanent-content cases require both actual native outcomes. The cancellation controls request rotation while pointer interaction is active. Both committed controls wait for UIKit's `interaction-ended` callback, then request rotation during the remaining navigation animation. It must still precede `navigation-ended`. Rotating with the pointer down can cancel even a long drag; its length never substitutes for UIKit's actual result. The driver retains the signal, input phase and native timestamps. This moves the commit request out of the long pointer-down drag that produced two orientation transitions on the hosted runner. The portrait-to-landscape control still records whichever native outcome occurs.

Each run records source hashes, built router files, installed Core source hashes, package/tool versions, built Info.plist configuration and the XCTest summary. The demo uses the checkout's built `dist`; this suite does not certify an npm registry consumer. The [published content-Back report](../../../test/native-published-content-back-168.md) compares Core files with the official package and retains the exact native evidence, diagnostic controls and video.

A native observer records the rotation callback and current coordinator identity without replacing delegates or synthesizing a pop. The host checks surviving object/entry identities, inactive history/drafts, real native controller membership, disposal count, promise settlement, bounds/accessibility state, and follow-up guards/navigation. A committed or cancelled gesture is judged by UIKit's actual completion, not the intended drag length. The [detailed acceptance report](../../../test/native-drawer-rotation.md) records OS differences and physical-device limitations.

The full `Native iOS drawer` workflow requires an additional iPadOS 26.2 content-Back job. Its existing iOS 18.6 rows remain unchanged. Run only the new job with:

```sh
gh workflow run native-drawer-ios.yml --ref <candidate-branch> -f scope=content-back
```

This focused run skips the older drawer jobs and is not a complete native matrix.

### Programmatic overlap

The default `ROTATION_MODE=device` suite above keeps the platform transition and waits for native navigation observation before requesting device orientation. A separate mode uses Core's public `slide` transition with `duration: 1500` and dispatches orientation near navigation admission:

```sh
ROTATION_MODE=overlap IOS_SIMULATOR=<dedicated-booted-ipad-uuid> \
  RECORD_VIDEO=1 OUT=scripts/native/out/programmatic-overlap \
  node scripts/native/adaptive-drawer/rotation.mjs
```

It runs two XCTest methods and six scenarios: push and programmatic Back in both directions, plus settled and pending-modal controls. The original identity/history/draft/disposal/promise/layout/guard assertions remain. Every programmatic case additionally requires a target-size rotation while the same native navigation coordinator is current and unfinished, distinct from the rotation coordinator. A request sent before completion is insufficient. The observer checks the native context at `viewWillTransition` as well as its normal polling point, and waits for all observed rotations to complete and the last rotation to reach the target dimensions before taking its final snapshot.

`overlapEvidence` retains the full rotation sequence, including UIKit's temporary return to the initial orientation. `requestedDuringNavigation` can be false in this mode: concurrent requests near admission are accepted only if the later native callbacks prove actual overlap. No gesture is attempted or retried by this mode, and the driver never assigns a navigation delegate. Core selects its own animator through the public transition option. See the [stage report](../../../test/native-programmatic-rotation-167.md) for the exact composition and boundaries.

The full workflow includes an 18.6/26.2 overlap matrix. Each row also reruns the original device suite as a regression control. Run only these two rows with:

```sh
gh workflow run native-drawer-ios.yml --ref <candidate-branch> -f scope=programmatic-overlap
```

This focused run skips the separate drawer/content-Back jobs; it is not the complete native matrix.

### Gesture phase and strict overlap audit

`ROTATION_MODE=gesture` keeps the platform-default transition and requests orientation while pointer input is active for both commit and cancel intentions. It runs three XCTest methods and six scenarios: both gesture intentions in both directions, plus settled and pending-modal controls. It retains the full-window setup, identity/history/draft/disposal/promise/layout checks and follow-up navigation/guards. A missing gesture is still allowed only at the known iPadOS 18.6 permanent-content edge.

```sh
ROTATION_MODE=gesture IOS_SIMULATOR=<dedicated-booted-ipad-uuid> \
  RECORD_VIDEO=1 OUT=scripts/native/out/gesture-rotation \
  node scripts/native/adaptive-drawer/rotation.mjs
```

Every reproduced gesture must deliver a `UIDeviceOrientationDidChangeNotification` for the requested orientation before UIKit's interaction decision. At receipt, the native navigation coordinator must still be current and interactive, with an active native edge or content Back recognizer. The observer reads these public properties without changing gesture targets, delegates, animation duration or transition policy. Native completion determines the actual committed/cancelled outcome; the drag's intention is recorded separately.

`gestureEvidence` classifies `interactive-overlap`, `completion-overlap`, `rotation-deferred` or `overlap-unconfirmed` from the target-size rotation callback and distinct coordinator identities. A device-orientation notification alone is not a window rotation. Both currently tested simulator versions defer the latter until navigation finishes. A green phase suite therefore certifies the delivered input and final state, **not genuine gesture overlap**. Audit that stronger claim separately:

```sh
node scripts/native/adaptive-drawer/gesture-overlap.mjs scripts/native/out/gesture-rotation
```

The audit recomputes proofs from raw reports and exits nonzero if any of the four gesture cases is deferred, missing or unconfirmed. It is expected to reject the currently recorded composition; it never retries input or relabels deferral as overlap. The [stage report](../../../test/native-gesture-rotation-167.md) retains these negative coverage results and exact versions.

Run the phase suite plus both original regression profiles on both iPadOS versions with:

```sh
gh workflow run native-drawer-ios.yml --ref <candidate-branch> -f scope=gesture-rotation
```

The existing `programmatic-overlap` matrix retains its artifact names and adds a `gesture-rotation` directory for this scope and full runs. The focused `programmatic-overlap` scope keeps its original two suites. This is not the full native release matrix.

## Android

```sh
node scripts/native/prepare-folds.mjs
cd demo
ns build android --env.adaptivedrawerTest
cd ..
ANDROID_SERIAL=<dedicated-emulator> node scripts/native/adaptive-drawer/run.mjs
ANDROID_SERIAL=<dedicated-emulator> OUT=scripts/native/out/adaptive-input node scripts/native/adaptive-drawer/android-input.mjs
```

The first driver verifies state and identity; the second uses `input tap/text/keyevent` and UIAutomator to prove that both regions receive real input in permanent mode, hidden/covered regions leave the accessibility tree, typed drafts survive tab/mode changes, and Back pops a page instead of consuming permanent visibility.

Android bridge snapshots wait for the actual `DrawerLayout` idle state and completed layout, with a three-second deadline. They do not assume that 500 ms means an opening completed. Each report includes native callback timestamps and settlement duration; the host also records command duration and preserves error replies. Commands are sent once. A missing endpoint, wrong model/accessibility state or changed native identity still fails. UIKit retains its existing timing.

For a focused hosted run, push the candidate branch and use:

```sh
gh workflow run native.yml --ref <candidate-branch> -f lane=foldable
```

This selects the complete foldable lane: adaptive contracts, both fold/hinge suites, native input and adaptive hinge checks. The contracts run first so the opening regression fails before the longer posture suites. The lane caches Gradle dependencies and bounds ADB commands; a newer manual run on the same non-main branch cancels its obsolete predecessor. The default `all` selection and callers of the full workflow still run every integration lane. A focused green run does not certify the entire release matrix.

To record the actual fixture, run `ANDROID_SERIAL=<dedicated-fold-emulator> OUT=scripts/native/out/adaptive-recording node scripts/native/adaptive-drawer/record.mjs`. The recording demonstrates overlay opening/closing, permanent presentation, retained drafts/tabs and a modal result; every step checks retained identities. It writes `drawer-settlement.mp4` alongside the command reports.

The input driver can dismiss one system-owned **Pixel Launcher isn't responding** dialog, which otherwise obscures the fixture and produces a misleading missing-target failure. Before closing it, the driver saves `launcher-anr-1.xml` and `.png`; `launcher-recovery-1.json` records the outcome and fixture PIDs before/after. It then reads a fresh hierarchy and continues the original scenario. It never restarts the fixture or retries failed navigation assertions. A repeated launcher ANR, any other app's ANR, an unusable Close app button, or a missing/changed fixture PID fails the run and retains evidence. This recovery is specific to the English CI emulator dialog; other system dialogs remain failures.

On a Pixel Fold emulator configured with [`prepare-fold-avd.mjs`](../prepare-fold-avd.mjs):

```sh
ANDROID_SERIAL=<dedicated-fold-emulator> OUT=scripts/native/out/adaptive-hinge node scripts/native/adaptive-drawer/folds.mjs
```

This uses the emulator hinge sensor and the platform `display_features` setting to deliver an occluding FoldingFeature through the real AndroidX WindowManager provider. It verifies flat/half-open postures, RTL, horizontal rotation under a pending modal, and disabling/re-enabling the observer. Display-feature and rotation settings are restored in `finally`; the dedicated device returns to its open posture.

The full native workflows run these drivers. They do not add emulator jobs to the fast pull-request gate. See the [validation report](../../../test/native-drawer-adaptive.md) for manual boundaries.
