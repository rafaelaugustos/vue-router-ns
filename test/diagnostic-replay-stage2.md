# Offline diagnostic replay — #180 stage 2

The viewer now imports both existing v1 reports and the v2 recordings delivered
in PR196. V1 keeps its final-snapshot behavior. V2 exposes play/pause, previous/next,
keyboard position selection and event-linked snapshots with synchronized logical
and native stacks. This stage changes the standalone browser tool and docs;
the native collector and published runtime are unchanged.

## Observational contract

Import uses bounded whitelist parsing. The 10 MiB file cap remains, while v2
also enforces its declared count/compact-byte budgets (at most 10,000 records
and 8 MiB). Malformed shapes, nonfinite/unsafe numbers and exceeded budgets are
rejected without replacing already loaded files. Unknown fields are discarded;
the validator does not attest a file's authenticity or that developer-supplied
strings contain no sensitive data.

Replay preserves recorded sequence order. Only an adjacent explicitly linked
checkpoint can supply state for an event; a paired timeline span selects its end
event. Missing endpoints retain the existing timeline semantics. No nearest-time
snapshot, inferred push/pop state, interpolation or state carried through a gap
is used. Prefix eviction, clear epochs, oversized/failed inspections, internal
sequence gaps and inconsistent retention metadata are explicit. Unordered,
duplicate-identity or mixed-epoch files expose unknown state and individual
ambiguous event points rather than fabricated spans. Later independently valid
checkpoints remain inspectable after missing-record gaps.

First-divergence analysis uses only comparable retained observations. Busy stacks
and pre-reconciliation checkpoints defer comparison. The first mismatch is linked
to the previous comparable observation where available; this bounds uncertainty
without claiming an exact onset, cause, or complete missing history. Analysis
covers the whole independent file rather than the current filter. Visibility,
entry activity, selected tabs, router destination and unknown OS input focus
remain distinct. Files are not merged by matching IDs.

Playback advances one observation per second, not at recorded native speed. It
starts only on request and pauses on import, file/filter/language changes, clear
or tab hiding. Navigation, guards, network requests and native restoration are
never executed. The standalone HTML remains self-contained, in-memory only and
protected by its no-network Content Security Policy.

## Validation

November 13, 2026: **796 tests pass**, **10 existing skips**, **65 files**.
Fifteen new replay model cases exercise all seven committed native v2 captures,
v1 preservation, native ordering/recovery, guard cancellation, modal identities,
collector-generated redirects, strict event links, clear/truncation, clock/epoch/
identity corruption, inert unknown fields, dangling links and byte/count budgets.

The existing v1 browser suite passes unchanged. The new browser driver passes
**ten acceptance groups** on Chromium **156.0.8078.4** with the browser offline:

- Real native mismatch/recovery and uncertainty bound; blocked/cancelled event
  selection updates the corresponding checkpoint.
- Modal lifetime, pre-reconciliation deferral and distinct observed state.
- Play/pause, keyboard steps/focus and import cancellation of playback.
- Actual native clear/truncation, independent captures and v1 compatibility.
- Explicitly synthetic reversed order/missing records, invalid-file preservation
  and imported HTML-like strings rendered as inert text.
- Four UI locales at 390 px, reduced motion, synthetic redirect parent selection,
  and 10,000 checkpoints without rendering the full history into the DOM.
- Clear/reload disposal, no browser persistence, no outbound requests or page errors.

[Machine-readable browser evidence](./evidence/diagnostic-replay-stage2/browser.json)
and the [repeatable acceptance/recording driver](../scripts/diagnostics-viewer/README.md#v2-offline-replay)
separate native provenance from synthetic fault injection. The synthetic redirect
case changes event relationships to exercise the viewer, and is not a native
redirect acceptance claim. Native observations come unchanged from the
[iOS 18.6 stage 1 captures](./native-diagnostic-recording-stage1.md), including
success, refused/cancelled guards, modal, actual unmanaged Page and recovery.
No new native app run, physical-device, Android, multi-window or HMR claim is made
for this browser-only stage.

Typecheck, runtime build, viewer build/typecheck, formatting, native UI helper
checks and the four-locale documentation build pass. Browser checks additionally
cover the affected localized guides, anchors, language links, search, narrow
layout, both video embeds and reduced-motion playback behavior.

## Video

[Actual offline viewer recording](../docs/public/media/diagnostic-replay.mp4),
**29.47 seconds**, H.264, **1440 × 1100**, original speed. It shows real native
capture import, mismatch and recovered stacks, refused/cancelled selection, modal
lifetime, pre-reconciliation deferral, play/pause, clear/truncated gaps, an explicitly
named **SYNTHETIC** damaged-order file, and the original v1 report. All interactions
run through the actual viewer controls; no interaction or state was composited.
The preceding stage's device timings are recorded data, not browser performance
measurements. Four-locale guides embed this video with localized provenance captions.
