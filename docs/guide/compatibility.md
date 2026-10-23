# RC scope and compatibility

The `0.1.0` release candidate freezes the documented, non-experimental API while we validate it for the stable release. Explicit JavaScript/TypeScript route tables remain the default. File conventions are optional; both use native navigation, without a Vue Router or Nuxt runtime.

## Supported baseline

| Dependency         | RC requirement                            | Acceptance baseline                                          |
| ------------------ | ----------------------------------------- | ------------------------------------------------------------ |
| NativeScript Core  | `^9.1.3`                                  | 9.1.3                                                        |
| NativeScript-Vue   | `^3.1.2`                                  | 3.1.2                                                        |
| Node.js            | `>=20.19.4`                               | Node 20.19.4 and 22.23.3 installation; Node 22 native builds |
| npm                | Compatible with the selected Node version | 10.8.2 and 11.21.1                                           |
| webpack (optional) | webpack 5, NativeScript webpack 5         | webpack 5.112.0 / NativeScript webpack 5.0.38                |
| Vite (optional)    | Vite 8, NativeScript Vite 8.0.20+         | Vite 8.3.4 / NativeScript Vite 8.0.20                        |

The RC narrows beta's Core `>=8.9.0` and NativeScript-Vue `^3.0.0` declarations to the validated baseline. Upgrade those dependencies before upgrading the router. A compatible version range is not a claim that every intervening dependency release has been tested.

Native CI covers Android API 34/35/36 and iOS/iPadOS 18.6 simulators. Additional iOS 26 runs and physical-device accessibility checks are recorded in the repository's [validation reports](https://github.com/rafaelaugustos/vue-router-ns/tree/main/test). These reports identify their tested revisions; they do not imply a fresh physical-device pass for every release.

## API scope

The RC freezes explicit routes and typed locations; push/replace/back and results; guards and navigation lifecycle; RouterView, RouterLink, tabs, drawer and Frame split navigation; modal routes; opt-in page-state restoration; and the documented native integrations outside the experimental list below. Defect fixes remain possible. An unavoidable incompatible correction before stable must be documented with migration instructions in a new candidate.

These remain **experimental and opt-in**:

- [Native Suspense composition](./suspense): explicit renderer compatibility registration and async content inside a stable Page.
- [Route data loading](./data-loading): per-entry state and cancellation without blocking native presentation.
- [File routing](./file-routing), including its generation/build-tool contract. Existing explicit routes do not depend on it.
- [Custom native hosts](./native-hosts) and [native controller/Fragment destinations](./native-destinations). The host version must change for incompatible contract changes.
- `backPreview: 'core'`, which requires the pinned upstream prototype documented in the [predictive-back report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-predictive-back.md). Released Core uses the existing fallback.

Multiple-window router ownership from #46 / PR #65 is **outside this RC**. The stable target includes single-window page-state restoration; independent OS task/scene reconstruction is not promised. The remaining #49 multi-window acceptance and the #64 roadmap do not block this scoped release.

## Known limits

- Native Vite HMR uses `.route.json` metadata. `definePageMeta` works with webpack and bundled Vite, but is not supported during native Vite HMR. Adding/removing layout or middleware registrations requires an app restart; script edits can remount pages. See [file routing](./file-routing).
- With npm 10, keep a working NativeScript Vite lockfile: its own optional-peer dependency tree can fail on a lockfile-free install. The router's npm 10 install crash was fixed in beta.15. See [installation](./install).
- Process death never preserves JavaScript Promises. Persist small application-owned state and start a new operation after recovery. On published NativeScript-Vue, explicit Android Activity recreation can dispose the page and cancel its pending native flow; this RC does not include PR #65's retained-page lifecycle. See [native flows](./native-flows) and [restoration](./restore).
- Material tabs/sheets require their native dependency in the shipped application, including release builds. Availability helpers report what is present; they do not install it. Spotlight indexing/ranking and external SDK behavior remain system/provider responsibilities.

## Release validation

A new version on `main` is published only after the complete CI and native contract workflows pass on that same commit. The final npm tarball is installed into fresh explicit-route, webpack and Vite projects before publication; the tarball and installation logs are retained as a workflow artifact. A failed or cancelled required suite blocks publication. Experimental upstream tests do not substitute for tests on published dependencies.

RC builds use npm's `next` tag. As with the betas, `latest` also follows the newest prerelease until the first stable version exists. Use an exact version and commit your lockfile for reproducible application builds.
