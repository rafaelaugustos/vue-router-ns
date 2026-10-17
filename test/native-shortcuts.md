# Home-screen shortcut validation — #58

2026-10-16, NativeScript Android runtime 9.1.1, NativeScript-Vue 3.1.2, Medium Phone emulator, Android 16 / API 36. The demo publishes `compose` and `settings` shortcuts once the router is ready, and an `account` one while a session exists, from a `watchEffect` on its store.

## Android

| Check                | Result                                                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publishing           | `dumpsys shortcut` lists `settings` and `compose` as dynamic shortcuts of `com.tns.NativeScriptActivity`, each with a `VIEW` intent carrying `vue-router-ns://shortcut/<id>?to=…&v=1`. |
| Warm tap, `settings` | Sent as the shortcut's intent with `am start`: the settings tab was selected and shown.                                                                                                |
| Warm tap, `compose`  | The compose modal was presented; back closed it.                                                                                                                                       |
| Cold tap, `compose`  | After `force-stop`, the app launched with its restored stack and the compose modal on top.                                                                                             |
| Destination gone     | A payload pointing at `/retired`: the demo's catch-all route took it (its "Not found" page), as the guide says a catch-all would; without one the link is ignored.                     |
| Follows the session  | Signing in on the login page made `account` appear in `dumpsys shortcut`; signing out removed it, `settings` and `compose` staying.                                                    |

No JavaScript errors or warnings were logged. A real launcher tap sends the same intent the service dump shows.

## iOS

Quick actions are published through `UIApplication.sharedApplication.shortcutItems` and taken through `applicationPerformActionForShortcutItemCompletionHandler` and scene connection options, which core forwards to the application delegate. The simulator offers no way to long-press the icon from the command line, so the iOS path is covered by the automated suite only.

## Automated

`test/shortcuts.spec.ts` covers Android publishing with labels, icons and payload URLs, taps through new intents, iOS publishing and taps while running and at scene connection, foreign quick actions, the platform limit with its warning, removal with an empty list, stale and foreign payloads, and refusing unknown routes and duplicate ids. 293 tests pass.
