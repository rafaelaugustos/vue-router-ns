# Documentation recordings

`docs/public/media` contains actual recordings of the repository's NativeScript-Vue demo, with one JPEG poster per MP4. Four smaller GIFs in `.github/assets` work in the GitHub README. The documentation's `Clip` component uses the videos, provides playback controls and does not autoplay when the browser requests reduced motion.

The initial set was captured for beta.9 on 2026-10-18: iPhone 17 / iOS 26.0, iPad Pro 13-inch (M5) / iPadOS 26.0 and an Android 16 / API 36 emulator. These are simulator/emulator recordings, not physical-device footage. All names and messages are the demo's local sample data.

## Record

Build the router and demo first. See `demo/README.md`. Return the app to the starting page, start recording, leave a short pause between actions and at the end, then stop. Keep the raw files outside the repository.

```sh
xcrun simctl io <udid> recordVideo --codec=h264 /tmp/ios-tabs.mov
# Stop with Ctrl-C after performing the actions.

adb shell screenrecord --time-limit 30 --bit-rate 4000000 /sdcard/android-tabs.mp4
adb pull /sdcard/android-tabs.mp4 /tmp/android-tabs.mp4
```

| Recording          | Actions                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ios-tabs`         | Inbox → message → Settings → reselect Settings → Inbox → reselect Inbox.                                                                               |
| `android-tabs`     | Inbox → message → Settings → Inbox → reselect Inbox.                                                                                                   |
| `ipad-tabs`        | Open UIKit's sidebar → Settings → open sidebar → Inbox.                                                                                                |
| `ios-navigation`   | Inbox → first message → Next message → Back to inbox.                                                                                                  |
| `ipad-split`       | With the sidebar closed and a wide window, select the three messages in turn.                                                                          |
| `ios-sheet`        | Inbox → Compose → drag the medium sheet up → Cancel.                                                                                                   |
| `android-sheet`    | Inbox → Compose → system Back.                                                                                                                         |
| `ios-context-menu` | Long-press the first inbox row → tap the preview, above the actions.                                                                                   |
| `ios-guards`       | Signed-out Settings → Account → type a name → Back → Stay → Back → Leave.                                                                              |
| `android-restore`  | Signed-out Account → type a name → dismiss keyboard → Home → kill the background process → launch again. Verify the PID changed and the name returned. |
| `ios-search`       | Inbox → Search → type Ana → clear the query → close search.                                                                                            |
| `android-drawer`   | Inbox → Menu → Settings → Inbox → Menu → system Back.                                                                                                  |

For the restoration clip, use `adb shell am kill org.nativescript.vuerouterns` only after the demo is in the background. Reopen with `adb shell am start -n org.nativescript.vuerouterns/com.tns.NativeScriptActivity`. This deliberately kills only the demo process. `npm run test:native:android` separately checks restoration and its event ordering.

## Encode and review

Install FFmpeg, then pass raw recordings to the encoder. Their basenames become the media names used by `Clip`:

```sh
node scripts/media/encode.mjs /tmp/ios-tabs.mov /tmp/android-tabs.mp4
npm run docs:build
npm run docs:preview
```

The encoder preserves playback speed, removes audio, uses H.264 at 30 fps and writes a poster from 0.5 seconds. Phone videos are 560 pixels wide, iPad videos 720; the README GIFs are 220 pixels wide at 10 fps. Inspect the entire clip after encoding, including the ending, and make sure its caption describes what it actually shows. Update both English and Portuguese guides when the demonstrated behavior changes.

## beta.14 examples (2026-10-21)

Five additional clips were recorded from the real demo on a dedicated iPhone 17 / iOS 26.0 simulator, using Core 9.1.3, NativeScript-Vue 3.1.2 and the iOS 9.1.0 runtime. No UI or transition is composited. `ios-zoom` uses the new Settings → Zoom from a card page in a plain RouterView: the first detail of the inbox's split host does not demonstrate that animation.

| Recording             | Actions and observed result                                                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ios-zoom`            | Settings → Zoom from a card → tap the blue card → Back. UIKit grows the destination from the card and shrinks it back.                                                                                                           |
| `ios-modal-result`    | Inbox → first message → Reply → type “See you at 12:30!” → Send. The originating page displays the returned text.                                                                                                                |
| `ios-document-picker` | Inbox → Compose → Attach → close the native document picker. The form displays “Picker cancelled”; no route was added. This clip demonstrates cancellation, not a successful file selection.                                     |
| `ios-deep-link`       | With Inbox selected, deliver `vuerouterns://settings/account` through `simctl openurl`. Settings becomes selected and the authentication guard opens Sign in. This is custom-scheme delivery, not domain-association validation. |
| `ios-shortcuts`       | With Inbox selected, press Home → long-press the demo icon → New message. The native quick action opens Compose.                                                                                                                 |

Re-record with `IOS_SIMULATOR=<udid> IDB=/path/to/idb node scripts/media/record-ios.mjs <recording>`. The script expects the portrait 402 × 874 point iPhone 17 layout, an already running demo, no open modal, and a signed-out session for the guarded link. It leaves the ending screenshot and accessibility tree beside the raw video. Close the modal before starting another recording. Use `encode.mjs` above, review the ending as well as the transition, and commit only the MP4/poster pair.

During capture, the Compose quick action was refused by the native presenter when it also switched from Settings to the inbox split. Repeating from the already selected Inbox succeeded. The shortcut clip is scoped to that successful same-tab case; it is not evidence that a cross-tab modal entry is fixed. The deep-link clip separately demonstrates cross-tab entry into a normal page.
