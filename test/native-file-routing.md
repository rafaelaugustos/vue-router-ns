# Native file-route acceptance — 2026-10-19

Implementation of [#89](https://github.com/rafaelaugustos/vue-router-ns/issues/89). The opt-in `demo/src/testing/files-app.ts` fixture uses NativeScript-Vue 3.1.2, Core 9.1.3, Android runtime 9.1.1 and iOS runtime 9.1.0.

| Environment                                     | Result                                                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Android API 36 arm64 emulator (`emulator-5554`) | All 18 checks passed; runner also verified the rendered completion label and captured a screenshot. |
| iPhone 17 simulator, iOS 26.0                   | All 18 checks passed; `FILES_RESULT` recorded in the simulator's unified log.                       |

## What ran natively

1. Generated index destination mounts a real native Page.
2. A generated parent record creates the expected native `withParents` back stack.
3. Typed dynamic parameters and extracted metadata reach the destination.
4. Adding a destination/editing metadata preserves the open Page and its original metadata/draft.
5. Renaming a destination preserves its current native entry.
6. Back returns to that retained renamed-away Page.
7. Back preserves the original product Page and draft.
8. A new visit sees the updated metadata and a distinct instance.
9. Removing the product destination leaves its open native Page intact.
10. Back after removal returns to the exact original root Page.
11. An optional parameter can be absent.
12. A catch-all supplies an array of native destination parameters.
13. An optional catch-all accepts an empty tail.
14. The correct iOS/Android SFC variant is selected.
15. Metadata-declared middleware aborts before mounting.
16. Metadata selects a native modal, named layout and middleware in a separate Frame.
17. The modal result reaches its caller and returns to the retained root Page.
18. An explicitly declared route remains navigable alongside generated records.

These assertions use actual Page/Frame identities, native back-stack length, per-entry refs and native modal completion. The matcher, host and navigation implementation are not patched. Back here is the router's native back operation; this is not a new hardware/system-gesture acceptance pass.

## Reproduce

```sh
npm ci
npm run build
cd demo
ns build android --env.filesTest
npx tsc --noEmit -p tsconfig.files.json
adb -s <serial> install -r platforms/android/app/build/outputs/apk/debug/app-debug.apk
cd ..
ANDROID_SERIAL=<serial> npm run test:native:files
```

The build invokes `scripts/native/prepare-files.mjs`. It copies the native SFC fixture into ignored working directories and actually adds, edits, renames and removes files before generating each table. The application imports the generated modules and applies successive tables through `createFileRouteUpdater`. A local pre-loader runs `transformPageMeta` before NativeScript-Vue's SFC compiler. Native CI runs the Android fixture after the existing suites and publishes `scripts/native/out/files` logs, results and screenshot.

For iOS, use `ns build ios --emulator --env.filesTest`, install/launch `org.nativescript.vuerouterns`, and inspect the simulator's unified log for `FILES_RESULT`. The successful local run used process 5522 and reported its result at 03:20:04 on October 19. No console/debug server needs to remain running.

## Automated evidence and boundaries

The automated suite includes real filesystem-watch creation/rename/removal and recovery after invalid metadata, output equality with clean generation, actual TypeScript compilation of emitted modules (including expected errors for invalid names/params), existing-matcher semantics, collisions, platform selection, AST transforms, source locations and preservation of multiple stacks. The AST parser never evaluates imports or setup. On macOS these filesystem-watch tests require normal FSEvents access; the restricted local sandbox did not deliver events, and the suite passed outside it.

The fixture bundles include only `file-routing/runtime.js` from the new optional runtime helpers. Inspection found no generator/metadata compiler, Node filesystem, Nuxt or web Vue Router modules in either native bundle. The root runtime entry does not import the file-routing subpaths; the Vue compiler is an optional build peer. Generated module type declarations do not expose transitive compiler-library types.

The first two attempts of Native CI run `39209971540` stopped in the existing demo smoke suite before reaching any new file-route checks. Attempt 1 failed the two initial Inbox-title assertions (the screenshot shows rendered content with the initial `Inbox` title, rather than `Inbox (2)`); the other 23 checks passed with no JavaScript errors. Attempt 2 captured a `Pixel Launcher isn't responding` dialog covering the app and failed ten early UI checks; subsequent restoration, modal, drawer and timing checks passed. The cold-start title cause is not established, and this feature does not claim to fix it. The launcher ANR is a distinct emulator failure. Those results are not counted as file-route acceptance passes.

Filesystem watching and native table updates are verified as separate stages. This does not claim a turnkey filesystem-to-device HMR plugin: public webpack installation, watch delivery, automatic imports, compatibility setup and recordings remain in #92. Existing Vue component HMR is unchanged. This pass does not add physical-device, screen-reader, process-death, multi-window or interactive gesture coverage; saved-entry migration remains app-owned.
