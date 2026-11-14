# iPad sidebar drop — #181 stage 5

Install the demo dependencies and generate its ignored native resources following
[demo setup](../../../demo/README.md). From the repository root:

```sh
npm run build
npx tsc --noEmit -p scripts/native/sidebar-drop/tsconfig.json
python3 scripts/native/drag-drop/prepare.py
ns build ios --path demo --for-device false --env.sidebardropTest --no-hmr
IOS_SIMULATOR=<dedicated-iPad-UUID> RECORD_VIDEO=1 \
  OUT=scripts/native/out/sidebar-drop node scripts/native/sidebar-drop/ios.mjs
```

Use Node 20.19.4, Xcode, Ruby's `xcodeproj` gem and a dedicated booted iPad simulator.
The preparation script only changes ignored demo resources, declaring the custom
public-data UTI and scene support. The driver reinstalls only the demo on the
explicitly selected simulator. Use a fresh output directory for each run.

XCTest performs ten actual long-press-and-drag gestures from the Library card to
rows in a permanent `RouterDrawer`. It verifies that each row is physically outside
the source content. It never invokes drag delegates or routing methods to fake a
gesture. Actual ordinary sidebar button and Control–O inputs test the alternatives.
The native reports cover both receiving stacks, replay/new deliveries, cancelled
and multi-item drags, removal during hover, removal during provider loading, owner
reassignment, permission revocation and guard refusal. The fixture forces two JS GC
cycles per drag and checks session identity through callbacks.

All three exact root Pages and independent drafts must remain retained. Each
report compares native and logical histories, records the receiving window/Frame,
and checks the permanent sidebar. Hover observations assert unchanged tab
selection/history/provider counters. Disposing one row never disposes the other.
The provider-disposal case waits beyond the original provider delay before its
final report. Permission and owner changes use timed fixture controls while real
native data transfer is pending; they do not emulate an authentication provider.

This is one iOS 18.6 simulator window with a permanent sidebar. It does not establish
physical VoiceOver, adaptive rotation, overlay edge reveal, Stage Manager, external
apps or dragging to create a window. The earlier cross-window and Android evidence
remain separate. See the [recipe](../../../examples/drag-drop/sidebar.md) and
[acceptance report](../../../test/native-sidebar-drop-stage5.md).
