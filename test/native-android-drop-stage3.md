# Native Android drag/drop — #181 stage 3

This stage adds an optional application recipe and acceptance fixture. It changes
no package runtime, exports or NativeHost contract. The [Android bridge](../examples/drag-drop/android.ts)
shares the existing bounded [destination policy](../examples/drag-drop/policy.ts).

The dedicated Pixel 7 ARM64 Android 14/API 34 emulator runs one Activity with two
retained tabs. Android local text transfer is synchronous at drop; the asynchronous
NSItemProvider tests from the iPad stages are not Android evidence. No global drag
flags, URI grants, external applications or cross-Activity/window transfers are used.

## Native acceptance

The [reproduction driver](../scripts/native/android-drop/README.md) uses real native
long-press/move/release, button taps and Control–O input. App reports verify exact
source/Inbox Page identity, unchanged independent drafts and agreement between
native and logical histories after each action. Every drag forces two native GC
cycles between callbacks. Hover checks both histories and the selected source tab.

| Input                                          | Verified result                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| Valid drop                                     | Opens document 7 in the registered Inbox stack and reveals its tab.             |
| Second intentional drag                        | Fresh delivery id; no duplicate document entry.                                 |
| Captured intent replay                         | Explicit repeat rejection, unchanged histories.                                 |
| Cancel, multiple items, unsupported MIME       | Native cancellation; no policy load or navigation.                              |
| Malformed JSON, expired request, removed route | Native transfer accepted; explicit ignored outcome, no navigation.              |
| Refusing guard                                 | Transfer accepted; handled navigation with failure type 4; histories preserved. |
| Disposed target                                | Native gesture ends without an accepting receiver or navigation.                |
| Button and Control–O                           | Same policy, internal source, explicit target and fresh identities.             |
| TalkBack                                       | Native touch exploration focuses the labeled button; double tap activates it.   |
| Final disposal                                 | Both native registrations and policy removed; drafts retained.                  |

TalkBack remains enabled during read-only public instrumentation using
`UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES`. The inspector only reads
bounds/focus; it never activates a node or invokes the application. Touchscreen
events enter through the emulator console (device 0), and the driver requires
focus without navigation before double-tap activation. Shell-injected taps are
not used as evidence of TalkBack touch exploration. The app's
navigation report independently records the enabled spoken service and active touch
exploration. Original secure settings are restored in `finally`. This validates
screen-reader reachability/activation, without claiming recorded speech or audio.

## Evidence and checks

The [29 native reports](./evidence/android-drop-stage3/android34.json) passed in one
process: ten drags, six drop handoffs, three non-drag commands and 20 native GC
cycles. [Environment](./evidence/android-drop-stage3/environment.json),
[source hashes](./evidence/android-drop-stage3/sources.json),
[TalkBack node snapshots](./evidence/android-drop-stage3/talkback-tree.json) and
[restored accessibility settings](./evidence/android-drop-stage3/accessibility.json)
identify the run. TalkBack was version 14.2.0.618048417.

The [actual application video](../docs/public/media/android-drag-drop.mp4) covers all
checks from the ready screen through final disposal, including TalkBack focus and
activation. The 72.91-second video retains all 1299 recorded frames and their
timestamps, with a lossless H.264 remux; see [video metadata](./evidence/android-drop-stage3/video.json).

Automated validation: 927 tests pass, with 10 existing skips; root and Android
fixture typechecks pass. Fifteen new mocked native-boundary tests cover metadata-only
hover, local ownership, multiple/MIME rejection, URI/Intent refusal without coercion,
size/count limits, repeated delivery ids, async receiver failure and teardown.
Mock results supplement the native evidence; they do not establish native gestures.
Package/Android builds, formatting, locale parity and documentation build pass.
Browser checks pass for all four localized guides: responsive width, language links,
search, anchors, poster/video playback and reduced motion. The general docs
experience checks also pass.

## Boundaries

Android API 24+ is required for this optional bridge; the recorded acceptance covers
API 34 only. Always provide ordinary labeled button/keyboard commands, including
when a native gesture cannot be installed. Same-Activity copy/open has no destructive
move transaction. Local-state origin is diagnostic context, not authorization.

#181 remains open for the broader iPad/Stage Manager, physical-device/VoiceOver,
sidebar and window-creation-by-drag work. This stage does not add authentication UI,
claim login resumption acceptance or validate other Android Activity/global/URI
transfer policies. iPad stage 1 and stage 2 evidence remains separately scoped.
