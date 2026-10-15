# Native keyboard validation — #56

2026-10-15. Android API 35 and iPad Pro 11 (M5), iPadOS 26.5.

- Android: Ctrl+N injected with `adb shell input keycombination 113 42` opened the real compose modal. Escape injected through Android input closed it and restored the list. The scope was the Activity's focused native GridLayout.
- iPad: native UIKeyCommand discovery omitted unavailable root back/close actions, exposed localized-capable titles, and UIKit `sendActionToFromForEvent` traversed the real responder chain to open compose and close it with Escape. The actual presentation took about 650 ms; checks waited for completion.
- Native testing caught two iOS bridge errors: the Objective-C action selector must include its colon in both implementation and exposed metadata, and discovery must return an Objective-C NSMutableArray rather than a temporary JavaScript array adapter. Both have regression assertions.
- Two simultaneous native windows were exercised on each platform. A command dispatched in the secondary window pushed its own `/validation/detail` route while the primary router's history remained unchanged. Android used OS input; iPad used the key window's actual responder chain.
- Android Escape also dismissed an active native Toolbar search without popping its page or clearing the app's retained query. The listener belongs to the Page so it receives unhandled keys from the Toolbar as well as the content scope.
- Automated tests additionally cover async guard rejection/acceptance, repeat suppression, reactive labels/enabled state, typed route actions, modal stack closure, editor opt-out, active IME composition, reserved editing bindings and removal of Android listeners. Library/demo typechecks and documentation build pass.

A physical keyboard discovery overlay and manual IME exercise are not asserted by this automated run. The view-owned bridge and explicit modal target avoid process-global Activity/Frame selection. Retaining the original surface across Activity recreation or scene reconnect remains tracked by #46; the concurrent-window checks do not claim to resolve that separate lifecycle issue.
