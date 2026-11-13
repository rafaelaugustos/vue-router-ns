# Native scene intents — #182 stage 5

Validated on 2026-11-13 from PR201 merge `d5c7f5d` plus this implementation.
[Source hashes](./evidence/scene-intents-stage5/sources.json) identify the application
adapter, fixture, tests, driver and recording. This stage preserves the package
runtime and existing links/shortcut/search APIs. #182 remains open for the remaining
cross-platform acceptance review.

The [copyable application adapter](../examples/intent-entrypoints/README.md) takes
Core 9.1.4 scene events into the existing versioned intent contract. It keeps the
native receiving identity, an explicit account-owned registry and a bounded
readiness handoff. Automatic system links are disabled in participating routers.
Core forwards cold connection payloads through these same events; the adapter
does not also consume scene connection or process-wide delegate forwarding.

## Native evidence

Published Core 9.1.4, NativeScript-Vue 3.1.3 and iOS runtime 9.1.0 on the dedicated
iPad iOS 18.6 simulator, with Xcode 27.2 and no dependency patches. An independent
Swift Core Spotlight indexing probe completes before the app integration runs.
No availability skip is counted as acceptance. See the
[environment](./evidence/scene-intents-stage5/environment.json) and
[twenty reports](./evidence/scene-intents-stage5/ios18.json).

- XCTest publishes a real quick action, changes the named route's path without
  republishing, long-presses the SpringBoard icon and taps the action. Its native
  scene callback resolves the current route, suspends for app-owned login and
  resumes once through the ordinary guard.
- An app-level replay of that captured intent returns `repeat` without native
  mutation. A second actual shortcut tap receives a new delivery id and reaches
  the ordinary duplicated-navigation outcome.
- XCTest terminates the process and taps the quick action again. The next process
  receives one initial callback, starts signed out and resumes after login.
- The app indexes one explicitly selected public item, then XCTest terminates it
  again. Searching Spotlight and tapping the app's actual result delivers a native
  user activity into a third process and the same login/resume flow. The driver
  asserts three distinct process markers; no pending login survives a restart.
- A warm Spotlight tap reaches ordinary duplicate navigation. After the app's
  resolver revokes that content id, another actual result tap returns `unmatched`
  without changing either stack. A native custom-scheme URL reaches the same route.
- Internal and normalized notification requests resolve that route in app-level
  comparison controls. These are not native notification callbacks; actual local
  notification acceptance is recorded in [stage 3](./native-notification-intents-stage3.md).
- Removing the named destination makes its existing native quick action return
  `unmatched`. Cleanup removes this app-owned Spotlight domain, quick action and
  scene listeners.

Every report compares logical/native histories and retains the source's exact
Page and unsent draft within that process. The three login cases pass the normal
guard and replace login with `/articles/7`; rejected/repeated actions leave both
stacks unchanged. The fixture waits for both named native Frames before inspecting
or presenting login. Sign-in uses controlled state, without credentials or an
external identity provider.

[Actual native video](../docs/public/media/scene-intents.mp4) shows the system
quick-action menus, Spotlight result taps, login Pages and resumed destination.
The encoding preserves every source frame and relative presentation timestamp;
see [video metadata](./evidence/scene-intents-stage5/video.json). Reproduce with the
[driver](../scripts/native/intent-entries/README.md). Full XCTest results, reports
and source recording remain in ignored `scripts/native/out/entryintent182-final/`.

## Validation

- **871 tests passed**, with 10 existing skips. Eleven new ingress cases cover
  delivery before mounting, immediate native completion, ignoring legacy forwarding,
  equivalent transport resolution, normal guards, named-route changes, login and
  replay, fresh action identities, account/registry changes, closure, disposal,
  bounded waits and malformed/oversized URLs.
- Removing the post-readiness registration/account check produces two expected
  regression failures. Restoring the check passes without changing assertions.
  Native races are not fabricated; these controls use the unit native shims.
- Runtime and native fixture typechecks, package/native builds, driver syntax
  checks and formatting pass. The fixture checks built public declarations. No
  package runtime changed; packed-consumer checks are not rerun or claimed here.
- Four-locale docs parity/build and browser checks cover the new anchor, language
  links, narrow layout, search, video playback and reduced motion. The existing
  documentation browser suite also passes.

## Boundaries

This integration targets Core 9.1.4 scene forwarding, not the legacy application
delegate lifecycle. It installs one adapter per app and relies on an app-owned
registry to choose the router. The fixture uses an explicit primary-window policy;
it does not establish all multi-window lifecycle paths or select by global focus.
Only extracted destinations come from native payloads. Account, target, history
and action identities come from application policy; normal authorization remains
necessary.

The queue allows 16 receipts and a 15-second readiness wait. Native completion
acknowledges queueing rather than successful navigation. URL/activity callbacks
have no completion and are dropped at saturation. Stop or account replacement
invalidates pending handoffs, but cannot undo an application handler already
running, committed navigation or external login UI. Apps own those resources.

The adapter assigns an id per intentional scene action. It avoids known Core
forwarding duplication by listening to one path; it does not deduplicate arbitrary
OS callbacks assigned different ids. App replay and two distinct real taps are
separate controls. Spotlight rank/visibility is OS-owned, and successful indexing
is not a search-placement guarantee.

Android ingress, physical devices, background navigation, process-persistent login
or draft restoration, external authentication, full account cleanup and release-wide
acceptance remain outside this stage. Existing Android launcher acceptance is
documented separately in [the shortcut report](./native-shortcuts.md).
