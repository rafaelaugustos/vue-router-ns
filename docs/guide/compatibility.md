# Stable scope and compatibility {#rc-scope-and-compatibility}

`0.1.0` is the stable release of the documented, non-experimental API. Explicit JavaScript/TypeScript route tables remain the default. File conventions are optional; both use native navigation, without a Vue Router or Nuxt runtime.

The 2026-11-13 [window lifecycle contract](./windows#lifecycle-support-decision-2026-11-13) selects published Core 9.1.4 / Vue 3.1.3 and retains experimental status. Repeated Android cleanup measurements do not certify physical Android devices, Stage Manager, live resizing or repeated iPad resource retention. See the versioned report linked from that guide before choosing a deployment scope.

A physical iPad Pro 11-inch (3rd generation), iPadOS 27.0 (24A5418b), also passed window isolation, background resume, HMR and closure in 31.9 seconds; this does not certify repeated iPad resource collection.

## Supported baseline

| Dependency         | Stable requirement                        | Acceptance baseline                                          |
| ------------------ | ----------------------------------------- | ------------------------------------------------------------ |
| NativeScript Core  | `^9.1.4`                                  | 9.1.4                                                        |
| NativeScript-Vue   | `^3.1.2`                                  | 3.1.3                                                        |
| Node.js            | `>=20.19.4`                               | Node 20.19.4 and 22.23.3 installation; Node 22 native builds |
| npm                | Compatible with the selected Node version | 10.8.2 and 11.21.1                                           |
| webpack (optional) | webpack 5, NativeScript webpack 5         | webpack 5.112.0 / NativeScript webpack 5.0.38                |
| Vite (optional)    | Vite 8, NativeScript Vite 8.0.20+         | Vite 8.3.4 / NativeScript Vite 8.0.20                        |

The RC narrows beta's Core `>=8.9.0` and NativeScript-Vue `^3.0.0` declarations to the validated baseline. Upgrade those dependencies before upgrading the router. A compatible version range is not a claim that every intervening dependency release has been tested.

Native CI covers Android API 34/35/36 and iOS/iPadOS 18.6 simulators. Additional iOS 26 runs and physical-device accessibility checks are recorded in the repository's [validation reports](https://github.com/rafaelaugustos/vue-router-ns/tree/main/test). These reports identify their tested revisions; they do not imply a fresh physical-device pass for every release.

Native acceptance uses [NativeScript-Vue 3.1.3](https://github.com/nativescript-vue/nativescript-vue/releases/tag/v3.1.3); the peer requirement remains `^3.1.2`. Version 3.1.3 fixes retained page apps in `$navigateTo` during native-window recreation and releases them on permanent window closure. Router Frame pages already use router-owned `createNativeView()` lifecycles. See the [focused validation report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-vue-3.1.3.md).

This release requires Core `^9.1.4`. [Core 9.1.4](https://github.com/NativeScript/NativeScript/releases/tag/9.1.4-core) includes the lazy-controller-loading, native content Back and surviving-Activity window fixes. Applications pinned to 9.1.3 must update Core and their lockfile before upgrading the router. The [9.1.4 acceptance report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-core-9.1.4.md) records focused evidence; full publication validation still runs on the release commit.

## API scope

The stable scope covers explicit routes and typed locations; push/replace/back and results; guards and navigation lifecycle; RouterView, RouterLink, tabs, drawer and Frame split navigation; modal routes; opt-in page-state restoration; and the documented native integrations outside the experimental list below. Defect fixes remain possible. Future incompatible changes require an explicit compatibility decision and migration guidance.

These remain **experimental and opt-in**:

- [Multiple native windows](./windows): one router per window, independent task/scene restoration and same-process reconnection on the documented platform baseline.
- [Native Suspense composition](./suspense): explicit renderer compatibility registration and async content inside a stable Page.
- [Route code preloading](./preloading): bounded code-only preparation. [Data preparation](./data-preloading) requires its own explicit loader/session permission.
- [Route data loading](./data-loading): per-entry state and cancellation without blocking native presentation.
- [File routing](./file-routing), including its generation/build-tool contract. Existing explicit routes do not depend on it.
- [Custom native hosts](./native-hosts) and [native controller/Fragment destinations](./native-destinations). The host version must change for incompatible contract changes.
- `backPreview: 'core'`, which requires the pinned upstream prototype documented in the [predictive-back report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-predictive-back.md). Released Core uses the existing fallback.

Multiple-window ownership and restoration are included as experimental features, with their acceptance evidence and platform limits documented in the [window guide](./windows) and [page-state report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-page-state.md). The roadmap is not a release commitment. The rc.3 adds the [iOS drawer and adaptive presentation](./drawer), [shared page actions](./page-actions), [diagnostics report viewer](./diagnostics-viewer) and [integrated showcase](./native-showcase). Existing Android overlay behavior remains available; adaptive presentation and shared actions are opt-in. See the [capability map](./capabilities) for native owners and supported compositions.

## Known limits

- Interactive gesture coverage distinguishes orientation delivery from visual rotation: UIKit can defer visual rotation until navigation completes. Repeated iPad resource collection, Stage Manager/live resizing and physical Android coverage remain unverified. See the [integration evidence](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-gesture-rotation-167-integration.md).
- Core 9.1.3 can crash with inherited CSS `direction` around native navigation because `requestLayout()` loads a controller view before application startup. Published Core 9.1.4 includes the correction (#11587). The [current packed-router regression](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-published-direction-139.md) verifies inherited LTR, keyboard input and reversed/committed native Back, including tabs, on iOS/iPadOS 18.6 and iPadOS 27.0 simulators. Use the published dependency without the historical research patch. Dynamic RTL, arbitrary custom hosts and explicitly forcing controller-view loading before startup are outside this acceptance.
- Automated native accessibility flags, labels and focus declarations do not certify spoken VoiceOver/TalkBack traversal. The [showcase acceptance](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-showcase.md) and individual feature reports identify remaining manual checks.

- Native Vite HMR uses `.route.json` metadata. `definePageMeta` works with webpack and bundled Vite, but is not supported during native Vite HMR. Adding/removing layout or middleware registrations requires an app restart; script edits can remount pages. See [file routing](./file-routing).
- With npm 10, keep a working NativeScript Vite lockfile: its own optional-peer dependency tree can fail on a lockfile-free install. The router's npm 10 install crash was fixed in beta.15. See [installation](./install).
- Process death never preserves JavaScript Promises. Persist small application-owned state and start a new operation after recovery. The router retains Frame page apps during Android Activity recreation on the supported published dependencies, allowing a pending native flow to rebind. Removing the route or permanently closing its owner still cancels that flow. See [native flows](./native-flows) and [restoration](./restore).
- Material tabs/sheets require their native dependency in the shipped application, including release builds. Availability helpers report what is present; they do not install it. Spotlight indexing/ranking and external SDK behavior remain system/provider responsibilities.

## Release validation

A new version on `main` is published only after the complete CI and native contract workflows pass on that same commit. The final npm tarball is installed into fresh explicit-route, webpack and Vite projects before publication; the tarball and installation logs are retained as a workflow artifact. A failed or cancelled required suite blocks publication. Experimental upstream tests do not substitute for tests on published dependencies.

Stable releases use npm’s `latest` tag; RC builds use `next`. Once a stable version exists, prereleases do not move `latest`. Use an exact version and commit your lockfile for reproducible application builds.

See [Path to 0.1.0 stable](./stable-readiness) for release gates, evidence and remaining work.
