# Documentation learning path acceptance

The documentation is organized around starting an app, understanding page/stack ownership, choosing containers, adding native capabilities and finding a reference. Existing guide URLs remain available. The new first-app tutorial embeds the same seven files from `demo/src/tutorial` in English and Portuguese; there is no separate hand-maintained code copy in either guide.

## Site checks

- The EN/pt-BR documentation builds, including all source inclusions.
- All 94 generated HTML pages were inspected for internal link targets and anchors, with no broken targets. Existing guide paths and the main renamed introductory section anchors are retained.
- Chromium exercised both locales: home → first app, seven source inclusions, native-video loading/playback, gallery platform filtering by keyboard, combined search, empty-state recovery, all ten poster images and card destinations, and all five stack-model states.
- Layout checks cover 320px, 390px and 768px widths for home, gallery, model, first app, installation and recipes. No page-level horizontal overflow. Desktop light and dark presentations were reviewed at 1440px.
- Reduced-motion emulation leaves the home video paused; explicit playback remains available. The five-step stack diagram is labeled as a conceptual model, not a native simulator.
- Gallery filters describe the recorded platform, not feature parity. Native videos retain platform/version captions; the browser diagnostics recording identifies synthetic teaching reports.
- The home uses an excerpt of the existing Fieldnotes recording with simulator startup removed. The original complete video and its acceptance checksum remain unchanged; its poster now shows the application.

## Executable first app

Build the package, follow the checkout/native-resource setup in `docs/guide/native-showcase.md`, then run from `demo`:

```sh
npm run tutorial:ios
npm run tutorial:android
```

The opt-in `--env.tutorial` entry shares the existing demo application ID and replaces the installed demo. It does not add acceptance polling or change the default app. Selecting multiple demo/fixture entries is rejected.

Baseline: Core 9.1.3, NativeScript-Vue 3.1.2, iOS runtime 9.1.0, Android runtime 9.1.1. Package build and demo TypeScript checks pass. Both native builds succeed.

Native input acceptance was run with XCTest on iOS 26.0 and adb/UIAutomator on Android 16/API 36. In both:

1. Type `coast` into the list query; the other note is absent.
2. Open the note and its native modal editor.
3. Edit through the real keyboard, cancel and choose **Keep editing**; the draft remains.
4. Save; the original detail receives and displays the edited string.
5. Use native Back; the original query and filtered list remain.
6. Edit again, cancel and choose **Discard**; the previously saved text stays unchanged.

The iOS recording in `docs/public/media/first-app.mp4` comes from that native run; simulator startup is trimmed. These checks cover the tutorial flow on the listed devices. They do not certify spoken VoiceOver/TalkBack behavior or add persistence to its in-memory notes.

The package's existing suite also passes: 641 tests, 10 existing skips. No runtime library API, release workflow or deployment destination is changed by this documentation work.
