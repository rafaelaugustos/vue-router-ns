# Android drawer validation — #43

2026-10-18. NativeScript Android runtime 9.1.1, core 9.1.3 and NativeScript-Vue 3.1.2. The tested APK includes AndroidX DrawerLayout 1.1.1, Activity 1.8.1 and Material 1.8.0.

## Native host and navigation policy

The host stays in this package: a small NativeScript `LayoutBase` adapter around AndroidX `DrawerLayout`, using the runtime's existing AppCompat dependencies. It needs neither a separate plugin nor a core patch. AndroidX owns dragging, settling, the scrim and accessibility isolation; Frames retain their normal page navigation. The menu is an app-owned slot of native views, so Material `NavigationView` is not required. The demo uses native buttons with route-driven selection and keyboard activation.

Destinations can use independent named `RouterView` or `RouterSplitView` stacks. Selecting a destination reveals its tab without discarding the other histories. A drawer button chooses its reselect policy: `openLink`/`push` navigates, while `backToRoot({ frame })` explicitly resets a stack. Selecting an already-current route closes the drawer. `backToRootOnReselect` belongs to tab reselect events. Opening and closing the pane alone never creates a route entry.

iOS renders the content without a sliding pane. The native iPad sidebar is available through `RouterTabs sidebar`; this Android component does not implement an iOS drawer.

## Device matrix

| Device                | Android        | Input                                                     |
| --------------------- | -------------- | --------------------------------------------------------- |
| Physical ASUS Z017DC  | 8.0.0 / API 26 | Back key, native edge dragging, touch and manual TalkBack |
| Medium Phone emulator | 16 / API 36    | Gesture navigation, touch and injected Tab/Enter          |

`demo/src/testing/drawer-app.ts`, built with `--env.drawerTest`, hosts three independent stacks inside a drawer. `scripts/native/drawer-android.mjs` drives the real app and saves screenshots, compressed accessibility hierarchies and `results.json`. The `Native` workflow also runs this fixture on API 34 after the normal demo's smoke suite. Build/run instructions are in [`scripts/native/README.md`](../scripts/native/README.md).

## Native acceptance

All 13 automated scenarios passed on API 36. On the ASUS, 11 automated scenarios passed; process restoration, Tab/Enter activation and the final OS deep link were then completed directly through adb, covering all 14 device scenarios. The process-kill fallback described below was added to the runner afterward.

| Check                            | Observed behavior                                                                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ActionBar and native container   | Menu opens the 280 dp pane over the existing Frames. The covered page is excluded from the compressed accessibility tree. Destinations are focusable native buttons.             |
| Back with the drawer open        | Back closes the pane without changing the page or its history.                                                                                                                   |
| Start-edge dragging              | On the ASUS, a drag opens the left pane in LTR and the right pane in RTL. Android 16's system Back owns that edge; the ActionBar button remains available.                       |
| Destination selection and guards | Touch navigates and closes the drawer. Refusing a leave guard keeps both the pane and the current detail page.                                                                   |
| Independent stacks               | Home retains `/ > /detail` and its draft after visiting Settings and Account.                                                                                                    |
| Rotation and RTL                 | Rotating with the pane open retains it; the detail history and draft survive. Explicit RTL moves the pane to the right without rebuilding the stack. The manifest opts into RTL. |
| Modal precedence                 | With `closeOnNavigate` disabled, Back dismisses the dialog first and leaves the underlying drawer open. The next Back closes the drawer.                                         |
| Modal guards and results         | A rejected Back keeps the modal and drawer in place. Accepting the modal returns `accepted` to its caller.                                                                       |
| Material bottom sheet            | A native Material sheet receives Back before the underlying drawer.                                                                                                              |
| Process restoration              | After backgrounding and killing the process, a new PID restores `/ > /detail` and `drawer-state`. The transient open pane is not restored.                                       |
| Keyboard activation              | Tab reaches `Go settings`; Enter opens that destination and closes the pane.                                                                                                     |
| OS deep link                     | `vuerouterns://detail`, delivered while Settings and its drawer are visible, reveals Home's retained detail page and draft, then closes the pane.                                |

## Gesture and TalkBack checks

On API 36, injected `DOWN`/`MOVE` events displayed Android's Back indicator with the drawer open. `CANCEL` left the pane open; a committed edge swipe closed it while preserving the detail history and draft. Repeating cancellation and completion with a dialog above the pane kept the dialog on cancellation and dismissed only the dialog on completion. DrawerLayout 1.1.1 does not animate the pane with predictive progress: the router closes it on commit and does not preview a page underneath it.

On the ASUS, Rafael confirmed audible TalkBack feedback during the requested destination check. The resulting screen showed Settings open and the pane closed. The automated compressed hierarchy separately verifies that covered content is excluded. This is drawer-menu acceptance; the broader page-focus and VoiceOver matrix remains documented in [`native-accessibility.md`](./native-accessibility.md). TalkBack was restored to its original disabled setting afterward.

Use UIAutomator with TalkBack off: a dump temporarily suppresses other accessibility services and can interrupt its tutorial. The default, uncompressed hierarchy includes views marked unimportant for accessibility, so it is not evidence that TalkBack can reach covered content.

## Regressions fixed and automated coverage

- A guard rejection used to close the drawer through `afterEach`. It now stays open; selecting an already-current route still closes it.
- NativeScript emits a dialog's Back event globally before notifying its Frame. The global drawer claimant used to consume that event, closing the pane behind the modal. The router now leaves modal Back to its host, preserving guards and results. The test shim now reproduces core's event order.

The full unit suite passes with 328 tests and 8 skips, including 12 drawer tests. Type checking, the router build, demo TypeScript, normal and fixture Android builds, documentation build and package dry run pass. The native runner restores rotation settings after each run and reports restoration failures.

On the ASUS, Android retained the background app at previous-process priority, so `am kill` did not terminate it. Killing only the debug app's own PID through `run-as` exercised actual process death without force-stopping the task; the new PID restored the stack and draft. The runner includes this fallback. A separate startup attempt aborted in Android's RenderThread with `EGL_NOT_INITIALIZED`; reopening recovered without changing the APK.
