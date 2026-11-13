# Maintaining documentation locales

The source guide set lives in `docs/guide/`. Brazilian Portuguese (`pt-BR`), Spanish (`es`) and Simplified Chinese (`zh-CN`) use the same filenames under their locale directory. Each locale also has its own homepage. Keep the language switcher on the corresponding guide; do not silently redirect an untranslated topic to the English homepage.

When changing a guide:

1. Update the corresponding translations, including headings, links, tables, captions and release/platform limits. Preserve API identifiers, URLs and executable code. Demo app labels and video recordings remain in their original language; explain that when giving step-by-step instructions.
2. For Spanish/Chinese headings, retain the explicit `{#english-anchor}` IDs so links and locale switches keep working. A translated heading can change without breaking a deep link. Existing Portuguese anchors have their own established links.
3. Keep imported tutorial snippets pointed at the same source files. A locale guide is one directory deeper than English, so its snippet paths start with `../../../demo/`.
4. Update navigation/search strings in `.vitepress/config.ts`. Shared gallery, stack-model and home feature strings use `.vitepress/theme/locale.ts`; add Spanish/Chinese entries to `.vitepress/locales/*-ui.ts`. The new site experience uses `word([English, Portuguese, Spanish, Chinese])` from `.vitepress/theme/experience/words.ts`; keep all four entries together. The standalone diagnostics viewer shares the existing dictionaries. Do not translate report JSON field names or API identifiers.
5. Run `npm run docs:check` and `npm run docs:build`. Serve that build with `npm run docs:preview -- --host 127.0.0.1 --port 4174`, then run `npm run docs:test` for the browser acceptance checks (Chromium installed with `npx playwright install chromium`). Check the affected guide, language switching, local search and a narrow viewport. Chinese search uses word segmentation during both indexing and querying.

`docs:check` checks route coverage, local guide links/anchors, shared Spanish/Chinese code blocks and inline code, unresolved translation placeholders and UI dictionary key parity. It does not prove that prose conveys the correct meaning. Portuguese examples predate this check and intentionally translate some comments and strings, so exact code parity is enforced only for the two new locales.

The viewer's replay controls keep their four translations together in `tools/diagnostics-viewer/replay-copy.ts`, in English/Portuguese/Spanish/Chinese order. Preserve all four entries when adding a message; raw report enum values and IDs remain untranslated evidence.

Use translation tools only for a draft. Review ownership, cancellation, guards, results, disposal, experimental boundaries and negations against the source. Never translate an API name into an invented identifier. Never turn an unverified platform limit into a compatibility promise. Report native-speaker review separately from technical review; neither automated structural checks nor machine translation substitutes for it.
