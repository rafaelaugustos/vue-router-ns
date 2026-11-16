# Published inherited-direction acceptance (#139)

The historical reproduction under `examples/ios-direction-repro` stays pinned to
Core 9.1.3 and router rc.3. Its dependency patch helper is never used by this suite.
The new preparation copies that fixture to a fresh directory, installs published
Core 9.1.4 / Vue 3.1.3 and the current router's built npm tarball, and changes only
the router's displayed version label. It compares installed Core source files
against the official registry tarball, excluding installation metadata.

Run from the repository root with Node, the NativeScript CLI, Xcode, CocoaPods
and Ruby's `xcodeproj` gem available to child processes:

```sh
export OUT=/tmp/direction-acceptance
node scripts/native/direction/prepare.mjs
# Create and boot a dedicated iOS/iPadOS simulator before continuing.
IOS_SIMULATOR=<dedicated-UUID> node scripts/native/direction/ios.mjs
```

`OUT` must have no existing `consumer` directory. The simulator driver reinstalls only
the fixture's `org.nativescript.directionrepro` app. It does not operate on hardware.
`ENTRY=core|vue|router` selects one build for diagnosis; the default runs all three.
Use a fresh output directory for another full execution. `RECORD_VIDEO=1` captures
the actual router XCTest sequence with `simctl`; recording failure is an error.

The eight existing XCTest cases type into a native field with Back enabled,
send the reversing touch path, require the detail/draft to remain, and complete
native Back to the root. The Core cases cover prebuilt ordinary, inherited LTR
and explicit `requestLayout()` startup. Vue covers ordinary/inherited LTR; router
covers ordinary/inherited LTR and inherited LTR under tabs. The reversing-touch
helper is compiled only into XCTest, not the app or package. No delegate or
recognizer is replaced and no always-active leave guard hides the regression.

Typing waits for the exact `draft` value for at most five seconds, the same value
observation budget already used after reversed Back. A hosted failure recording
showed the original single `typeText` command completing after the immediate
assertion had read `d`. Input is never sent again. The explicit
`testIncompleteTypingControl` sends only `d` and must fail before Back; it is
excluded from the eight passing cases. Failure summaries are exported even when
XCTest fails, and diagnostic errors do not replace the original test failure.

The driver retains bounded command logs, package/source provenance, native
environment, Core's final startup trace and XCTest results for every entry.
Exactly 3/2/3 passing cases and no skipped/failed tests are required. The deliberately
unsafe pre-startup `controller.view` access remains a separate negative control;
it is not a supported composition or silently included among the passing cases.

Dispatch `Native contracts` with `lane=direction` for the focused suite:

```sh
gh workflow run native-contracts.yml --ref <branch> -f lane=direction
```

The reusable `Native inherited direction` workflow runs all eight cases on iPhone
and iPad 18.6. The complete Native contracts workflow requires both rows on its
manual/scheduled runs. Ordinary PRs keep the repository's existing policy of
skipping device jobs. Current acceptance does not certify dynamic RTL, arbitrary
custom native hosts or physical-device behavior.
