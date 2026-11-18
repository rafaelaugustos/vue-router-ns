# Stable 0.1.0 artifact acceptance

Date: 2026-11-18. This release packages the runtime already merged through #225
(main `89caed64d2185b10444c293d983ff342f5320e57`). The release change updates the
version, installation channel and compatibility documentation, and adds a
repeatable fresh-consumer preparation. It changes no runtime API or native input
assertion. Experimental scope and hardware limits remain explicit.

## Exact artifact and local checks

The [package proof](./evidence/stable-010/package-proof.json) records the final
0.1.0 tarball SHA-256 and SHA-512 integrity. A second pack after documentation
review produced the identical SHA-256. The fresh native consumer installs that
artifact, published Core 9.1.4 and NativeScript-Vue 3.1.3, then performs a clean
reinstall and typecheck. It has no router alias/symlink or dependency patch.
The historical rc.3 fixture stays unchanged; preparation substitutes its displayed
version and dependency metadata and reuses its native assertions.

- 995 unit tests pass; 10 existing skips. All 66 native-driver tests pass.
- Typechecks, package build and documentation build pass. Locale validation covers
  49 pages in each of four languages, including links, anchors and shared code.
- Fresh package installation/reinstallation passes without a bundler, with webpack
  and with Vite on Node 22.23.3/npm 10.9.9. The full CI gate adds the supported
  Node/npm combinations.
- The playground typecheck and both platform bundles pass using the candidate.
- Fresh native consumer builds pass for iOS and Android. An initial Android build
  had no configured SDK path; the final build uses the installed SDK explicitly.
  An initial preparation omitted the fixture's type declarations; the corrected
  preparation copies them and passes in a new output directory.

## Native consumer results

| Environment                                          | Result                                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dedicated iPhone 16 Pro simulator, iOS 18.6          | One XCTest passes, zero failures/skips: keyboard, native modal, dirty guard refusal, saved result, reversed/committed Back, retained query and discard.      |
| Same simulator, accessibility XXXL and Reduce Motion | One XCTest passes, zero failures/skips, using native button Back. The app independently reports both actual UIKit settings. Settings are restored afterward. |
| Dedicated Android API 36 emulator                    | Native adb/UIAutomator input passes: keyboard, retained query, modal, guard refusal, saved result and discard.                                               |

[Baseline XCTest](./evidence/stable-010/consumer-ios-summary.json),
[preferences XCTest](./evidence/stable-010/consumer-ios-preferences-summary.json),
[observed preferences](./evidence/stable-010/consumer-ios-preferences-environment.json),
[Android checks](./evidence/stable-010/android-checks.json) and
[raw text evidence](./evidence/stable-010/consumer-logs.zip) retain the results.
Original XCTest bundles remain local. Reproduce with
[scripts/native/release-consumer](../scripts/native/release-consumer/README.md).

The [actual native recording](../docs/public/media/stable-010-consumer.mp4) shows
the complete baseline consumer flow. [Video metadata](./evidence/stable-010/video.json)
records its hash and processing. It is resized and resampled for browser playback;
it is not a source of native frame timing or spoken accessibility evidence.

## Publication gate and limits

These local checks complement the required complete CI/native suites. Publication
must still succeed through [Release](https://github.com/rafaelaugustos/vue-router-ns/actions/workflows/release.yml)
on the final main commit. That workflow validates all applicable native lanes,
installs the final tarball into fresh projects, retains it as `release-package`,
and publishes that artifact with provenance. A failed or cancelled lane blocks
publication; this report does not predeclare the workflow successful.

Existing physical VoiceOver and emulator TalkBack reports are historical,
revision-specific evidence. This stage adds no new screen-reader or physical
Android certification. Reduce Motion acceptance uses native button Back and does
not claim interactive cancellation under every system setting. Visual rotation
during an interactive gesture, repeated iPad resource collection, Stage Manager
and live resizing retain their documented limits. The experimental Core preview
suite does not replace acceptance on published dependencies.
