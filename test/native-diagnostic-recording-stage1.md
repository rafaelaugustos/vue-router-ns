# Diagnostic recording — #180 stage 1

The delivered stage adds an experimental, explicit v2 recording contract. The
existing v1 export and viewer remain unchanged. Full independent checkpoints
observe native/logical state at initialization, events, reconciliation boundaries,
manual checkpoints, clear and stop. They do not reconstruct state from operation
names. Events retain guard/navigation correlation IDs. Retention is bounded by
record count and compact UTF-8 bytes; prefix eviction, clear epochs, oversized
records and inspection failures preserve explicit missing-state information.

## Native acceptance

November 13, 2026: published Core **9.1.4**, NativeScript-Vue **3.1.3**, iOS runtime
**9.1.0**, Xcode **27.0 (27A266a)**, Apple-silicon Mac, dedicated **iPad Pro 13-inch
(M4), iOS 18.6** simulator. XCTest passed in **30.793 seconds**, with all **ten
application checks** and independent byte/count assertions passing.

The sequence observed initial state, successful native push, exact source Page
preserved by a refusing guard, a cancelled overlapping guard, modal/result
lifetime, an actual unmanaged native Page, recovery, prefix truncation, clear and
stop. Recovery has no current mismatch while the earlier unmanaged Page remains
in retained checkpoints. The stopped report stays unchanged while the app goes
back to root. This is actual native capture, not synthetic replay.

[Native measurements](./evidence/diagnostic-recording-stage1/ios18.json) and
[the recovery recording](./evidence/diagnostic-recording-stage1/recovery.json)
include the actual retained stream. Additional captures cover success, blocked,
cancelled, truncate, clear and stop; [v1.json](./evidence/diagnostic-recording-stage1/v1.json)
is the unchanged export for the existing viewer. Payload assertions reject the
fixture's private params/query/props/result values from recordings.

| Observation                        | Records retained | Record bytes | Compact export bytes | Dropped | Collector work, cumulative |
| ---------------------------------- | ---------------: | -----------: | -------------------: | ------: | -------------------------: |
| Initial routed page                |               33 |       13,958 |               14,308 |       0 |      3.066 ms / 18 samples |
| Successful push                    |               63 |       29,089 |               29,438 |       0 |      5.185 ms / 34 samples |
| Blocked guard                      |               79 |       37,601 |               37,951 |       0 |      5.713 ms / 42 samples |
| Overlapping cancellation           |              121 |       61,066 |               61,415 |       0 |      8.629 ms / 64 samples |
| Recovery                           |              160 |       97,294 |               97,646 |      32 |    15.755 ms / 103 samples |
| 180 additional manual observations |              160 |      134,415 |              134,769 |     212 |    25.396 ms / 283 samples |
| Clear                              |                2 |          926 |                1,278 |     212 |    25.590 ms / 284 samples |
| Stop                               |                3 |        1,765 |                2,118 |     212 |    25.683 ms / 285 samples |

The fixture uses a 160-record / 262,144-byte budget; clear discards 160 retained
records and advances the epoch. Maximum recorded collector sample: **0.991 ms**.
These measure synchronous recording work in this fixture, including native
inspection and serialization, excluding listeners/export/rendering. They are
not an off/on benchmark, a heap bound, FPS or physical-device performance claims.
Serialized record bytes are independently recomputed by the Node driver.

[Actual simulator video](../docs/public/media/diagnostic-recording.mp4): **32.03 s**,
original speed, H.264, **1032 × 1376**, showing launch and the actual control
sequence. No interaction was composited. The four-locale diagnostics guide embeds
the video with localized captions and explains its English labels. The
[repeatable driver](../scripts/native/recording/README.md) preserves raw capture,
XCTest output and application reports. The first fixture run failed because its
ActionBar was rendered by an unregistered string name; the corrected Vue component
rendering passed the full rerun. No collector workaround was needed.

## Contract checks and boundaries

Nine new runtime cases cover v1 importer compatibility/disabled inspection,
before/after native reconciliation and stable IDs, retained divergence after
recovery, overlapping guards/modal lifetime/redaction, distinct selection and
focus observations, count/UTF-8 byte limits/clear epochs, oversized Unicode and
failed inspections, frozen stop/released sources, and invalid capacities.
Readonly type coverage includes the separate v2 API. The complete suite passes
**781 tests**, with **10 existing skips** across **64 files**.

Typecheck, package build, formatting, native UI helper checks, native fixture
typecheck and four-locale docs build pass. The docs browser suite and eight
affected localized guide/API pages pass at narrow width, including anchors,
language links, search, actual video playback and reduced-motion behavior.
The viewer's browser acceptance passes; importing this run's actual v1 file
preserves the recovered stack and blocked-guard timeline. Importing v2 is
explicitly rejected as documented. Packed installs and clean reinstalls pass
for no bundler, webpack and Vite on Node 22.23.3 / npm 10.9.9.

Only checkpoint instants are observed. Between them, state is unobserved; there
is no interpolation. Tab membership/selected index can be sampled manually or
at another router boundary; there are no new native tab listeners. Host-local
visibility does not establish global screen visibility. Routing focus is not OS
input focus; unavailable values remain null. A busy or pre-reconciliation
checkpoint does not prove a settled fault. Any later analysis must identify
the first retained comparable observation or an uncertainty interval, never
invent an exact cause, synthesize missing state or join independent captures
by local identity alone.

The current viewer still imports **v1 only**. V2 import/corruption validation,
play/pause/step, synchronized event selection and first-divergence analysis are
the next reviewable stage of #180. This PR keeps #180 open. No live app mutation,
guards, network activity or restoration is performed by reading recordings.
Native acceptance here covers one iOS simulator, not Android, physical hardware,
multi-window/tab switching or HMR native acceptance. Tab/focus metadata and fault
injection are additionally exercised by shim contracts; that is separate evidence.
