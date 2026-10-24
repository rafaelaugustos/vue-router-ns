# Pages, stacks and state

A route describes where to go. A native stack owns the pages that were opened. `RouterView` creates a NativeScript Frame; the router coordinates navigation and follows that Frame's native history.

The distinction matters when you return from a detail page, switch tabs or close a modal. Follow the example below one step at a time.

<StackModel />

## A page is an entry with its own lifetime

`push` adds a new entry. The page below stays mounted. A local `ref` such as a list query belongs to that retained page and is still there after Back. `replace` removes the current entry; Back removes the top entry. Removed pages are unmounted.

Inside a routed page, `useRoute()` refers to **that page's route**. Opening another page does not turn every underlying page into the new destination. `useRouter()` is scoped to the page's owning stack. Outside pages, `router.currentRoute` can drive application-level navigation UI; it is not a substitute for a page's own `useRoute()`.

| State                           | Put it here                                         | Lifetime                                             |
| ------------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| List query or scroll-related UI | Page-local refs/native views                        | While that page entry is retained                    |
| Unsaved editor text             | Editor page-local ref                               | Until the editor is removed, unless explicitly saved |
| Note data shared by list/detail | Application store                                   | Whatever persistence the application implements      |
| State after process death       | Application storage and optional router restoration | Must be serialized and recovered explicitly          |

Retained pages are not persistent storage. The [first app](./first-app) keeps notes in memory; closing the process loses them. See [restoration](./restore) when the app needs recovery after process death.

## Visibility is different from mounting

Opening a detail or modal can cover a page without removing it. Returning does not call its `onMounted` again. Use `onPageActivated` to refresh when shown, `onPageDeactivated` to pause work while covered, and `onUnmounted` for final cleanup. The [page lifecycle guide](./pages) explains these hooks.

## Containers own different things

- A `RouterView` owns one Frame stack.
- Tabs can select among named stacks; switching tabs does not mean starting their histories again.
- A drawer surrounds existing content. Opening it creates no route entry; its buttons decide which navigation to request.
- A modal route receives a separate Frame. `useRouter()` inside it navigates that modal's stack; Back at its root closes the modal.
- A split layout has explicit compact/expanded history rules. Choose the supported owner before composing it with other containers.

Use [container choices](./capabilities#choose-a-container) before nesting components. More containers do not automatically mean independent histories.

## Native Back and guards

The app can request `router.back()`, and the platform also has native buttons and gestures. The router synchronizes completed native navigation with its state. Leave guards apply when a page would be **removed**, not simply covered by a push.

An iOS interactive gesture cannot wait for an asynchronous confirmation. An active leave guard disables that page's swipe-back; using `{ when: dirty }` leaves it available while clean. Native button, modal and Android behavior have their own supported paths. See [guards](./guards) for the platform matrix.

**Next:** [build the flow](./first-app) or [choose containers for your app](./capabilities).
