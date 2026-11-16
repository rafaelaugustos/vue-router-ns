# Published inherited-direction correction — #139

This stage validates the current router's built npm tarball with published Core
9.1.4 and NativeScript-Vue 3.1.3. The earlier dependency-adoption evidence used
the historical router rc.3 control. Router runtime code, direction semantics,
native delegates and gesture policy are unchanged here.

## Upstream correction and scope

[Core #11587](https://github.com/NativeScript/NativeScript/pull/11587) merged on
2026-11-12 and is included in the published [9.1.4 release](https://github.com/NativeScript/NativeScript/releases/tag/9.1.4-core).
Its layout invalidation reads `viewIfLoaded` instead of forcing controller-view
loading before application startup. The existing reproduction distinguishes
prebuilt inherited LTR, explicit `requestLayout()` and an explicitly forced
`controller.view` access. There is no router workaround or dependency patch.

The historical fixture source and lockfile in `examples/ios-direction-repro` remain unchanged
on Core 9.1.3 / Vue 3.1.2 / router rc.3. The new preparation copies it into a
fresh consumer, substitutes published Core 9.1.4 / Vue 3.1.3 and the current
router tarball, and updates the displayed router version. Each installation
compares all 1,362 Core source files with the official npm tarball, excluding
package installation metadata. The router is copied from the tarball, not linked
to local sources. Its package version remains 0.1.0-rc.4; this does not publish
the current checkout as a new registry release.

## Native comparisons

The same XCTest methods type `draft` into the native TextField, dismiss the
keyboard, send a reversing edge touch, require the detail and edited value to
remain, then commit native Back and require the root button. The reversing input
helper belongs only to XCTest. The application keeps native Back enabled and
does not use a permanently active leave guard.

| Environment / entry                                                        | Result                                                                              |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Core 9.1.3, iPadOS 18.6: prebuilt ordinary tree                            | Pass                                                                                |
| Same Core 9.1.3: prebuilt inherited LTR and explicit `requestLayout()`     | Both terminate on the TextField interaction; UIKit gesture-graph assertion recorded |
| Core 9.1.4, iOS 18.6 iPhone: Core / Vue / current router                   | 3 / 2 / 3 cases pass                                                                |
| Core 9.1.4, iPadOS 18.6 iPad: Core / Vue / current router                  | 3 / 2 / 3 cases pass                                                                |
| Core 9.1.4, iPadOS 27.0 iPad: Core / Vue / current router                  | 3 / 2 / 3 cases pass                                                                |
| Core 9.1.4, iPadOS 18.6: explicitly force `controller.view` before startup | Still terminates: intentional unsafe negative control                               |

The old Core's explicit layout case records `loadedBefore: false` and
`loadedAfter: true`; the corrected Core records both as false. Explicitly
forcing `controller.view` on the corrected Core records `loadedAfter: true`
and still fails. The corrected implementation preserves lazy loading; it does
not make arbitrary early UIKit view initialization safe.

[Local validation](./evidence/published-direction-139/local-validation.json) links
the three positive-run archives and the preserved negative controls. All 24
positive cases passed with no skips. The installed router contents (434 files)
match across all three consumers; the exact [tarball](./evidence/published-direction-139/vue-router-ns-0.1.0-rc.4.tgz)
is retained. Text archives redact local workspace/user paths; original XCTest
bundles remain local.

Those 24 cases used the original immediate typing assertion. The final driver
at `3390ed432be4a14cf91247d480d0ea55b7731270` adds the bounded observation described
below. A fresh iPad 18.6 consumer passed another eight cases with that driver,
zero failures/skips, and the identical router tarball. Its
[final validation](./evidence/published-direction-139/final-validation.json)
retains the logs and summaries. Local provenance marks documentation edits as
dirty; the runtime, fixture source and native driver were committed.

The old-Core run finishes with one pass and two expected failures. The unsafe
view-loading run has one expected failure. These failures remain evidence and
are excluded from the supported green suite, rather than bypassed by a guard.
The original UIKit assertion and earlier isolation stages remain documented in
[the historical investigation](./native-inherited-direction.md).

Local builds use Xcode 27.2 (27B52), Node 20.19.4, CLI 9.1.2, iOS runtime 9.1.0,
NativeScript webpack 5.0.38 and webpack 5.111.1. Models are iPhone 16 Pro and
iPad Pro 11-inch (M4), ARM64 simulators. Runtime builds are 18.6 / 22G86 and
27.0 / 24A434. No physical-device claim is made by these executions.

An initial consumer folder named `app` collided with NativeScript's generated
application directory and executable. Xcode rejected that build before native
testing. The prepared directory is now named `consumer`; the failed build log
is retained. No application assertion or deadline was changed to address it.

## Required regression coverage

The new [preparation and driver](../scripts/native/direction/README.md) run all
eight supported cases in fresh consumers. A focused workflow selects iPhone and
iPad 18.6. Native contracts now requires both direction rows in full executions;
its default remains the complete matrix. Explicit `lane=direction` selects only
this investigation, and ordinary PRs retain their existing device-job policy.
Seven aggregate-gate controls verify full/focused/PR selection and rejection of
failed required rows, skipped required rows and unexpectedly executed rows.

### Initial hosted failure and typing completion

The initial focused [run 43822097166](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43822097166)
at `7669916cf65c525704f300d87230ed1660d47353` failed. iPhone passed all eight cases.
iPad passed the three Core cases and Vue inherited LTR, but the ordinary Vue
control read `d` immediately after a single `typeText("draft")`; router cases did
not run. The [original artifacts, job logs and digests](./evidence/published-direction-139/hosted-initial/validation.json)
and the [exported failing summary](./evidence/published-direction-139/hosted-initial/ipad-vue-failure-summary.json)
are retained.

The [actual XCTest recording](./evidence/published-direction-139/hosted-initial/typing-completes-after-snapshot.mp4)
shows `d` around 9.5–9.8 seconds, then `draft` around 9.9 seconds through the end,
without another input command. This demonstrates a premature assertion in the
test, independently of the inherited-direction crash. The [attachment provenance](./evidence/published-direction-139/hosted-initial/typing-diagnosis.json)
ties those original video bytes to the failed job. The driver now observes
the exact `draft` value for at most five seconds before testing Back, matching
the existing value-observation budget after reversed Back. It never retypes
input or accepts a prefix; native navigation assertions remain unchanged.

The explicit `testIncompleteTypingControl` sends only `d`. It failed at that
five-second observation, before dismissal or Back, with one input command and
no retry. Its [logs and summary](./evidence/published-direction-139/partial-input-control.zip)
confirm that genuinely incomplete typing still fails. The driver also exports
failed XCTest summaries and preserves the original failure if diagnostics fail.

### Hosted acceptance of the corrected driver

[Run 43825876567](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/43825876567),
attempt 1 at `3390ed432be4a14cf91247d480d0ea55b7731270`, passed both native jobs
and the aggregate gate. Each clean consumer passed Core 3 / Vue 2 / router 3:
16 cases total, zero failures or skips. Both ran on ARM64 with Xcode 16.4
(16F6), Node 22.23.4 and iOS/iPadOS 18.6 (22G86). All 1,362 Core source files
matched the published package, startup remained unloaded, and the router tarball
SHA256 matched the retained local artifact.

The [validation](./evidence/published-direction-139/hosted/validation.json),
[original artifact inventory and SHA256 digests](./evidence/published-direction-139/hosted/artifacts.json),
[job results](./evidence/published-direction-139/hosted/jobs.json) and
[completed job logs](./evidence/published-direction-139/hosted/logs.json) are
retained alongside the original downloaded ZIPs, including XCTest bundles.
This was explicitly `lane=direction`; the nine unrelated native groups were
skipped. It is not a new full-matrix acceptance or a release authorization.
Changes after the tested commit contain documentation and retained evidence only.

## Recording and disposition

[The final 49-second iPad application recording](../docs/public/media/published-direction-139-ipad.mp4)
uses the corrected test driver at `3390ed4` and shows three router compositions: ordinary,
inherited LTR and inherited LTR under tabs. It includes typing, reversed Back
with the retained draft and completed Back. [Final video metadata](./evidence/published-direction-139/final-video.json)
records hashes and all 1,599 retained frames with identical presentation timestamps.

[The earlier 40-second iPhone application recording](../docs/public/media/published-direction-139.mp4)
shows the same three router compositions: ordinary,
inherited LTR and inherited LTR under tabs. Each includes typing, reversed Back
with the retained draft and completed Back. [Video metadata](./evidence/published-direction-139/video.json) records hashes and
all 1,236 retained frames. There are no cuts or speed changes; H264 compression
and scaling reduce the file size. Only the final frame hold differs in the MP4 container; every presentation
timestamp matches the original. The simulator has no personal application data.

The validated boundary is the inherited-LTR startup/keyboard/native-Back
regression with published Core 9.1.4 and the current packed router. Dynamic RTL,
arbitrary custom native hosts, forced pre-startup view access and physical-device
behavior are outside this acceptance. RouterDrawer keeps its existing container
direction design. No experimental feature is promoted and no release is authorized.
