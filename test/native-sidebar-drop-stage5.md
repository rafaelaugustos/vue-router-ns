# Sidebar drop acceptance — #181 stage 5

This stage composes the existing optional UIKit drag/drop bridge and destination
policy with a permanent `RouterDrawer` and three retained `RouterTabs` stacks.
Inbox and Archive are independent receiving rows; the Library card remains in its
original Page. No router runtime, public export, host contract or mandatory native
dependency changes. See the [copyable recipe](../examples/drag-drop/sidebar.md) and
[fixture](../demo/src/testing/sidebardrop-app.ts).

## Native acceptance

The iOS 18.6 iPad Pro 13-inch M4 simulator ran the actual application in one window.
XCTest performs ten real long-press-and-drag gestures, asserting that each target
row is physically outside the source content. It also taps the ordinary Archive
button and sends Control–O to the page-owned command scope. It never invokes drag
delegates or router methods to emulate the gesture.

| Input                                    | Verified result                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Drop into Inbox, then Archive            | Same public document opens in each explicit receiving Frame; the first destination keeps its history. |
| Native hover                             | Highlight only; no provider load, tab selection or history change.                                    |
| New drag to existing document            | Fresh delivery identity, ordinary duplicated-navigation result, unchanged histories.                  |
| Captured-intent replay                   | Explicit repeated-delivery result; no second navigation.                                              |
| Cancel area or two native items          | No accepted transfer, provider load or navigation.                                                    |
| Remove row during hover                  | Actual interaction/policy disposed before release; highlight clears and native drag cancels.          |
| Dispose row during provider load         | Pending transfer cancelled; wait beyond original provider delay confirms no late navigation.          |
| Reassign receiving Frame while loading   | Owner-changed result; delivery never redirects to Archive.                                            |
| Revoke document permission while loading | Unauthorized result before guards; all histories and selection unchanged.                             |
| Refusing guard                           | Native transfer accepted; receiving tab revealed, navigation refused, histories unchanged.            |
| Sidebar button and Control–O             | Same policy with internal source and fresh action identity.                                           |

Every report checks all three exact root Pages, their independent drafts and
agreement between native and logical histories. Only the explicit receiving stack
may change; the source and other destination stay intact. Two forced JS collections
per drag verify that local session identity survives between native callbacks.
The final cleanup disposes each policy before its native interaction.

## Evidence and checks

All [26 native reports](./evidence/sidebar-drop-stage5/ios18.json) passed in one
process: ten drags, seven native drop deliveries, twenty forced GC cycles and two
internal commands. [Environment](./evidence/sidebar-drop-stage5/environment.json)
and [source hashes](./evidence/sidebar-drop-stage5/sources.json) identify the run.
The [actual application video](../docs/public/media/sidebar-drop.mp4) records the
full acceptance sequence, including launch, native previews, hover removal,
receiving tabs and the final document. All frames and timestamps are retained at
original speed in a lossless H.264 remux: 126.30 seconds and 3,606 frames; [video metadata](./evidence/sidebar-drop-stage5/video.json)
records duration, frame count and hashes. See [reproduction](../scripts/native/sidebar-drop/README.md).

**952 tests passed**, with ten existing skips. Six new composition cases exercise
per-row ownership with real router/tab behavior, retained roots, guard refusal,
row-specific disposal, owner/permission invalidation and delivery identity across
rows. The unchanged shared policy and UIKit bridge retain their earlier validation.
Package and iOS builds, root and focused fixture typechecks pass.
Formatting, four-locale parity and the documentation build pass. Browser checks
cover the sidebar anchors/search, actual video playback, responsive 320–1440px
layouts, reduced motion and server-rendered navigation without JavaScript.

## Boundaries

Rows bind to explicit registered Frames, never the global current Frame or a Frame
name supplied by the payload. Hover does not reveal a tab. Drop can reveal its
receiving tab before a guard refuses navigation. Accepted transfer, completed
navigation and destructive moves are separate; this recipe only copies/opens.
The application owns current permission checks, row lifetime and any authentication
flow. Removing a row does not remove its retained stack; this fixture deliberately
checks those existing Pages after interaction disposal.

This evidence establishes a permanent sidebar in one simulator window, with
same-process providers and controlled permission changes. Button labels and
keyboard delivery are verified; physical VoiceOver speech/focus acceptance is not.
It does not establish overlay edge reveal, adaptive layout transitions, Stage
Manager, physical iPad, external-app transfer or dragging to create a new window.
Earlier cross-window, Android and login reports keep their own scope. #181 remains
open for the remaining hardware/window-creation acceptance.
