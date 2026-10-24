# Native capabilities and container choices

Try [Fieldnotes, the integrated native example](./native-showcase), to follow drawer, search, shared actions, guards and a modal result in one app.

Start with what your application needs to show, then choose the native owner. NativeScript supplies page headers and controls; the router supplies route identity, guards, results and coordination between native stacks. The application supplies content, business actions and persistence policy.

This page describes the repository's upcoming **0.1.0-rc.3**. The currently published baseline is **0.1.0-rc.2**. “Existing” below means already available in rc.2; “rc.3” identifies additions that require the new candidate or a local repository build. The package is still a release candidate, not a 1.0 stability promise. Detailed guides remain the API reference.

## Find a capability

Examples below are repository paths. Follow the [demo setup](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/README.md); build the package before running an opt-in example. The [compatibility table](./compatibility) records dependency baselines.

| Need                                         | Owner / availability                                              | Platform boundary                                                                                                     | Guide and runnable source                                                                                                                                                                                           |
| -------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native header and page buttons               | Core `ActionBar` / `ActionItem`; existing                         | UIKit navigation bar on iOS, native Toolbar on Android                                                                | [Native bars](./native-bars); [`Inbox.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Inbox.vue), normal demo                                                                        |
| Collapsing large title                       | Core `ActionBar iosLargeTitle`; existing                          | iOS with native scrolling content. Standard Android ActionBar has no equivalent collapsing Material app-bar policy    | [Native bars](./native-bars); normal demo Inbox                                                                                                                                                                     |
| Native page search                           | Router `useNativeSearch`; existing                                | iOS `UISearchController`; Android SearchView in the existing ActionBar title view                                     | [Search ownership](./native-bars#search-owned-by-a-page); normal demo Inbox                                                                                                                                         |
| Item context actions and preview             | Router menu integration, app callbacks; existing                  | iOS native preview/menu; Android native popup with explicit open action                                               | [Context menus](./context-menus); [`MessagePreview.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/components/MessagePreview.vue), normal demo Inbox                                       |
| Shared header/menu/keyboard actions          | Router `usePageActions` / `PageActionItem`; **rc.3**              | Shared eligibility/busy/error handling across supported native surfaces; application still performs save/share/delete | [Page actions](./page-actions); [`actions-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/actions-app.ts), `--env.actionsTest`                                                  |
| Keyboard commands                            | Router registration and native key dispatch; existing             | Physical keyboard/platform shortcut behavior differs                                                                  | [Keyboard](./keyboard); [`navigation-commands.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/navigation-commands.ts), normal demo                                                          |
| Drawer / persistent custom menu              | Router `RouterDrawer`                                             | Android overlay existing; iOS overlay and adaptive/permanent presentation **rc.3**                                    | [Drawer](./drawer); [`adaptivedrawer-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/adaptivedrawer-app.ts), `--env.adaptivedrawerTest`                                         |
| Independent tab histories / iPad tab sidebar | Router `RouterTabs` with native hosts; existing                   | UIKit tabs/sidebar on iOS 18+; Android Material bottom navigation/rail with documented Core fallback                  | [Tabs](./tabs); [`App.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/App.vue), normal demo                                                                                                |
| Adaptive list/detail                         | Router `RouterSplitView`, separate native Frames; existing        | Cross-platform, including optional Android fold geometry                                                              | [Split](./split-view); normal demo Inbox                                                                                                                                                                            |
| UIKit-controlled split columns               | Router `RouterUIKitSplitView`; experimental, existing             | iOS 18+; owns the window root. Not a child of a drawer or tabs                                                        | [UIKit split](./split-view#opt-in-uikit-columns); [`uikitsplit-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/uikitsplit-app.ts), `--env.uikitsplitTest`                       |
| Native modal and typed result                | Router route presentation, native modal host; existing            | Inner history is separate; sheet behavior/dependencies differ                                                         | [Modals](./modals); [`Compose.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Compose.vue), normal demo                                                                              |
| Zoom / shared elements / predictive Back     | UIKit/Core transitions and router coordination; existing          | iOS zoom needs 18+ and runtime API; Android progress needs 14+. No universal interactive controller                   | [Transitions](./transitions), [ownership limits](./interactive-transitions); [`Transitions.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Transitions.vue), Settings in normal demo |
| Navigation diagnostics                       | Router opt-in collector/export; existing. Browser viewer **rc.3** | Logical/native state and timings, not native heap/FPS or live time travel                                             | [Diagnostics](./diagnostics), [viewer](./diagnostics-viewer); [`Diagnostics.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Diagnostics.vue), Settings in normal demo                |
| Multiple native windows / recreation         | One router per native window; existing                            | Published dependency baseline and platform-specific session/task reconstruction tests                                 | [Windows](./windows); [`windows-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/windows-app.ts), `--env.windowsTest`                                                            |

Flags run from `demo`, for example `ns run ios --env.actionsTest` or `ns run android --env.actionsTest`. iOS-only fixtures require iOS. Large titles, headers, search and menus do not require a new “Native Navigation Headers” subsystem.

## Choose a container

| Container                  | What it owns                                                       | Use it when                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `RouterView`               | One native Frame and its route stack                               | You need ordinary push/back navigation.                                                                                              |
| `RouterTabs` + `RouterTab` | Destination selection and the Frames mounted in each tab           | Destinations should retain independent histories. `sidebar` changes UIKit's tab presentation; it does not create a generic drawer.   |
| `RouterDrawer`             | A menu around already-mounted content; no route history of its own | You need custom navigation content or an adaptive persistent menu. Its buttons choose whether to push, open a link or reset a stack. |
| `RouterSplitView`          | A Frame-based list/detail arrangement and its adaptation           | One logical flow should expand into panes. It can be drawer content or live inside a tab.                                            |
| `RouterUIKitSplitView`     | The window's native `UISplitViewController` and columns            | You explicitly want UIKit column/root ownership and accept the experimental/platform limits.                                         |

A permanent drawer, UIKit's tab sidebar and UIKit split columns may all look like a sidebar. Their history and controller ownership differ; choose by that ownership, not appearance alone.

## Compose a drawer with independent destinations

Keep the container and named Frames mounted. Adapt the drawer's `presentation` rather than switching entire keyed trees with `v-if`:

```vue
<RouterDrawer ref="drawer" presentation="auto" :breakpoint="840">
  <template #drawer>
    <StackLayout>
      <Button text="Inbox" @tap="router.openLink('/')" />
      <Button text="Settings" @tap="router.openLink('/settings')" />
    </StackLayout>
  </template>
  <RouterTabs>
    <RouterTab name="inbox" title="Inbox">
      <RouterView name="inbox" />
    </RouterTab>
    <RouterTab name="settings" title="Settings">
      <RouterView name="settings" initial="/settings" />
    </RouterTab>
  </RouterTabs>
</RouterDrawer>
```

This fragment belongs in an app installed with a router. Configure `links.frame` to choose `settings` for `/settings` and `inbox` otherwise; [the drawer guide](./drawer) and [runnable drawer fixture](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/drawer-app.ts) provide the full setup. `openLink` selects the owning destination as well as its stack. A successful navigation closes an overlay drawer; a rejected guard leaves it open. Selecting a destination is not an implicit history reset.

**Unsupported composition:** `<RouterDrawer><RouterUIKitSplitView /></RouterDrawer>` asks two containers to own incompatible native roots. Use `RouterSplitView` inside the drawer, or make `RouterUIKitSplitView` the window root and design its columns there. Do not remount a `RouterView` to simulate a transition; doing so discards its native history and page identity.

## State, focus and accessibility

A retained Page keeps its Vue state while another page covers it. `usePageState` opts small serializable state into restoration after process death; it does not preserve promises or native objects. Search query ownership belongs to the application, and search activation must target the current eligible page. [Page actions](./page-actions) also reject execution from a covered, inactive or disposed owner.

Use native buttons with clear accessibility labels for drawer destinations, keep a Menu/Back alternative to gestures, and declare focus targets with [navigation focus](./accessibility). Honor Reduce Motion. Automated native hierarchy checks are not evidence of spoken VoiceOver/TalkBack focus. Each linked validation report states its limits.

## Proposals are not shipped capabilities

The [interactive-transition investigation](./interactive-transitions) proposes boundaries, not a new common API or a Jolt integration. The [Core-owned Android preview](./android-back#experimental-core-owned-preview) requires an unreleased pinned candidate; Core 9.1.3 falls back. A collapsing Material Android app bar, live diagnostics transport and arbitrary custom-host gesture parity are not promised by this overview.
