# Explicit authentication resumption — #182 stage 2

Validated on 2026-11-13 from PR198 merge `3873fe0` plus this stage's implementation.
The [source hashes](./evidence/intent-resume-stage2/sources.json) identify the runtime,
fixture, driver and recording. This completes the in-memory suspension/resumption
stage; #182 remains open for the remaining native transport coverage and policies.

`suspendIntent` retains one bounded request for an explicit app-owned login flow.
It reserves delivery identity without navigation and returns a handle with reactive
state, cancellation and idempotent resume. The app supplies a stable flow identity
and a synchronous permission check. Resume resolves the target again and uses the
existing native navigation path with admission checks through asynchronous guards,
component loading and guard redirects, including the redirected destination.

## Native evidence

Published Core 9.1.4, NativeScript-Vue 3.1.3 and iOS runtime 9.1.0 on a dedicated iPad
iOS 18.6 simulator, without dependency patches. See the
[environment](./evidence/intent-resume-stage2/environment.json) and
[nine native reports](./evidence/intent-resume-stage2/ios18.json).

- XCTest opens an actual OS URL. The normal link guard opens a native login Page;
  the app retains the original URL in its link listener.
- Tapping the login Page's sign-in control updates fixture authentication state and
  resumes once. The original destination replaces login in the target Frame.
- A repeated completion returns the same attempt without allocating another Page.
- Login cancellation, account change, expiry, a newer pending intent and destination
  removal invalidate stale requests. Sign-out during an asynchronous guard prevents
  presentation of its private destination.
- Every step checks native/logical histories and the source's exact native Page
  and unsent draft. No synthetic navigation callbacks or patched native methods
  drive the fixture.
- The unchanged stage 1 fixture also passed all 11 native regression reports:
  [retained results](./evidence/intent-resume-stage2/stage1-regression.json).

[Actual native video](../docs/public/media/intent-resume.mp4) shows the OS URL,
app-owned login, single resumption and the invalidation scenarios at original speed.
The 32.84-second H.264 clip at 1032 × 1376 preserves all 552 recorded frames. Authentication is
controlled fixture state; this is not evidence of an external authentication SDK or
real account credentials. Reproduce with the
[driver](../scripts/native/intent-resume/README.md). Full reports, XCTest results and
source recording remain under ignored `scripts/native/out/resume182-release/`.

## Validation

- **833 tests passed**, with 10 existing skips, including 21 new suspension tests.
  Coverage includes repeated and reentrant resume calls, delivery reservation,
  cancellation, supersession, account changes, expiry cleanup, generated-deadline
  byte bounds, URL re-resolution, missing destinations, target readiness, cold
  owner closure, asynchronous guards/lazy code, redirected permissions, ordinary
  guard failures/errors and diagnostic redaction.
- A negative control removed the resumed admission check. All six guard-race
  regressions failed (logout, revocation, cancellation, supersession, expiry and
  route removal). Restoring the check made them pass; assertions were not weakened.
- Runtime and fixture typechecks/builds, native helper shell checks and formatting
  passed. The final package installed and cleanly reinstalled in fresh no-bundler,
  webpack and Vite consumers on Node 22.23.3/npm 10.9.9, using the existing documented
  npm 10 lockfile setup for Vite.
- Four-locale documentation parity, links, anchors, shared examples and production
  build passed. Browser checks cover the new section, search, language links,
  narrow layout, actual video playback, reduced motion and the existing site suite.

## Boundaries

Scope identity is an app-owned object that stays stable through the intended login
and changes on sign-out/account changes. It is not inferred from an account string,
source label or provider delivery id. Applications must call cancellation when
login is dismissed and clean protected history when signing out. An unauthorized
resume leaves the request pending; an authorized attempt is shared forever by that
handle, including its error or guard refusal.

Only one pending login is retained per router, with at most five minutes of lifetime
and the existing JSON/pending-delivery bounds. Changed scope is checked on resume
and during admission; callers cancel explicitly for prompt cleanup. A guard that
never settles is not forcibly terminated. Already committed parents or native
transitions are not rolled back; invalidation blocks remaining admission. Once the
attempt settles, captured policy/session references and its timer are released.

No process-death persistence, new-window selection, automatic authentication SDK,
Android native validation, physical-device accessibility or full release matrix is
claimed. The generic link APIs remain compatible and their listeners remain
app-owned. Other transport adapters and any persistence proposal require their own
stage and evidence; there is no release or automatic merge in this PR.
