# Native accessibility validation — #57

Initial checks: 2026-10-15. NativeScript Android 9.1.1 / iOS 9.1.0, NativeScript-Vue 3.1.2. Physical-device follow-up: 2026-10-18.

## Native behavior audited

NativeScript's Page announces navigation from `onNavigatedTo`, before the Frame completes reconciliation. Android attempts to restore its remembered accessibility view on return; UIKit also restores native focus. Opted-in pages hold that existing announcement until the router confirms a different top entry. One explicit target replaces the original announcement; an unavailable target delegates back to core. Pages without explicit targets retain core behavior.

## Observable native checks

- Android API 35 emulator with the actual TalkBack service bound: `isAccessibilityFocused()` confirmed the initial heading after push, unchanged focus after guard rejection and the return control after back. The returned Page loaded after Frame completion; retaining the confirmed focus request until `loaded` fixed a failure caught by this run.
- The same native focus assertions passed with Android font scale at 200%. This checks focus with enlarged text, not every application layout or spoken utterance.
- A real compose modal returned a message result and restored TalkBack focus to its initiating Reply button. The source page remained visible and the result appeared in its content.
- With Android's animator duration scale set to zero, native Frame entries were unanimated and logical navigation/guards remained intact. iPadOS 26.5 also completed unanimated native navigation with `motion: 'reduced'`.
- iPadOS 26.5 push/back and guard rejection preserved history and visibility. VoiceOver was off during these simulator checks; they do not establish VoiceOver focus or speech behavior.
- A signed Xcode 27 build was installed on the paired physical iPhone 17 Pro running iOS 27.2. The physical-device focus checks below supersede the initial installation-only result.
- Unit coverage verifies one announcement after confirmed navigation, silent guard/cancel paths, missing/disposed target fallback, delayed Page loading, split-list modal ownership, both visible split panes, predictive-preview exclusion/restoration, live motion settings and shared-transition cleanup. Compatibility coverage prevents touching iOS 18 transition properties on iOS 17.

Emulator accessibility, font and animation settings were restored after validation. Temporary validation routes and multiple-window manifest flags are excluded from the demo source.

## Physical devices — 2026-10-18

The normal demo was built and installed on both devices. Navigation was driven through its router and existing component handlers using the NativeScript inspector. Assertions read the native accessibility focus; they did not request focus directly or substitute a screen-reader service.

| Device and reader                               | Observed behavior                                                                                                                                                                                                                                                                               |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iPhone 17 Pro, iOS 27.2, VoiceOver enabled      | After closing the VoiceOver tutorial and bringing the app to the foreground, back followed by push to `/messages/1` left `UIAccessibilityFocusedElement(null)` on the `TNSLabel` titled “Lunch on Friday?”. The application was active and the covered list page was hidden from accessibility. |
| ASUS Z017DC, Android 8 / API 26, TalkBack bound | Push to `/messages/1` focused the message heading, verified by `isAccessibilityFocused()`.                                                                                                                                                                                                      |
| ASUS, compose modal                             | Opening Reply focused the subject `EditText`. Rejecting “Discard draft?” kept `/compose` active and restored the same native subject element after the dialog closed; the router reported an aborted navigation.                                                                                |
| ASUS, modal result                              | Sending the draft returned to `/messages/1`, displayed the result and restored TalkBack focus to the initiating Reply button.                                                                                                                                                                   |

The ASUS run exposed a Material-tab regression: a Vue update cleared and recreated the native menu even when the destinations were unchanged. TalkBack then focused the selected Inbox tab instead of the page heading. `MaterialNavigationBar` now updates titles, icons and badges in place, rebuilding only when tab names or order change. The corrected build passed the physical push, guard and modal checks above. A regression test verifies stable menu-item identity, selection, property updates and obsolete-badge cleanup.

The maintainer accepted this iOS/Android validation as sufficient to close #57 and ship the correction. This is not a claim of exhaustive spoken-output testing: audible duplicate-announcement checks, physical iOS modal/guard/cancelled-swipe checks, VoiceOver with large Dynamic Type and screen-reader traversal during split resizing were not completed in this session. Existing emulator and unit coverage is described separately above.

Physical-device VoiceOver/TalkBack settings were returned to their recorded values after validation. No temporary inspector helpers were added to the demo source.

Library tests, typecheck and build passed after the fix: 329 tests passed and 8 were skipped. Android and signed iOS demo builds passed. The earlier validation also covered demo TypeScript and the documentation build. Native surface recreation is tracked separately in #46.
