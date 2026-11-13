# Diagnostic recording — #180 stage 1

This fixture records real native observations on a dedicated iPad simulator.
The XCTest driver taps application controls; the application itself checks the
recording and writes reports. No private native selectors or synthetic navigation
events drive the acceptance sequence.

```sh
npm run build
npx tsc --noEmit -p scripts/native/recording/tsconfig.json
ns build ios --path demo --for-device false --env.recordingTest --no-hmr
IOS_SIMULATOR=<dedicated-iPad-UUID> RECORD_VIDEO=1 \
  OUT=scripts/native/out/recording node scripts/native/recording/ios.mjs
```

Use Node 20.19.4 for the native CLI, Xcode and Ruby with the `xcodeproj` gem.
The driver uninstalls/reinstalls only the demo app on the explicitly selected
simulator, creates its XCTest project in `/tmp/recording-checks`, bounds the
XCTest invocation to 300 seconds, and retains logs/results/video even on failure.
Use a fresh output directory for each run because Xcode does not overwrite
result bundles. It never selects or terminates another simulator.

The ten controls check initial state, success, blocked guard, overlapping guard
cancellation, modal lifetime/result redaction, an intentionally unmanaged native
Page, recovery, ring truncation, clear epochs and stop. The truncation control
takes 180 actual checkpoints without navigating; it is a retention probe, not
a workload benchmark. Byte counts are independently verified in Node against
the actual serialized array. `summary.json` includes collector samples/timing,
retained bytes and compact export size. The stopped recording remains unchanged
while the application navigates back to root.

Reports wrap each v2 capture in `{ command, ok, error?, capture }`; the committed
evidence extracts the unchanged captures. `v1.json` is the existing viewer format.
The v2 capture is the contract for the subsequent offline importer/replay stage;
the current viewer deliberately continues to accept only v1. See
[validation and boundaries](../../../test/native-diagnostic-recording-stage1.md).
