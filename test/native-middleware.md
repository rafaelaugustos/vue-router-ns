# Native middleware and helper acceptance — 2026-10-19

Follow-up for [#91](https://github.com/rafaelaugustos/vue-router-ns/issues/91), using the opt-in `demo/src/testing/middleware-app.ts` fixture. NativeScript-Vue 3.1.2; NativeScript Core 9.1.3; Android runtime 9.1.1 and iOS runtime 9.1.0. This validates the unreleased APIs on native runtimes, independently of the Frame shim.

| Environment                                     | Result                                                                                                                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android API 36 arm64 emulator (`emulator-5554`) | All 15 fixture checks passed. System Back refused while dirty, then returned to the retained login page after allowing.                                                       |
| iPhone 17 simulator, iOS 26.0                   | All 15 fixture checks passed. The actual UIKit ActionBar Back button refused while dirty; after tapping Allow leaving, it returned to login without changing the other stack. |

The fixture uses the public router APIs, native Pages/Frames, two independent `RouterView` stacks and native modal presentation. It does not patch router or platform methods, use a second route engine, or load Nuxt/Vue Router.

## Checks on both platforms

1. Authentication middleware referenced twice redirects once, after `beforeEach` and global middleware, with the expected phases on the redirected destination.
2. The redirect retains `/ → /login` and records `/account` as `redirectedFrom`.
3. An asynchronous middleware refusal leaves history unchanged and never mounts the rejected page.
4. A thrown middleware error rejects and reaches `onError` once, without mounting its destination.
5. A helper captured by a covered page navigates its original stack while another stack has focus.
6. Actual native Frame back-stack lengths match the router stacks after those helper operations.
7. Covered pages keep their original entry routes.
8. Two forced visits to the same path have separate page contexts.
9. A helper from the popped entry rejects and does not change another stack.
10. An asynchronous leave guard refuses router Back from a helper-created page.
11. Helper navigation to a modal settles at native presentation.
12. Refusing the modal leave guard retains its presentation.
13. `pushForResult` remains pending while a modal is open.
14. Closing the modal with a result delivers that value.
15. The standalone helper forwards an explicit target frame and replace operation.

Both runtimes emitted `MIDDLEWARE_RESULT {"ok":true,...}` with all 15 named checks. Android records the JSON and runtime log under `scripts/native/out/middleware`; iOS emits through the simulator's unified log. The final UI showed 15 checks passed on both native stacks.

## Reproduce

Build the router, then build and install the fixture on a test emulator:

```sh
npm run build
cd demo
ns build android --env.middlewareTest
adb -s <serial> install -r platforms/android/app/build/outputs/apk/debug/app-debug.apk
cd ..
ANDROID_SERIAL=<serial> npm run test:native:middleware
```

The runner launches the fixture, validates its report, presses system Back, verifies refusal, taps Allow leaving, and presses Back again. Screenshots record both outcomes. It waits for Activity launch completion before polling the report. The Native CI workflow builds and runs this fixture after the normal demo and drawer suites.

For iOS, build `ns build ios --emulator --env.middlewareTest`, install on a simulator and launch `org.nativescript.vuerouterns`. Read the `MIDDLEWARE_RESULT` unified log entry. Once the guarded page appears, tap the left ActionBar Back button: the page must remain. Tap Allow leaving, then the same native Back button: `/login` must appear in the left stack while `/item/9` remains in the right stack.

## Coverage limits

These are simulator/emulator results. No new physical-device, VoiceOver/TalkBack, rotation, process-death or interactive gesture-cancellation coverage is claimed here. The automated iOS fixture uses router-mediated Back/modal close; the UIKit ActionBar button was also driven through simulator UI automation. Interactive iOS modal drag and swipe-back cancellation were not repeated for this feature. Middleware retains existing global-guard/native-pop limits, documented in both guides; applications must use a leave guard to hold a native gesture for an asynchronous decision.

The 25 new runtime-shim tests additionally cover initial redirects, ordering relative to lazy loading and leave guards, inherited metadata overrides, collision/removal rules, router isolation, stack disposal, invalid external URLs and unsupported Nuxt options. Type tests cover inferred named destinations/params and middleware contracts. The full suite passed 356 tests with 8 existing skips and no type errors.
