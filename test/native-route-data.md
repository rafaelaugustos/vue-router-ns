# Native route data acceptance

Issue #118 adds experimental, non-blocking route data loading. The fixture uses
published NativeScript Core 9.1.3, NativeScript-Vue 3.1.2 and the router built from
this checkout. Its product API is real HTTP on loopback; the driver holds each
response until the pending state has been asserted.

## Reproduce

Install the root and demo dependencies and provide the normal NativeScript
`demo/App_Resources` scaffold as described in [the demo README](../demo/README.md).
Run these commands from the repository root:

```sh
export IOS_SIMULATOR='dedicated-simulator-udid'
npm run build
python3 scripts/native/loaders/prepare.py
(cd demo && ns build ios --for-device false --env.loadersTest)
xcrun simctl install "$IOS_SIMULATOR" demo/platforms/ios/build/Debug-iphonesimulator/demo.app
RECORD=1 node scripts/native/loaders/run.mjs
```

For Android, in a separate terminal without `IOS_SIMULATOR` set:

```sh
export ANDROID_SERIAL='dedicated-emulator-serial'
(cd demo && ns build android --env.loadersTest)
adb -s "$ANDROID_SERIAL" install -r demo/platforms/android/app/build/outputs/apk/debug/app-debug.apk
RECORD=1 node scripts/native/loaders/run.mjs
```

The runner requires exactly one device
variable, starts/stops its own HTTP server, and sets/removes Android port forwarding.
It restarts the fixture app and clears its Android app data. Use a dedicated test
device: the fixture shares the normal demo's `org.nativescript.vuerouterns` app ID.
`RECORD=1` is optional. Reports and screenshots are written under
`scripts/native/out/loaders-ios` or `loaders-<serial>`; `OUT` overrides that directory.

`prepare.py` enables local HTTP for this fixture in the ignored native resources.
Do not copy its Android cleartext setting into a production app. It does not alter
the router or require a custom native runtime.

For interactive use, run `node scripts/native/loaders/server.mjs` in one terminal
and launch the fixture with `ns run ios --env.loadersTest` or
`ns run android --env.loadersTest` from `demo/`. Android also needs
`adb -s <serial> reverse tcp:18818 tcp:18818`. The server delays responses and fails
the first request for product `error`, so the Retry button can be tried manually.

## Assertions

- Opening a product presents a native Page while HTTP is still pending.
- Opening a second copy creates another Page and history entry but reuses the
  application's request. Both entries receive the same response.
- Back reveals the original Page and its data without another HTTP request.
- HTTP failure becomes page error state. Retry keeps the Page identity and native
  history, then succeeds on the second request.
- Returning while HTTP is pending cancels publication; a late response cannot
  change the current route or populate the disposed entry.
- A refused authorization guard sends no request for the protected product.
- `router.openLink()` enters the same loader path and reuses the application cache.
- Closing a pending modal discards its late result and retains the underlying Page.

The iOS runner uses router Back and modal dismissal. Android additionally uses the
system Back key for the pending request. This is not an interactive gesture or OS
URL-delivery test; the separate native navigation suites cover those mechanisms.
The fixture does not claim a visual Suspense boundary or network cancellation:
requests belong to the application cache and may continue after one consumer leaves.

Unit tests additionally cover guard/redirect ordering, lazy import failures,
superseded navigation, sync/async data errors, out-of-order reloads, named and parent
loaders, independent tabs/routers, restored entries, native presentation failure,
native pop disposal, and result type inference.

## Validation on 2026-10-23

| Environment                                                        | Result                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| iPhone 17 simulator, iOS 26.0, NativeScript iOS 9.1.0              | Fresh native build and complete HTTP flow passed.                          |
| Dedicated Android 16 / API 36 emulator, NativeScript Android 9.1.1 | Fresh APK and complete HTTP flow passed, including system Back.            |
| Unit and type suite                                                | 597 passed, 10 skipped; no type errors.                                    |
| Builds and documentation                                           | Router build, root/demo typechecks, formatting and VitePress build passed. |

Both native reports ended on `/products/42` with the modal entry cancelled and
without late modal data. Request counts were `42: 1`, `error: 2`, `slow: 1`,
`modal: 1`; the guarded product was never requested. Page identity and history
assertions passed for retry and return to the first product entry. These runs
produced the committed MP4/poster pairs.

## CI and recordings

The iOS HTTP flow runs in `native-contracts.yml`; Android runs in `native.yml`.
Both retain the JSON reports and screenshots as normal native-suite artifacts.
The [English](../docs/guide/data-loading.md) and
[Portuguese](../docs/pt-BR/guide/data-loading.md) guides embed the recorded flows.

To regenerate the media, copy each runner's `demo.mp4` to a platform-prefixed name
outside `docs/public/media`, then run:

```sh
node scripts/media/encode.mjs /tmp/ios-loaders.mp4 /tmp/android-loaders.mp4
npm run docs:build
```

Recordings show native presentation, pending/success/error states, retry and Back
at normal speed. Review both the transition and the final screen after encoding.
