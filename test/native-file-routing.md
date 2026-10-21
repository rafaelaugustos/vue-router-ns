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

Native CI runs `39209971540` (attempt 1) and `39213818295` stopped at the existing demo's two initial Inbox-title assertions before reaching file routing; their other 23 checks passed. The screenshot showed rendered content with the initial `Inbox` title and empty history. A deterministic regression now reproduces native completion preceding Vue's Page mounted hook: the router previously reconciled before the Page was registered, leaving an empty stack and skipping activation. Completion now retains the previous stack until that destination is linked, covering startup, push, replace and clear-history without duplicate `afterEach` notifications. This explains the observed symptoms; native CI must also validate the fix.

Attempt 2 of `39209971540` separately captured a `Pixel Launcher isn't responding` dialog covering the app and failed ten early UI checks; subsequent restoration, modal, drawer and timing checks passed. That launcher ANR is distinct from the synchronization regression. Failed runs are not counted as file-route acceptance passes.

That #89 pass verified filesystem watching and native table updates as separate stages. The #92 pass below additionally verifies the public plugin through actual CLI-to-device HMR. Existing Vue component HMR is unchanged. Neither pass adds physical-device, screen-reader speech, process-death, multi-window or interactive gesture coverage; saved-entry migration remains app-owned.

## Public setup and live HMR — #92

The separate `examples/file-routing` application uses the public `file-routing/webpack` plugin and `file-routing/setup` API. It has generated native collection/detail pages, a discovered layout, global/auth middleware, a result-returning modal, two tab stacks and an explicit `/about` route.

| Environment                   | Live acceptance                   |
| ----------------------------- | --------------------------------- |
| Android API 36 arm64 emulator | 22/22 passed, run `1792398148983` |
| iPhone 17 simulator, iOS 26.0 | 22/22 passed, run `1792398359495` |

The runner, `scripts/native/conventions-watch.mjs`, launches `ns run` with native HMR. After the baseline flow it actually edits metadata, creates a page, renames it while open, removes it while open, introduces a duplicate route name, and corrects it. Assertions require the original native Page objects and drafts to survive, including the other tab's stack. Future navigation must receive the revised metadata, and Back must return to retained entries whose files have moved or disappeared. No host/router methods are patched. The driver restores its source edits and stops its own processes in `finally`.

The baseline covers real Frame push/back and parameters, layout Page/ActionBar ownership, global middleware, cancelled auth before mounting, auth redirect/allow, typed modal results, explicit/generated coexistence and retained state. Focus assertions check a registered layout focus owner, a real loaded native heading target, covered-page accessibility hiding and visibility restoration after modal dismissal. They complement, rather than replace, the separate VoiceOver/TalkBack acceptance in `native-accessibility.md`.

The real webpack-watch regression also covers an invalid initial build, scope-safe macro auto-imports, excluded child components, and recovery after a later generation error. A failed generation must preserve **both** the emitted files and webpack's previous HMR record/hash. Otherwise the corrected build refers to an update the device never received. The public plugin now prevents recording failed generations, and native recovery passes on both platforms.

Both bundles were inspected with `examples/file-routing/scripts/check-bundle.mjs`: one NativeScript-Vue/Core/runtime-core instance, the native file-route updater, and no scanner, AST/compiler, Node filesystem, Nuxt, Vue Router or DOM renderer modules. The local example resolved NativeScript webpack 5.0.39, webpack 5.112.0, compiler-sfc 3.5.44 and TypeScript 6.0.3 on Node 20.19.4. NativeScript-Vue/Core and native runtimes are the versions listed above.

The ordinary CI lane prepares, typechecks, builds and inspects both platform bundles from a clean checkout on Node 22. The existing Native Android job runs the live watch fixture after the explicit-demo, drawer, middleware, layout and low-level file-route fixtures. The [setup guide](../docs/guide/file-routing.md) publishes the matrix and includes actual native recordings on both platforms. iOS execution is a local simulator check; it is not presented as an iOS CI lane.

Open entries retain snapshots for route-table changes; edits to component code can trigger the existing Vue remount behavior. Adding/removing/renaming discovered layout or middleware registrations requires restarting the app. Standalone declarations describe the last prepared platform, so platform type preparation/checking is sequential. The integration remains optional and experimental.
