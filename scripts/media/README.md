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
