# Published rc.3 consumer acceptance — #152

Date: 2026-10-25. App: `examples/rc3-consumer`, separate bundle ID `org.nativescript.routerrc3validation`. Exact published package `vue-router-ns@0.1.0-rc.3`; Core 9.1.3, NativeScript-Vue 3.1.2, iOS runtime 9.1.0, Android runtime 9.1.1. `npm run verify:package` checks the installed version and locked registry URL/integrity. No local router alias or unpublished Core patch is used.

## Recorded evidence

| Run                                   | Result and scope                                                                                                                                                                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Physical iPhone 17 Pro, iOS 27.2 beta | Initial consumer flow passed (43.775 s): real keyboard, modal result, guard keep/discard, reversed/committed Back and retained query. This predates the final app-only scrolling/Dynamic Type/keyboard-action refinements.                |
| Physical iPhone 17 Pro, iOS 27.2 beta | Final consumer flow passed (49.556 s): keyboard hide/return controls, modal results, guard keep/discard, retained query and reversed/committed Back.                                                                                      |
| Physical iPhone 17 Pro, iOS 27.2 beta | Final system-preferences flow passed (43.306 s): actual Dynamic Type accessibility XXXL and Reduce Motion enabled, using native button Back.                                                                                              |
| iPhone 16 simulator, iOS 18.6         | Final consumer flow passed (43.406 s), including keyboard hide/return controls, modal/guard/results and reversed/committed Back. Recorded in the PR video.                                                                                |
| iPhone 17 simulator, iOS 26.0         | Final Dynamic Type flow passed (42.353 s) with actual `UICTContentSizeCategoryAccessibilityXXXL` and `UIAccessibilityIsReduceMotionEnabled() === true`. Native Back button, keyboard, guards, modal results and query retention verified. |
| Android emulator, API 36 / Android 16 | Final app passed adb/UIAutomator keyboard, filter retention, modal, guard refusal, saved result and discard checks.                                                                                                                       |
| Static/package checks                 | Registry version/URL/integrity assertion and standalone `tsc --noEmit` passed; native iOS and Android builds passed.                                                                                                                      |

On the physical iPhone, the app observed `UICTContentSizeCategoryXS` / Reduce Motion off for the baseline, then `UICTContentSizeCategoryAccessibilityXXXL` / Reduce Motion on. The runner restored and re-read the original Extra Small text size, larger accessibility sizes off and Reduce Motion off. Both XCTest result bundles report one passed test, zero failed and zero skipped. The earlier locked-device attempt is superseded by these final hardware passes.

The iOS 26 simulator's original content size (`large`) and Reduce Motion (`false`) were recorded and restored after testing. The app recorded the real preferences; the test did not substitute a router flag for the OS setting.

## Findings that changed the fixture

NativeScript's iOS font adjustment is opt-in. Setting the OS category alone did not enlarge the original labels. The consumer explicitly enables `iosAccessibilityAdjustsFontSize` and uses scroll containers. At the largest category, a keyboard covered the note button; a search Return action and a modal Hide keyboard action make controls reachable. The final preferences run tests those changes, not the earlier fixed-size layout.

With Reduce Motion enabled, the reversing gesture used by the ordinary interactive test did not keep detail visible: Back completed. That negative observation is retained rather than reported as cancellation support under every setting. The preferences case therefore exercises native button Back; real interactive cancellation is independently proved in the normal-motion iOS 18.6 and final physical baseline runs. The router does not override UIKit's reduced-motion behavior.

## Explicit remaining gaps

- **Spoken VoiceOver:** deferred at the maintainer's request. Automated labels/tree queries do not certify announcements or traversal of covered content.
- **Physical TalkBack/Android:** no physical Android device was available in this session.
- **Manual modal/guard/cancelled-gesture speech:** not verified. Physical preference and interaction passes do not certify screen-reader announcements.
- The iPhone runs a beta OS; this supplements the supported iOS 18.6 simulator baseline rather than replacing it. This focused consumer pass does not rerun or replace the full release CI matrix.

Issue #152 stays open for these physical/manual gaps. Neither this report nor a green candidate authorizes publishing 0.1.0 stable. See the stable-readiness guide and roadmap #64 for the maintainer's release decision.

Reproduction commands: [consumer README](../examples/rc3-consumer/README.md). Machine-readable summaries: [combined evidence](./evidence/rc3-consumer.json) and [physical results and restored preferences](./evidence/rc3-physical-consumer.json).

The optional `devicectl` recording command was unsupported by this device; that limitation did not affect XCTest. The PR demonstration uses a separate USB screen recording of the real app, not a reconstructed sequence of screenshots.
