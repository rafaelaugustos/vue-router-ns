# Native accessibility validation — #57

2026-10-15. NativeScript Android 9.1.1 / iOS 9.1.0, NativeScript-Vue 3.1.2.

## Native behavior audited

NativeScript's Page announces navigation from `onNavigatedTo`, before the Frame completes reconciliation. Android attempts to restore its remembered accessibility view on return; UIKit also restores native focus. Opted-in pages hold that existing announcement until the router confirms a different top entry. One explicit target replaces the original announcement; an unavailable target delegates back to core. Pages without explicit targets retain core behavior.

## Observable native checks

- Android API 35 emulator with the actual TalkBack service bound: `isAccessibilityFocused()` confirmed the initial heading after push, unchanged focus after guard rejection and the return control after back. The returned Page loaded after Frame completion; retaining the confirmed focus request until `loaded` fixed a failure caught by this run.
- The same native focus assertions passed with Android font scale at 200%. This checks focus with enlarged text, not every application layout or spoken utterance.
- A real compose modal returned a message result and restored TalkBack focus to its initiating Reply button. The source page remained visible and the result appeared in its content.
- With Android's animator duration scale set to zero, native Frame entries were unanimated and logical navigation/guards remained intact. iPadOS 26.5 also completed unanimated native navigation with `motion: 'reduced'`.
- iPadOS 26.5 push/back and guard rejection preserved history and visibility. VoiceOver was off during these simulator checks; they do not establish VoiceOver focus or speech behavior.
- A signed Xcode 27 build was installed on the paired physical iPhone 17 Pro running iOS 27.2. Manual VoiceOver acceptance remains pending; installation alone does not validate accessibility.
- Unit coverage verifies one announcement after confirmed navigation, silent guard/cancel paths, missing/disposed target fallback, delayed Page loading, split-list modal ownership, both visible split panes, predictive-preview exclusion/restoration, live motion settings and shared-transition cleanup. Compatibility coverage prevents touching iOS 18 transition properties on iOS 17.

Emulator accessibility, font and animation settings were restored after validation. Temporary validation routes and multiple-window manifest flags are excluded from the demo source.

## Manual acceptance still required

On a physical iPhone with VoiceOver, verify one meaningful initial announcement after opening a message; Reply → modal → return restores Reply; rejecting “Discard draft?” retains the current context; and a cancelled edge swipe does not announce a completed navigation. Check narrow/expanded split layouts and large Dynamic Type. Audible TalkBack traversal and split resizing also require a manual pass; native focus assertions alone cannot establish what the user hears.

Library tests/typecheck/build, demo TypeScript and documentation build pass. The full suite contains 206 tests. Native surface recreation is tracked separately in #46.
