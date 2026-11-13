# Retained entry history — #178, stage 1

Source: `9fd4831fd2cb0830e4cae1b9e41ea28003ae8a57`, based on merged NativeHost
review `13718a9c0cefc1b56ce17cfed605856dd6bcee42`. This stage delivers the readonly
history model and exact entry navigation. The optional native Back history menu,
its labels, keyboard interaction and accessibility are a later reviewable stage.

## Behavior and identity

For `[/, /item, /between, /item, /last]`, `backTo('/item')` returns to the closest
matching route. `backToEntry(history.entries[1])` returns to the first occurrence,
retaining that Page and disposing everything above it through the existing Back
guard, native acknowledgement and result-settlement path.

`history` is reactive for the caller's scope. `getHistory({ frame })` reads another
named stack without changing selection. Snapshots contain frozen detached route
data and a scope identifying a live stack incarnation, with window metadata when
available. They have no Entry, Stack, router, component or native Page references.
Private projection caches use weak keys. Snapshot retention is not a native
garbage-collection measurement.

The live `scopeId`/`id` address differs from the persistent page-state `key`.
Restoration can preserve a key while reconstructing a new native object and live
address; `restored` marks reconstructed pages, including legacy path-only saves.
Closed/replaced scopes and removed entries cannot be selected by stale addresses.
Named stacks may be selected after focus changes; foreign routers/windows cannot.
An open modal confines selection to its top modal stack. Selecting a pinned root
keeps it pinned; selecting a modal root keeps its modal open.

Selection of the current top returns `duplicated`; unavailable addresses reject.
Guard refusal returns `aborted`. An asynchronous selection revalidates its exact
target and the top page whose leave guards ran: newer navigation, external native
pops or owner closure cancel it. A retained unloaded host can queue Back without
blocking an unrelated stack. Existing `stack`, `backTo`, `go`, `setStack`, restore
format and NativeHost version are unchanged.

## Native acceptance

Published Core **9.1.4**, NativeScript-Vue **3.1.3**, iOS runtime **9.1.0**; Xcode
**27.0 (27A266a)**, Apple silicon, **iPad Pro 13-inch (M4) simulator / iOS 18.6**.
No dependency or native navigation delegate was patched. The fixture imports
public router exports and renders two separate native Frames.

XCTest passed in **27.115 seconds**, zero failures. All **eight application
reports passed**; [structured native evidence](./evidence/entry-history-stage1/ios.json)
retains scope/entry addresses, native Page identifiers, result deliveries, Vue
setup/unmount pairs and measured gesture progress.

| Case                                 | Observed result                                                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicate paths                      | Distinct live addresses; five Inbox Pages and three Archive Pages match logical history.                                                                         |
| Refused selection                    | Guard aborts; native Page order and all pending results remain unchanged.                                                                                        |
| Exact selection with Archive focused | First Inbox duplicate keeps its native Page; all Archive Pages survive unchanged. Three removed results settle once; only the departing top receives `chosen`.   |
| Stale selection                      | Removed duplicate address rejects without selecting the surviving identical path.                                                                                |
| Reversed native swipe                | Measured UIKit progress, cancellation retains all Pages, entry addresses and pending result.                                                                     |
| Committed native swipe               | Measured UIKit progress, one result settlement and the original duplicate Page/address retained. Archive remains unchanged.                                      |
| Owner teardown                       | Both public histories disappear, old addresses reject and all nine destination apps have exactly one unmount. No Vue errors or diagnostic reconciliation issues. |

[Actual simulator recording](../docs/public/media/entry-history.mp4): **28.145
seconds**, original speed, H.264, 1032 × 1376. It shows the two stacks, refused and
successful exact selections, stale rejection, reversed/committed native gestures
and teardown. It begins on the simulator launcher; no UI or transition was
composited. The [repeatable fixture and driver](../scripts/native/history/README.md)
produce the recording and assertions together.

An investigative run is not counted as acceptance: pushing the gesture page
without animation caused the reversed touch path to complete Back. The accepted
fixture uses an animated push for that interactive gesture; its assertions still
require measured progress, unchanged identities and a pending result after
cancellation. The fixture retains Frame/Page references to compare identity, so
the final native-reference list does not prove collection after owner teardown.

## Contract checks and controls

**714 tests passed**, ten existing skips, across 56 files, with no type errors.
The 26 focused history cases cover immutable snapshots, duplicate selection,
stale/foreign addresses, guards, results, concurrency, native pops, unloaded hosts,
restore formats, modal boundaries and pinned roots. Additional tests cover real
router window ownership/reconnection/closure, tab selection, HMR identity and
readonly public types.

Two isolated mutation controls demonstrate that the tests distinguish the core
failure modes. Selecting the nearest matching path instead of the requested ID
fails the older-duplicate test. Removing guarded-top revalidation accepts an
outdated navigation after an external native pop and fails the cancellation test.
The [control summary](./evidence/entry-history-stage1/controls.json) records each
expected and observed outcome. These are deliberate mutations, not failures
claimed against the previous release, which did not expose this API.

Root/fixture types, build, package contents, formatting, native helper checks and
driver syntax passed. One full-suite run timed out in the existing webpack watch
test; its focused rerun and the final complete suite passed without changes to
that test or the file-routing implementation. Four-locale guide/API documentation
build and browser review passed, including corresponding language links, search,
phone-width layout, reduced motion and server-rendered navigation; see
[documentation evidence](./evidence/entry-history-stage1/documentation.json).

## Native Back controls and remaining scope

The source audit of published Core 9.1.4 found native UIKit navigation items in
`ui/frame/index.ios.js` and the Android navigation click listener in
`ui/action-bar/index.android.js`. Existing router leave-guard behavior also uses
`holdBackButton` in `src/ios.ts`. This stage changes none of those controls,
delegates or handlers. A later menu stage must inspect actual native menus and
their guard behavior before choosing labels, overrides or platform fallbacks;
these checks do not claim a menu implementation or native menu acceptance.

Native acceptance here is local iOS simulator acceptance. There is no new hosted
iOS success claim. Physical hardware, Android native gestures, process-death
execution, screen-reader interaction and repeated resource collection were not
validated in this stage. Contract restoration tests establish model semantics,
not preservation of popped native objects or browser-style forward history.

Issue #178 stays open for the menu stage. No merge or release is part of this PR.
