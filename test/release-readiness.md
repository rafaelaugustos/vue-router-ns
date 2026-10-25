# 1.0 readiness review — 2026-10-25

## Decision

Do not publish 1.0 from this review. The remaining work is a dependency correction, an explicit compatibility commitment and acceptance of the final release artifact. Completing every roadmap feature is not a release gate. This change does not bump a version, promote experimental APIs or authorize publication.

Reviewed source: `d2a0731` (main, including PR #160), plus the documentation/localization changes in this PR. npm `latest` and `next` both resolve to `0.1.0-rc.3` at review time. The local packed artifact retains that version for validation; it is not a new published release.

## Public API

Inspected all eight `package.json#exports` keys: root, package metadata, file-routing, generator, setup, webpack, Vite and system-search. The root has 196 named value/type exports. The webpack entry uses a CommonJS export assignment; a named-exports-only inventory would incorrectly miss `NativeFileRoutesPlugin`.

The API guide lacked named references for `RouteMenuAction`, `SearchBarPlacement`, `UIKitSplitFrames`, `DrawerPresentation`, `ResolvedDrawerPresentation`, `parsePageMetadataJson` and `PageMetaTransform`. Those references are now present. This closes discoverability gaps, not a claim that every overload/default has an independent prose explanation.

The [readiness guide](../docs/guide/stable-readiness.md) proposes the 1.x contract: documented package exports and component contracts, defaults, failures/results, guard ordering, ownership/lifetime and supported native behavior. Before 1.0, the maintainer must decide which currently experimental exports receive that commitment and whether any need an explicitly versioned opt-in contract. An experimental label alone must not become permission to break an existing root export in a minor release. No runtime API changes are made here.

## Compatibility and checks

- `npm run typecheck`: passed.
- `npm test`: 51 files passed; 648 tests passed, 10 skipped. The sandbox run could not open loopback servers/watchers; the complete rerun with those permissions passed. Skipped tests are not counted as native acceptance.
- `npm run build` and `npm pack`: passed. The packed artifact contains all declared runtime/type export targets.
- `node scripts/check-install.mjs <local tarball>`: passed with Node 20.19.4 / npm 10.8.2 for explicit routes, webpack and Vite. Each scenario installed, reinstalled with `npm ci`, inspected exports and dependency resolution; both optional tooling integrations generated routes. Vite/npm 10 uses the existing example lockfile because its upstream optional-peer resolver has a documented limitation.
- `npm run docs:check` and `npm run docs:build`: passed for 188 pages, local links/anchors, shared code and imported snippets, UI dictionary parity, standalone viewer typecheck and VitePress production output.
- Browser checks: all four homepages and tutorials, localized search (including Chinese word queries), gallery filters, interactive stack steps, 320/390px layouts, guide/anchor-preserving language switching and viewer language changes retaining loaded reports passed. No page errors or missing local resources were observed. The PR video is a real browser recording of these delivered interfaces.
- This is one local install matrix row. It does not replace the release workflow's Node/npm combinations or the full native suites on the final release commit.

No native runtime code changes in this PR. Previous native evidence remains revision-specific: [#139 investigation](./native-inherited-direction.md), [published rc.3 consumer](./native-rc3-consumer.md), [native contracts](./native-contracts.md) and [accessibility](./native-accessibility.md). This review does not claim a new physical-device, speech, performance or complete native-matrix pass.

## Documentation and languages

English, Brazilian Portuguese, Spanish and Simplified Chinese have the same 46 guide routes and homepage. Spanish/Chinese preserve executable examples, inline API names and English anchor IDs, so existing deep links and language switching remain meaningful. The gallery, interactive stack model, home page, version/footer text and standalone diagnostics viewer have localized UI. Example applications and recorded native videos keep their original English labels.

Translations started from machine-assisted drafts. Technical review corrected navigation terminology, protected API/code examples, markup and the learning/release paths. This is not independent native-speaker certification. The [locale maintenance instructions](../docs/TRANSLATING.md) explain how to update translations and check coverage. Structural checks cannot prove semantic translation quality.

## Actual remaining release work

1. **#139 / NativeScript #11587:** released Core 9.1.3 still has the premature controller-view loading defect. PR #160 records isolated native validation of the proposed Core fix; it does not publish that fix. Adopt a corrected published Core, update the dependency and rerun consumer/native acceptance, or explicitly narrow the affected supported composition. An unpublished patch is not evidence for the npm dependency users receive.
2. **1.x API commitment:** approve the documented scope and disposition of experimental exports. Document migrations before freezing any incompatible correction.
3. **Final release artifact:** select a commit, run the full CI/native and fresh-install gates against it, record the exact dependencies and carry known limits into release notes. #152's physical VoiceOver evidence and accepted emulator-only TalkBack coverage remain bounded by their report; Android hardware absence is not silently treated as a physical-device pass.
4. **Publication decision:** maintainer approves the version and remaining documented limitations. A stable 0.1.0 and a 1.0 compatibility commitment are separate decisions.

Adaptive navigation and the offline diagnostics viewer already have scoped deliveries. Continuous UIKit progress, a Jolt adapter, live diagnostics transport and other future features do not block a stable release solely because they could be useful.

## Reproducing the documentation checks

```sh
npm run docs:build
# Optional Playwright tooling; not a package/runtime dependency.
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  RECORD=1 node scripts/docs/check-locales.mjs
```

Browser results, screenshots and the optional recording are written to ignored `scripts/docs/out/`. Diagnostics payload values, identifiers and example capture names remain unchanged across languages. Parser errors retain their original technical details.
