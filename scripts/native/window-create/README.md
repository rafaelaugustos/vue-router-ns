# iPad edge drag creates a window — #181 stage 6

Install demo dependencies and generate ignored native resources using
[demo setup](../../../demo/README.md). From the repository root:

```sh
npm run build
npx tsc --noEmit -p scripts/native/window-create/tsconfig.json
python3 scripts/native/window-create/prepare.py
ns build ios --path demo --for-device false --env.windowcreateTest --no-hmr
IOS_SIMULATOR=<dedicated-iPad-UUID> RECORD_VIDEO=1 \
  OUT=scripts/native/out/window-create node scripts/native/window-create/ios.mjs
```

Use Node 20.19.4, Xcode, Ruby's `xcodeproj` gem and a dedicated booted iPad simulator.
Preparation changes ignored demo resources, declaring scene support and the custom
activity type. The driver reinstalls only the fixture app on the explicitly selected
simulator. Use a fresh output directory per run. The accepted configuration is an
iOS 18.6 iPad Pro 13-inch M4 simulator with Split View.

XCTest performs nine actual long-press-and-drag gestures: eight system screen-edge
transfers and one cancellation inside the source window. No delegate or simulated
scene callback creates a window. Button and Control–O are the only two inputs that
call the public activation API. Assertions verify distinct visible OS windows,
explicit destination ownership, normal guards, exact retained source Page/draft,
independent new-window roots, and matching native/logical histories.

Timed fixture controls rotate session identity, revoke permission, remove a route
or expire an offer during a real drag. Another case closes the actual new window
while its initial guard holds readiness; another uses a real button to revoke
permission during an asynchronous destination guard. Rejected windows must actually
close, leaving only the source. Replaying consumed activity metadata cannot allocate
another router. Eighteen forced JS collections exercise weak native wrapper retention.

The driver writes environment metadata, ordered JSON reports, XCTest diagnostics,
a final screenshot and (when requested) the actual application recording. These
establish simulator input and accessibility-tree button/keyboard reachability, not
physical VoiceOver, Stage Manager, external apps or process restoration. See the
[recipe](../../../examples/drag-drop/new-window.md) and
[acceptance report](../../../test/native-window-create-stage6.md).
