# Navigation intents — stage 1 (#182)

Validated on 2026-11-13 from the PR197 merge base `b78552f` plus this stage's
implementation. [Source hashes](./evidence/navigation-intents-stage1/sources.json)
identify the runtime, fixture, driver and published video used for this acceptance.
The package remains experimental; this stage does not close #182.

The new versioned, bounded JSON request supports route and URL destinations with
separate resolution and execution. Existing links and intents share the same
readiness and guarded navigation executor. The link APIs, listeners, native URL
delivery, launch deduplication and default legacy selection remain compatible.

## Native evidence

- Published Core 9.1.4, NativeScript-Vue 3.1.3 and iOS runtime 9.1.0 on a dedicated
  iPad simulator running iOS 18.6; no dependency patches. See the
  [recorded environment](./evidence/navigation-intents-stage1/environment.json).
- Eleven reports passed. The fixture compares actual Frame Page histories with
  retained logical history after every step and keeps the source stack at home.
  [Results](./evidence/navigation-intents-stage1/ios18.json) record window identity,
  source/target stack names and exact outcomes.
- XCTest taps controls for pure preview, named-route/URL navigation, repeated
  delivery, guard refusal, overlapping guard cancellation, wrong owner, expiry,
  removed route and modal presentation/disposal. It then opens a URL through the
  operating system to exercise the migrated legacy entrypoint.
- [Actual recording](../docs/public/media/navigation-intents.mp4): **33.43 seconds**,
  original speed, H.264 at 1032 × 1376. All 564 source frames are retained,
  including startup. No sequence was cut, sped up, reordered or recreated.
  The video shows both retained native Frames, guard and
  duplicate outcomes, a real modal and OS URL arrival. English fixture labels are
  explained by localized captions in the guide.
- Reproduce with the [native driver](../scripts/native/intents/README.md). Full local
  reports, XCTest result bundle and source video are retained under the ignored
  `scripts/native/out/intents182-final/` directory.

This establishes one-window/two-Frame behavior on that simulator. Separate-router
ownership, cold restoration and target-disposal cases below are unit evidence,
not physical multi-window or Stage Manager acceptance. A source label is app data;
the repeated-delivery test does not claim native notification SDK integration.

## Automated validation

- 812 tests passed, with 10 existing skips, including 16 new intent cases. Coverage
  includes immutable input copies during waits, JSON/UTF-8 bounds and hostile
  payloads, pure resolution, URL-policy parity, legacy listeners/delivery ids,
  guards/redirects/errors, modal results, overlapping cancellation, expiry/removal
  after waits, restored cold starts, owner closure, bounded pending/recent delivery
  retention, multiple router owners, explicit default-stack selection, target
  deadline and diagnostic redaction.
- One full run encountered an existing filesystem-watcher test timeout in
  `file-routing.spec.ts`; the unchanged focused test and the following full run
  passed. No timeout or assertion was weakened.
- Runtime/fixture typechecks and build passed. Native helper shell checks passed.
  The packed artifact installed and cleanly reinstalled into fresh no-bundler,
  webpack and Vite consumers with Node 22.23.3/npm 10.9.9. The existing npm 10 Vite
  check starts from its documented NativeScript example lockfile.
- Four-locale guide parity, links, anchors and shared examples passed. Production
  documentation build and browser validation cover the new section, local search,
  language links, narrow layouts, video playback and reduced motion.

## Contract boundaries

The receiving router is explicit. A window id is an ownership assertion; the API
does not select another window. New requests use the named target, a URL frame
policy, or the default stack. They retain the router's usual overlapping-request
cancellation rather than a FIFO navigation queue. Expiry is an admission deadline,
not cancellation of a navigation already in guards.

Delivery scope/id pairs are app-owned and bounded to this router's memory lifetime.
They do not prove an account identity or authorize access. Refused/invalidated
attempts remain deduplicated until eviction; intentional retries need a fresh id.
Existing guard and authorization responsibilities remain in force.

Authentication suspension/exactly-once resumption, account-change policy, persisted
requests, automatic new-window policy and other native transport adapters remain
later #182 stages. No Android native rerun, physical-device accessibility or full
release-matrix acceptance is claimed here.
