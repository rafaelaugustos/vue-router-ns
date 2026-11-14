# iPad drag/drop — #181 stage 1

Install the demo dependencies and generate its ignored native resources following
the [demo setup](../../../demo/README.md). Then, from the repository root:

```sh
npm run build
npx tsc --noEmit -p scripts/native/drag-drop/tsconfig.json
python3 scripts/native/drag-drop/prepare.py
ns build ios --path demo --for-device false --env.dragdropTest --no-hmr
IOS_SIMULATOR=<dedicated-iPad-UUID> RECORD_VIDEO=1 \
  OUT=scripts/native/out/drag-drop node scripts/native/drag-drop/ios.mjs
```

Use Node 20.19.4, Xcode and Ruby's `xcodeproj` gem. Preparation changes only ignored
demo resources, declaring the custom data UTI and iPad scene support. The fixture
still exercises only one window. The driver reinstalls only this fixture
on the explicitly selected simulator. Use a fresh output directory per run.

XCTest holds and drags an actual card to the Inbox target or cancel area, using
UIKit's native drag preview, interaction delegates and asynchronous item provider.
It does not invoke drag callbacks or navigation methods to simulate the gesture.
Controls prepare each case; ordinary button and Control–O actions exercise the
non-drag alternative. The slow-provider case disposes the actual drop registration
while its data is pending. Provider/owner races beyond this fixture remain unit
evidence.

The fixture forces JavaScript GC between native delegate callbacks, checking that
session identity survives collection. Reports preserve source/target window and stack identities, compare native/logical
histories and check both retained root Pages and their independent drafts. A new
native drag gets a new id; replaying the previously captured intent is explicitly
an app control. Multi-item dragging offers two native items from one card and is
deliberately unsupported by the target; it does not claim multi-touch addition.

This stage uses one window and two retained tabs on an iPad simulator. It does not
prove physical iPad/VoiceOver, cross-window transfer, Stage Manager or creating a
new window by dragging. Those remain in #181. See the
[recipe](../../../examples/drag-drop/README.md) and
[acceptance report](../../../test/native-drag-drop-stage1.md).
