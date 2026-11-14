# Android navigation intents — #182 stage 6

Validated on 2026-11-13 from PR202 merge `6a59c98` plus this implementation.
[Source hashes](./evidence/android-intents-stage6/sources.json) identify the adapter,
fixture, tests, driver and video. This completes #182's supported transport
acceptance; the package runtime and existing link APIs are unchanged.

The [app-owned Android recipe](../examples/intent-entrypoints/android.md) adapts
ACTION_VIEW URLs, router launcher shortcuts and an explicit notification-open
action. It validates the extracted destination immediately and hands canonical
data to the explicitly registered receiving router after readiness. Account,
delivery id, window, Frame and history policy come from the app. Notifications
cannot inject that authority. Automatic legacy links are disabled in the fixture.

## Native evidence

Published Core 9.1.4, NativeScript-Vue 3.1.3 and Android runtime 9.1.1 on a dedicated
Pixel 7 API 34 Google APIs ARM64 emulator, with Java 17 and no dependency patches.
See the [environment](./evidence/android-intents-stage6/environment.json) and
[31 native reports](./evidence/android-intents-stage6/android34.json).

- A real ACTION_VIEW URL starts a signed-out process before router readiness.
  Tapping the actual sign-in button resumes through the normal guard and removes
  login from the target history.
- The app publishes a dynamic launcher shortcut targeting a named route, changes
  the route's path without republishing, then the driver long-presses the real app
  icon and taps the shortcut. It resolves `/articles/7` and navigates normally.
- Replaying that captured request returns `repeat`. Another actual shortcut tap
  gets a fresh delivery id and the ordinary duplicated-navigation outcome.
- After force-stop, tapping the launcher shortcut starts a second signed-out
  process. Exactly one initial receipt reaches login, then resumes once.
- The driver grants notification permission in the actual system prompt. Posting
  a local notification does not navigate; tapping its drawer entry delivers the
  immutable Activity PendingIntent. Warm and terminated-process taps both use
  the same intent contract. The cold case uses `am kill` after Home, asserts the
  old PID is gone, then taps the surviving notification into a third process.
- Real notifications with malformed JSON, expired deadlines, unknown versions
  and removed destinations yield `invalid`, `expired`, `version` and `unmatched`
  without changing either history. A warm native URL reaches the same destination.
- Internal/notification resolution comparisons are app controls, distinct from
  actual notification taps. Recents returns to the visible app without another
  delivery or history mutation. Removing the named route makes its existing
  launcher shortcut return `unmatched`. Cleanup removes the dynamic shortcut and
  ingress listeners.

Reports assert three distinct process markers, one initial callback per process,
normal guard execution and matching native/logical histories. The fixture checks
the exact source Page and unsent draft within each process. It uses controlled
authentication, no identity provider, credentials or persisted pending login.

[Actual native video](../docs/public/media/android-intents.mp4) shows launcher menus,
notification drawer taps, system permission, login/resume and the retained draft.
The 138.81-second video preserves all 1,329 source frames and their relative
timestamps through a lossless H.264 remux, without cuts or speed changes. Its final
frame shows `PASS clear`. Full native logs, launcher hierarchy and original video
remain in ignored `scripts/native/out/androidintents182-verified/`. See
[video metadata](./evidence/android-intents-stage6/video.json) and the
[reproduction driver](../scripts/native/android-intents/README.md).

## Lifecycle finding and validation

The first native attempt opened the app but delivered no cold request: Core 9.1.4's
legacy launch event omits `window`. The adapter now carries the exact receiving
window from Core's immediately preceding synthetic new-intent, matching the same
native Intent object. The temporary reference expires at the next microtask;
readiness waits retain only canonical data. Tests now reproduce the actual missing
window field. A launch with another Intent or in a later turn cannot inherit it.
Saved-instance recreation and history-flagged launches do not replay old requests.
Those saved-state boundary cases are unit evidence; native Recents covers a live
Activity, not natural memory pressure or a full Activity-recreation matrix.

- **889 tests pass**, with 10 existing skips. Eighteen adapter cases cover cold
  ordering, exact native identity, guards, equivalent transports, named-route
  changes, malformed/oversized input, injected policy, expiry/version/removal,
  login/replay/new taps, account/registry replacement, closure/disposal and bounded
  readiness waits.
- Runtime/fixture typechecks, package/native builds, driver syntax and formatting
  pass. No package runtime changed; packed-consumer checks from earlier stages
  are not rerun or claimed here.
- Four-locale guide parity/build and browser checks cover the anchor, language
  links, narrow layout, search, video playback and reduced motion. The existing
  documentation browser suite also passes.

## #182 acceptance map

| Issue criterion                                                    | Delivered evidence                                                                                                                                                                                 |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typed/versioned request, separate resolution, link compatibility   | [Stage 1](./native-navigation-intents-stage1.md), `src/intents.ts`, shared guarded executor in `src/router.ts`.                                                                                    |
| Normalization and explicit rejected/expired/unknown results        | Stages 1/3, iOS [stage 5](./native-scene-intents-stage5.md), Android stage 6. External data cannot supply application authority.                                                                   |
| Cold/warm ordering, readiness, dedup and intentional actions       | Stages 1/2/5/6; scoped bounded in-memory identities, new ids per actual tap and separate captured-request replay controls.                                                                         |
| Login, exactly-once resume and invalidation                        | [Stage 2](./native-intent-resume-stage2.md): cancellation, account change, expiry, supersession, removal, owner closure and async-guard admission checks; native sign-in/resume in stages 2/3/5/6. |
| Explicit reuse/focus/new-window and restored-history policy        | [Stage 4](./native-intent-window-policy-stage4.md): app registry/selection, actual iPad scene creation/activation, saved/fresh/reset histories, no global focus guess.                             |
| Conditional process-death persistence                              | Intentionally unsupported: pending handles remain in memory. New cold native actions are validated and authorized anew; no serialized Promise, credentials or automatic login restoration.         |
| Guards/failures/results/redaction and equivalent native transports | Stages 1/2 runtime regression tests; iOS URL, local notification, shortcut and Spotlight videos; Android URL/launcher/local-notification video; internal controls reach the same routes.           |

This closes the supported contract and optional integrations described by #182.
Drag/drop integration remains separate in #181. App Intents, push-provider SDKs,
physical devices, full Android multi-Activity/window lifecycle and release-wide
certification are not delivered by this issue. Stage 4's explicit scene-policy
evidence does not imply Android activation or background scene-close acceptance.

The Android fixture intentionally uses one single-task Activity. Apps choose their
own task/Back and notification PendingIntent policy. Cold handling requires the
standard launch bridge; custom window-content resolvers need separate integration.
The ingress queue allows 16
handoffs and 15 seconds for readiness; saturation drops new receipts. Disposal or
account replacement invalidates waiting work, not an already-running app handler,
committed navigation or login UI. The app owns those resources. A new delivery id
does not deduplicate arbitrary repeated OS callbacks. No draft or login persistence
across processes is asserted. Native URL delivery with an explicit component
proves routing, not verified HTTPS domain association.
