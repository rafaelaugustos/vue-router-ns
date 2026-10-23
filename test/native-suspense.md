# Native Suspense compatibility

Issue #119 is delivered as an experimental application composition, not a new
router component. Route records remain explicit or file-generated; the runtime
contract is identical. The routed Page stays synchronous and owns its ActionBar.
Only content below that Page participates in Vue Suspense.

## Renderer finding and chosen contract

The installed NativeScript-Vue 3.1.2 exports Vue's Suspense unchanged. Vue 3.5.44
calls its renderer's `createElement('div')` for the hidden pending container.
NativeScript-Vue forwards that call to `new NSVElement(type)`, whose registry
rejects the unregistered name. The same failure occurs even with synchronous
content, before any loader can help:

```ts
import { createApp, h, Suspense } from 'nativescript-vue'

createApp({
  render: () =>
    h(
      Suspense,
      {},
      {
        default: () => h('Label', { text: 'Probe' }),
      },
    ),
}).mount()
// Error: No known component for element div.
```

This is a renderer compatibility gap, not a router transaction failure. The
fixture runs this negative control on-device before registering anything.
The explicit workaround uses public APIs:

```ts
import { GridLayout } from '@nativescript/core'
import { getViewMeta, registerElement } from 'nativescript-vue'

registerElement('div', () => GridLayout, getViewMeta('GridLayout'))
```

Vue can then stage pending native content in an unattached GridLayout and move it
into the visible tree. There is no WebView, private renderer patch, custom
scheduler or router-owned Suspense wrapper. The registration is global to the app
and requires an unused name. It is opt-in; the ordinary router and demo do not
install it. It should be revisited when either runtime changes. Stock support
without this registration is **not** claimed.

The relevant upstream implementation is in NativeScript-Vue's
`src/renderer/nodeOps.ts` and Vue's `packages/runtime-core/src/components/Suspense.ts`.
The negative control above is a minimal reproduction for upstream investigation;
the example does not require an unpublished package or modification to dependencies.

## Versions and native results

Validated on 2026-10-23 with Core 9.1.3, NativeScript-Vue 3.1.2, Vue runtime-core
3.5.44 and compiler-sfc 3.5.44. The iOS runtime is 9.1.0; Android is 9.1.1.

| Check                                                  | iPhone 17 / iOS 26.0 simulator | Android 16 / API 36 emulator       |
| ------------------------------------------------------ | ------------------------------ | ---------------------------------- |
| Stock Suspense negative control                        | Expected `div` error           | Expected `div` error               |
| Native fallback and resolved branch                    | Passed                         | Passed                             |
| SFC top-level await, async setup, async component      | Passed                         | Passed                             |
| Nested suspensible boundary and Deferred activation    | Passed                         | Passed                             |
| Captured async error and explicit retry                | Passed; same Page/ActionBar    | Passed; same Page/ActionBar        |
| Plain refetch vs keyed content replacement and timeout | Passed                         | Passed                             |
| Repeated reloads while pending                         | Superseded children discarded  | Superseded children discarded      |
| Shared cache and covered-page resolution               | Passed                         | Passed                             |
| Independent tab stacks                                 | Passed                         | Passed                             |
| Cancelled then committed native Back                   | XCTest continuous edge input   | UiAutomation continuous edge input |
| Pending native modal dismissal and late response       | UIKit drag dismissal           | System Back                        |

The runner checks Page, ActionBar and heading identity; native history; rendered
native labels; boundary events; loader states; component scope disposal; and HTTP
request counts. No error escaped the parent error boundary. Both full native runs
ended on `/product/tab-a` with the modal consumer disposed before its response.
The final reports contain 71 snapshots on iOS and 70 on Android. Each records one
shared request and three requests for the intentionally invalidated rapid-retry
case, with the two superseded consumers discarded. All three XCTest gesture cases
passed; the Android input driver reported successful cancellation and completion.

The existing regression suite passed with 597 tests and 10 skips, without type
errors. Root/demo typechecks, native builds, formatting and the documentation build
also passed. The router's public API and runtime implementation are unchanged.

The CI timing failure was also reproduced on an iPhone 16 / iOS 18.6 simulator:
holding the original fetch response turned the pending fallback into a network
error after about 60 seconds. With the explicit fixture timeout, the same request
remained pending beyond 80 seconds and rendered its content when released. The
full iOS 18.6 suite then passed all three gestures using a fresh XCTest build.
The startup-readiness check was also validated with a disposable iOS test build
that delays JavaScript startup by 6.5 seconds: its first command response arrived
after 8 seconds, and the complete Suspense and gesture suite passed.

Focus evaluation is limited to a stable accessible heading outside Suspense and
the existing `useNavigationFocus` lifecycle. This is not a manual VoiceOver or
TalkBack audit. The recipe adds no animations and leaves native motion policy to
the router; it does not introduce React's concurrent rendering or transitions.
Page size and identity remain stable through resolution; device safe-area handling
continues to belong to that same native Page.

