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

## Assistive speech acceptance

On the physical iPhone 17 Pro / iOS 27.2 beta, the **VoiceOver service test passed in 120.567 s**. It enables the real screen reader, advances/backtracks its focus, activates controls and captures `XCUIVoiceOverService.Output.utterance`. The recorded output comes from Apple's speech service, not an accessibility label inferred by the test. It covers push, modal, Cancel/return, dirty guard refusal, retained modal and discard/return. Original VoiceOver off was restored in `finally` and independently re-read with `devicectl`.

[The speech evidence](./evidence/rc3-voiceover-speech.json) retains each utterance. The assertions require visible controls to be spoken and reject distinctive content from covered pages (for example `Into the forest`, `Edit in a modal` while editing, and `Note draft` after dismissal). Backward traversal after guard refusal also announces a generic native `Back button`. Activating it opens the dirty-modal guard. The extended runner refuses that guard, then discards through Cancel and verifies that the covered detail remains the return destination. This checks the behavior of that announcement without guessing its UIKit element identity. The result remains bounded evidence for this consumer, not universal native-header certification.

The Android acceptance uses **TalkBack 16.0.0.738667889 on an Android 16 / API 36 emulator**, as requested by the maintainer because physical Android hardware is unavailable. The runner records TalkBack's `SpeechControllerImpl` fragments and TTS completion callbacks while activating native accessibility actions and traversing keyboard focus. Its tree reader connects with `FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES`; ordinary `uiautomator dump` temporarily disables TalkBack and is unsuitable for this test. Tree snapshots are used to locate controls and check visible focus, not as proof of speech. The final run **passed all 43 recorded stages**, including modal return, dirty guard refusal and discard/return, without a TalkBack restart during the run. [Speech and focus evidence](./evidence/rc3-talkback-speech.json) retains utterances and completion results.

## Acceptance limits

- Android evidence is emulator-only and uses keyboard traversal/native accessibility activation. It does not certify physical-device audio, TalkBack swipe traversal or every Android vendor/TTS combination.
- VoiceOver evidence uses the iOS 27 service on a beta device. Older iOS versions retain the independently passing native UI baseline; they are not certified by this speech runner.
- Reversed/committed UIKit Back is proved separately in the normal-motion baseline. VoiceOver repurposes touch gestures; these runs do not claim interactive cancellation speech under every assistive/system preference.
- The speech service output and completion callbacks are recorded, but the demonstration video is silent. No microphone or camera was used.

These limits are part of the focused #152 acceptance and are not hidden behind a universal accessibility claim. They do not authorize a stable release or replace the full release CI matrix.

Reproduction commands: [consumer README](../examples/rc3-consumer/README.md). Machine-readable summaries: [combined evidence](./evidence/rc3-consumer.json) and [physical results and restored preferences](./evidence/rc3-physical-consumer.json).

The optional `devicectl` recording command was unsupported by this device; that limitation did not affect XCTest. The PR demonstration uses a separate USB screen recording of the real app, not a reconstructed sequence of screenshots.
