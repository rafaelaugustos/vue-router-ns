# Operating-system link validation — #48

2026-10-16, NativeScript Android runtime 9.1.1 / iOS runtime 9.1.0, NativeScript-Vue 3.1.2. The demo opted in with `links: { schemes: ['https', 'vuerouterns'], hosts: ['vue-router-ns.rafaelaugusto.dev'], frame }`, where `frame` selects the tab and returns `inbox` or `settings`. The intent filters and the `CFBundleURLTypes` entry from the guide were added to the local `App_Resources`.

## Android 16 / API 36 emulator

Links sent with `adb shell am start -a android.intent.action.VIEW -d <url>`; the app's `singleTask` activity receives running-app links as new intents.

| Link                                                                      | Result                                                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Cold start, `vuerouterns://messages/2`                                    | App data cleared first. Launched on the inbox with the message on top: trail `/ › /messages/2`.   |
| Running app, `vuerouterns://compose` (a modal route)                      | The compose modal was presented; back closed it and the trail was unchanged.                      |
| Running app, `vuerouterns://settings/account`                             | Settings tab selected by `frame`; the `requiresAuth` guard redirected the link to the login page. |
| `vuerouterns://messages/1` twice within a second                          | One `/messages/1` on the stack.                                                                   |
| `vuerouterns://messages/3` with `FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY`     | Ignored: the stack was unchanged.                                                                 |
| `https://vue-router-ns.rafaelaugusto.dev/messages/3` sent to the activity | Taken: `/messages/3` on top.                                                                      |
| `https://elsewhere.dev/messages/1` sent to the activity                   | Ignored by the host allow-list: the stack was unchanged.                                          |

No JavaScript errors or warnings were logged during the run. An earlier run with a restored stack showed the link landing after restoration, on top of the restored pages.

## iPhone 16 simulator, iOS 18.6

The simulator build carries the `vuerouterns` scheme and the link handlers. The app launched normally with them installed (inbox shown, no errors in the unified log). `xcrun simctl openurl` with a custom scheme raises the system's "Open in “demo”?" prompt, which needs a tap that this environment could not automate, so the delivery itself was not observed on iOS. The delegate path (`applicationOpenURLOptions`, `applicationContinueUserActivityRestorationHandler`, launch options and scene connections) is exercised by the automated suite against core's `addDelegateHandler` contract; a manual tap on the prompt, or a Universal Link with a published association file, remains to be checked by hand.

## Automated

`test/links.spec.ts` covers policy screening, mapping to typed locations, parents and guards, cold-start ordering with and without a restored stack, waiting for a later-mounted stack with tab selection, Android launch/recreation/history/new-intent intents, iOS `openURL`, Universal Link activities, launch options and scene connections, the repeat window, modal routes, link options and `system: false`. 288 tests pass.

## Not validated natively

- Verified App Links (`autoVerify` against a published `assetlinks.json`) and Universal Links against a published `apple-app-site-association`: both need the domain to serve the files; the custom scheme and the explicit `https` intent were exercised instead.
- A link into a second native window (#46).
