# Page actions

Define an action once in a routed page and reuse its state and callback in the native header and context menu. `usePageActions` composes with NativeScript's `ActionBar`, the existing route menus and keyboard commands; it does not replace the native navigation controller or back button.

<Clip name="page-actions" caption="Shared header/menu actions, disabled state, localization and errors in the actual native app." />

```vue
<script setup lang="ts">
import { ref } from 'nativescript-vue'
import { usePageActions, vRoutePreview } from 'vue-router-ns'

const title = ref('Save')
const canSave = ref(true)
const errorMessage = ref('')
const actions = usePageActions(
  [
    {
      id: 'save',
      title,
      enabled: canSave,
      busyTitle: 'Saving…',
      image: 'square.and.arrow.down',
      async run({ signal }) {
        // Your application implements persistence and honors cancellation.
        await saveDraft({ signal })
      },
    },
    { id: 'details', title: 'Details', run: ({ router }) => router.push('/details') },
  ],
  {
    onError: (error) => {
      errorMessage.value = String(error)
    },
  },
)
// Keep the options object stable while only action state changes.
const menu = { to: '/details', actions: actions.menu(['save', 'details']) }
</script>

<template>
  <Page>
    <ActionBar title="Editor">
      <PageActionItem :actions="actions" action="save" ios.position="right" />
      <!-- Ordinary ActionItems can coexist here. -->
    </ActionBar>
    <StackLayout>
      <Label v-route-preview="menu" text="Hold for actions" />
      <Label :text="errorMessage" textWrap="true" />
    </StackLayout>
  </Page>
</template>
```

`PageActionItem` is registered by the router plugin and can also be imported. Put it inside the owning routed page's ActionBar. Refs and getters keep titles localized without rebuilding the registry. `saveDraft` above is application code, not a router API.

## Definition and execution

`usePageActions(source, { onError? })` accepts an array, ref or getter. IDs must be unique and non-empty within that registry; literal IDs are inferred by TypeScript.

| Action field                    | Meaning                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `id`, `run({ router, signal })` | Stable ID and synchronous or asynchronous application callback.                   |
| `title`, `busyTitle?`           | String, ref or getter; the busy title replaces the normal title while running.    |
| `enabled?`, `visible?`          | Boolean, ref or getter; both default to true.                                     |
| `destructive?`                  | Boolean, ref or getter. Presentation only; confirmation remains application code. |
| `image?`                        | SF Symbol name, ref or getter, for the iOS context menu only.                     |

The returned `get(id)` and `list()` expose resolved state (`id`, `title`, `enabled`, `visible`, `busy`, `image`, `destructive`). `busy` is a readonly ref containing the running ID or `undefined`. `menu(ids?)` produces bindings for `RouteMenuOptions.actions`; the selected IDs are captured when called, while their state stays live. Regenerate the bindings if the set of IDs changes.

Each registry admits one callback at a time. While it is running, all its actions are disabled across every surface. Repeated taps return false instead of queueing. Separate registries are independent.

- `await actions.execute(id)` returns true when the callback fulfills, false when unavailable, and rejects ordinary failures. True describes callback completion, **not navigation success**: inspect the router's navigation failure result inside `run` when needed.
- `await actions.dispatch(id)` is the event adapter used by headers and menus. It reports failures once through `onError(error, id)` and resolves false. Without a handler, failures are logged in development and production; a throwing error handler is also contained and logged.
- A callback that rejects with `AbortError` after its disposal signal aborts resolves false. A callback that ignores cancellation and fulfills still resolves true, including an action that successfully pops its own page.

## Page lifetime and navigation

New dispatch requires the owning page to be current, loaded, in the selected tab, uncovered by a modal, and outside a pending navigation. Header and menu callbacks recheck this before executing. A registry cannot be attached to a different page or window. Use the supplied **page-scoped router** for navigation so the existing guards, results and originating stack continue to apply. The router does not implement your share, edit, delete, persistence or confirmation logic.

Disposal of the page/host and HMR replacement abort the signal and retire the old bindings. Covering a page with a detail or modal, or changing tabs, blocks new dispatch but does not abort a running operation. Async business code must honor `signal`, including before side effects after an `await`; the router cannot undo an ignored request. A genuine late failure is still reported after disposal. Waiting for `router.pushForResult()` is supported.

For recycled rows, provide a **fresh options object when the source item changes**, for example `v-route-preview="menuFor(item)"`. Rebinding, unloading and detaching dismiss/invalidate the previous menu, so old native callbacks and preview commits cannot operate on the new item. Keep the options object stable for live title/enabled updates while the menu is open. Capture item identity in application code when a running operation must continue to target that item after rebinding.

## Native presentation

| Surface                 | Supported presentation                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Header, iOS and Android | A NativeScript ActionItem with a native text Button as `actionView`. Reactive title, visibility, disabled accessibility state and destructive text color. `buttonClass` styles the Button. |
| iOS context menu        | UIAction title, SF Symbol, disabled and destructive attributes. Open menus update on iOS 14+; iOS 13 reads initial state and always rechecks on selection.                                 |
| Android context menu    | Native PopupMenu titles, visibility and enabled state, including updates while open. No icon mapping or destructive color.                                                                 |

The header adapter is text-only. NativeScript places custom ActionViews directly in the Android ActionBar, so `android.position="popup"` is not supported by this adapter. Use ordinary ActionItems for other native header presentations. SF Symbols are not mapped to Material icons. No toolbar, search controller or navigation delegate is installed, and `backAction` stays under its existing owner. See [native bars](./native-bars) and [context menus](./context-menus).

## Optional keyboard binding

Reuse the existing registry rather than installing another keyboard dispatcher:

```ts
const commands = useNavigationCommands([
  {
    id: 'save',
    title: () => actions.get('save')!.title,
    enabled: () => actions.get('save')!.enabled,
    shortcut: { input: 's', modifiers: [isIOS ? 'meta' : 'ctrl'] },
    action: () => actions.dispatch('save'),
  },
])
```

Import `useNavigationCommands` from `vue-router-ns` and `isIOS` from `@nativescript/core`. Mount the existing `NavigationCommandScope` as shown in [keyboard commands](./keyboard). Its focus, text-input, IME and system-shortcut rules remain in force. Nothing registers a shortcut automatically.

The repository includes reproducible native input checks and limitations in `test/native-page-actions.md`.