## Reproduce

Use dedicated test devices: the fixture shares the demo's
`org.nativescript.vuerouterns` app ID, restarts it, and clears its Android app data.
Install dependencies and scaffold `demo/App_Resources` as for the ordinary demo.
From the repository root:

```sh
npm run build
python3 scripts/native/loaders/prepare.py
node scripts/native/contracts/prepare.mjs
```

The first preparation enables the local HTTP test endpoint; its cleartext setting
is fixture-only. The second enables Android's native Back callback. For iOS:

```sh
export IOS_SIMULATOR='dedicated-simulator-udid'
(cd demo && ns build ios --for-device false --env.suspenseTest)
xcrun simctl install "$IOS_SIMULATOR" demo/platforms/ios/build/Debug-iphonesimulator/demo.app
ruby scripts/native/suspense/project.rb /tmp/router-suspense-tests
GESTURES=1 node scripts/native/suspense/run.mjs
```

For Android, in a terminal without `IOS_SIMULATOR` set:

```sh
export ANDROID_SERIAL='dedicated-emulator-serial'
(cd demo && ns build android --env.suspenseTest)
adb -s "$ANDROID_SERIAL" install -r demo/platforms/android/app/build/outputs/apk/debug/app-debug.apk
node scripts/native/contracts/build-touch.mjs
adb -s "$ANDROID_SERIAL" install -r /tmp/router-contract-touch/touch.apk
adb -s "$ANDROID_SERIAL" shell cmd overlay enable-exclusive --category com.android.internal.systemui.navbar.gestural
GESTURES=1 node scripts/native/suspense/run.mjs
```

The Android gesture tests require gesture navigation. If an older test-driver APK
has a different local signing key, uninstall only `org.nativescript.contracttouch`
before installing the new driver. The driver uses public UiAutomation input; it
does not restart or instrument the NativeScript app's process. The iOS reversing
gesture reuses the existing XCTest-only `ContractTouch` helper; no test-only/private
input API ships in the router or app.

Set exactly one device variable. The runner controls and closes the HTTP server
from the loader fixture, and sets/removes Android reverse forwarding. `GESTURES=1`
adds the native input cases; omitting it runs content and imperative navigation
coverage only. `SUSPENSE_UI_PROJECT` changes the generated XCTest project directory.
`OUT` changes the evidence directory; use a fresh directory when repeating XCTest,
because Xcode does not overwrite an existing result bundle.

The iOS runner builds XCTest before starting the HTTP server, then uses
`test-without-building` for each gesture. The fixture uses NativeScript `Http`
with an explicit 420-second request timeout: a response held across the cancel
and commit cases must outlive both 180-second XCTest process limits. The native
default request timeout can otherwise replace the fallback with a network error
while CI starts XCTest. This is only a test transport setting; the runner still
controls response release and asserts the pending state before both gestures.
Failed XCTest output, a final loader snapshot, and a failure screenshot are
retained so network errors are visible alongside the failed native assertion.
Startup waits up to 30 seconds for the fixture's command bridge file instead of
assuming the app has initialized after a fixed sleep. Command IDs are unique to
each run so a retained result from a previous launch cannot satisfy a new command.

`RECORD=1` records the pending/success/error/retry segment, then continues the
remaining assertions without recording. Reports, screenshots and gesture logs are
written to `scripts/native/out/suspense-<platform>`. Both native CI lanes run the
full gesture suite and retain that directory as artifacts.

For interactive use, start `node scripts/native/loaders/server.mjs`, forward port
18818 on Android, and run the demo with `--env.suspenseTest`. The product request
is delayed, and the first request for `error` fails. The page's Retry and Reload
content buttons keep the native Page while explicitly remounting the async child.

## Scope

Supported here: a stable Page with native fallback/content, route-loader reuse,
explicit errors/retry, nested boundaries, Deferred, tab stacks and modals on the
listed versions. A boundary around RouterView cannot cross separate native page
apps. Async Page roots, automatic route-wide boundaries, Teleport, Transition and
KeepAlive combinations, SSR, and preservation of arbitrary native-only state
inside replaced content are outside this recipe. A disposed async function may
still execute application side effects; the loader prevents stale publication,
and the example checks attempt identity before consuming a result.

See the [English guide](../docs/guide/suspense.md) and
[Portuguese guide](../docs/pt-BR/guide/suspense.md) for the copyable composition and
native recordings. Media is encoded with `scripts/media/encode.mjs`; no browser
rendering or simulated UI is used in the clips. The actual final frame is held for
two seconds for readability (`ffmpeg -vf tpad=stop_mode=clone:stop_duration=2` before
encoding); the native transitions retain their original playback speed.
