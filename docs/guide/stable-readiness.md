# Stable release and 1.0 readiness

`0.1.0-rc.3` is published. The next decision is whether its documented, non-experimental scope is ready for **0.1.0**, without requiring every roadmap feature. The 1.0 review below is a separate compatibility decision, not an automatic version bump. A small number of open issues is not an acceptance criterion.

## What has been delivered

The original roadmap foundations and proposals (#43 and #46–#63), optional authoring conventions (#88–#92), route data/Suspense work (#118–#119), tab styling/visibility (#122–#123), and the rc.3 navigation experience (#117 and #133–#138) have completed their scoped issues. Closed research issues demonstrate their investigation, not a universal production API.

The [capability map](./capabilities) explains actual platform owners. The [compatibility guide](./compatibility#api-scope) defines the frozen API and lists features that remain experimental. In particular, closing the Android predictive-transition prototype did not publish its upstream Core implementation.

## Release gates

| Gate                          | Evidence required for the release decision                                                                                                                                                  | Current record                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| API scope                     | Freeze the documented non-experimental API; document any incompatible correction and its migration in a new candidate                                                                       | [RC scope](./compatibility#api-scope)                                                                                         |
| Reproducible artifact         | Exact npm version and lockfile, no local router alias or unpublished Core patch; build and run a consumer on iOS and Android                                                                | [Consumer acceptance #152](https://github.com/rafaelaugustos/vue-router-ns/issues/152)                                        |
| Native behavior               | Push/replace/back, cancelled gestures, guards, modal results, retained stacks and disposal pass the full supported native matrix on the release commit                                      | [Native contract report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-contracts.md) and CI artifacts |
| Accessibility and preferences | Record keyboard, large text, system Reduce Motion and physical screen-reader checks; identify spoken/manual results separately from automated assertions                                    | [Accessibility report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-accessibility.md), #152          |
| Known defects                 | Resolve release-blocking failures in the promised scope; for platform/upstream limits, record reproduction, affected versions, supported composition and an explicit maintainer disposition | [Inherited direction #139](https://github.com/rafaelaugustos/vue-router-ns/issues/139)                                        |
| Documentation                 | EN/pt-BR/es/zh-CN examples match exported APIs; installation, ownership, experimental boundaries and migration/known limits are reachable from the learning path                            | [First app](./first-app), [compatibility](./compatibility), [capabilities](./capabilities)                                    |
| Publication                   | CI and the complete native suites succeed on the same release commit; the final tarball passes fresh-install checks; the maintainer approves publication                                    | [Release validation](./compatibility#release-validation)                                                                      |

A previous green candidate is evidence for that revision, not a waiver for a changed release commit. Missing hardware coverage stays **unverified** until tested or explicitly accepted as a documented limitation by the maintainer. A beta iOS device pass supplements, rather than replaces, the supported simulator baseline. No elapsed soak period or download count alone proves readiness.

## Follow-ups and investigation decisions

- **#139:** the Core cause is isolated and [NativeScript #11587](https://github.com/NativeScript/NativeScript/pull/11587) proposes the correction. [PR #160](https://github.com/rafaelaugustos/vue-router-ns/pull/160) records native validation. The published Core 9.1.3 is still affected. Await a published correction, update the dependency and rerun the consumer/native matrix, or explicitly narrow the supported composition before a release decision.
- **#152:** the [published-consumer report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-rc3-consumer.md) records physical VoiceOver service output and the emulator TalkBack procedure/results separately from UI assertions. Android hardware is unavailable; the maintainer accepted emulator validation with that limit. Read the speech and gesture boundaries before treating this as broad accessibility certification.
- **#145:** the [v1 observation proposal](https://github.com/rafaelaugustos/vue-router-ns/blob/main/research/transition-observation/README.md) records the native lifecycle evidence and decision to keep the adapter private. Missing authoritative entry IDs and unsupported concurrent target mutation prevent a public controller. Continuous UIKit progress and a Jolt adapter remain outside stable-release requirements.
- **#64:** maintain the roadmap as an index of delivered scope and current follow-ups, not a checklist that silently promotes experimental integrations to stable.

Further delivery can stay in candidates when a fix changes behavior or the frozen API. Once the gates above have evidence and the maintainer accepts the remaining documented limits, publish 0.1.0 through the release workflow. A later 1.0.0 decision needs its own API compatibility commitment and application experience; it does not follow from exhausting the issue list.

## 1.0 review — 2026-10-25

**Not ready to publish 1.0 yet.** The API has substantial implementation and native acceptance evidence, but a merged documentation PR or an upstream preview package is not a release candidate with the final dependencies.

| Area                        | Review outcome                                                                                                                                                         | Remaining action                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Public entry points         | Reviewed the root entry, five file-routing entries, system-search entry and package metadata export. Added the seven missing named-export references to the API guide. | Approve the 1.x compatibility commitment below.                                                        |
| Documented behavior         | Guards, results, retained entries, named stacks, disposal and platform ownership are documented. Experimental integrations remain explicitly identified.               | Revalidate any behavior changed by the final dependency update.                                        |
| Known defect                | #139 is reproduced on released Core; the proposed fix is verified in an isolated fixture.                                                                              | Adopt and validate a corrected published Core version, or explicitly exclude the affected composition. |
| Consumer and accessibility  | #152 records the exact rc.3 consumer, physical VoiceOver and emulator TalkBack. Hardware/gesture limits remain explicit.                                               | Carry those limits into release notes; rerun relevant acceptance on the release artifact.              |
| Documentation and languages | English, Portuguese, Spanish and Simplified Chinese share the same guide routes and code examples.                                                                     | Keep locale coverage, links and anchors checked; language coverage is not a new platform guarantee.    |
| Publication                 | The workflow validates the tarball and full native matrix before publication.                                                                                          | Run it against the selected release commit and obtain maintainer approval.                             |

### Proposed 1.x compatibility commitment

- Public imports are the entries declared in `package.json#exports`, their documented values/types and Vue component contracts. Files present under `src/` or `dist/` do not create supported deep imports.
- Stable compatibility includes option defaults, navigation failures/results, guard ordering, entry ownership/lifetime and supported platform behavior, not just function names.
- Experimental means the feature has a narrower support/evidence boundary. Before 1.0, choose whether to retain that API for 1.x or move it behind a new explicitly versioned opt-in contract. Do not silently break an existing root export in a minor release merely because its guide says experimental.
- Incompatible changes to the stable contract require a major version and migration guidance. Additive changes and compatible fixes can ship in minor/patch versions. No API has been removed or promoted by this review.
- No additional drawer mode, live DevTools controller, Jolt adapter or predictive prototype is required merely to fill the roadmap. A new application use case can justify separate work.

The [review evidence](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/release-readiness.md) records source revision, checks and limitations. This review does not authorize publication or claim that every exported API has a fresh hardware pass.
