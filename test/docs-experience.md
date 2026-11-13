# Documentation experience — 2026-11-13

The VitePress home and guides now share a green palette, larger type, clearer learning paths and motion from published `@rafaelaugusto/jolt@0.1.0-rc.15`. The design references are the [Jolt site](https://jolt.rafaelaugusto.dev/) and [Mavis experience](https://github.com/getcortexlabs/mavis-ui/tree/main/docs/.vitepress/theme/experience). The router keeps its own visual identity and native navigation APIs.

The home contains an explicitly labeled browser model: search a note, push its detail, open an editor, return a result and go Back with the search retained. This illustrates ownership; it is not a NativeScript runtime or evidence of a native gesture. The adjacent recordings remain actual native captures. Existing RC and experimental boundaries are linked and unchanged.

Jolt is a development dependency for documentation only. Its web entry loads after mount; each component disposes its runtime. The operating-system reduced-motion preference disables those animations and automatic video playback. There is no motion-preference control or Jolt credit in the site interface. The existing ecosystem links remain available.

## Verification

- Production site reviewed in Chromium at 320, 390, 768, 1024 and 1440 pixels; English, Portuguese, Spanish and Chinese home routes; light/dark home and guide views.
- The browser acceptance script checks push, retained search, modal results, Escape cancellation, local resource failures, page errors, clipping, reduced-motion behavior and server-rendered guide navigation without JavaScript. [Recorded results](./evidence/docs-experience/browser.json).
- 661 unit tests passed, with 10 existing skips. Root typecheck, package build, formatting, documentation build and the four-language link/code checks passed. The motion/copy TypeScript helpers were also checked directly.
- No native behavior changed. This documentation work adds no new native-device or performance acceptance claim.

Reproduce with `npm run docs:build`, then `npm run docs:preview -- --host 127.0.0.1 --port 4174` and `npm run docs:test`. Install the browser once with `npx playwright install chromium`. Restart the preview after rebuilding so its static-file index matches the current asset names. `DOCS_URL` and `DOCS_REVIEW_OUT` can override the local URL and artifact directory.

## Actual browser recording

[Watch the site](../docs/public/media/docs-experience.mp4). Recorded from the production preview in Chromium at 1280 × 850: Portuguese home entrance, search, detail, editor/result, retained search on Back, native clips, the guide's stack model and dark appearance. Playback timing is unchanged; the WebM capture was transcoded to H.264 without audio. [Opening frame](../docs/public/media/docs-experience.png).

Reproduce the recording with `node scripts/docs/review-experience.mjs --record` against the running production preview. Raw screenshots and recordings are written to the ignored `scripts/docs/out/experience/` directory.
