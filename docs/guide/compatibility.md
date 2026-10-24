# RC scope and compatibility

The `0.1.0-rc.3` release candidate freezes the documented, non-experimental API while we validate it for the stable release. Explicit JavaScript/TypeScript route tables remain the default. File conventions are optional; both use native navigation, without a Vue Router or Nuxt runtime.

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

- [Multiple native windows](./windows): one router per window, independent task/scene restoration and same-process reconnection on the documented platform baseline.
- [Native Suspense composition](./suspense): explicit renderer compatibility registration and async content inside a stable Page.
- [Route data loading](./data-loading): per-entry state and cancellation without blocking native presentation.
- [File routing](./file-routing), including its generation/build-tool contract. Existing explicit routes do not depend on it.
- [Custom native hosts](./native-hosts) and [native controller/Fragment destinations](./native-destinations). The host version must change for incompatible contract changes.
- `backPreview: 'core'`, which requires the pinned upstream prototype documented in the [predictive-back report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-predictive-back.md). Released Core uses the existing fallback.

Multiple-window ownership and restoration are included as experimental features, with their acceptance evidence and platform limits documented in the [window guide](./windows) and [page-state report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-page-state.md). The roadmap is not a release commitment. The rc.3 adds the [iOS drawer and adaptive presentation](./drawer), [shared page actions](./page-actions), [diagnostics report viewer](./diagnostics-viewer) and [integrated showcase](./native-showcase). Existing Android overlay behavior remains available; adaptive presentation and shared actions are opt-in. See the [capability map](./capabilities) for native owners and supported compositions.

## Known limits

- Inherited NativeScript CSS `direction` around generic native navigation can trigger a gesture-graph crash on iOS 18.6. `RouterDrawer` uses its own `direction` prop and bounded UIKit handling; generic layouts remain under [investigation (#139)](https://github.com/rafaelaugustos/vue-router-ns/issues/139).
- Automated native accessibility flags, labels and focus declarations do not certify spoken VoiceOver/TalkBack traversal. The [showcase acceptance](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-showcase.md) and individual feature reports identify remaining manual checks.

- Native Vite HMR uses `.route.json` metadata. `definePageMeta` works with webpack and bundled Vite, but is not supported during native Vite HMR. Adding/removing layout or middleware registrations requires an app restart; script edits can remount pages. See [file routing](./file-routing).
- With npm 10, keep a working NativeScript Vite lockfile: its own optional-peer dependency tree can fail on a lockfile-free install. The router's npm 10 install crash was fixed in beta.15. See [installation](./install).
- Process death never preserves JavaScript Promises. Persist small application-owned state and start a new operation after recovery. The router retains Frame page apps during Android Activity recreation on the supported published dependencies, allowing a pending native flow to rebind. Removing the route or permanently closing its owner still cancels that flow. See [native flows](./native-flows) and [restoration](./restore).
- Material tabs/sheets require their native dependency in the shipped application, including release builds. Availability helpers report what is present; they do not install it. Spotlight indexing/ranking and external SDK behavior remain system/provider responsibilities.

## Release validation

A new version on `main` is published only after the complete CI and native contract workflows pass on that same commit. The final npm tarball is installed into fresh explicit-route, webpack and Vite projects before publication; the tarball and installation logs are retained as a workflow artifact. A failed or cancelled required suite blocks publication. Experimental upstream tests do not substitute for tests on published dependencies.

RC builds use npm's `next` tag. As with the betas, `latest` also follows the newest prerelease until the first stable version exists. Use an exact version and commit your lockfile for reproducible application builds.
