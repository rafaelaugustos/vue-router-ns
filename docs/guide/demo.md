# Examples and videos by feature

These clips come from the NativeScript-Vue mail app in [`demo/`](https://github.com/rafaelaugustos/vue-router-ns/tree/main/demo), running on iOS 26 and iPadOS 26 simulators and an Android 16 emulator. Each feature's guide includes its recording beside the code. The app uses local sample messages; it does not connect to an email service.

Clips are silent, loop while visible, and have playback controls. With Reduce Motion enabled, they wait for you to press play.

Pick a feature, watch the result, and copy the corresponding snippet. Examples use NativeScript components and the demo route table. In routed pages, obtain `router` with `useRouter()` inside `<script setup>`; in app configuration, use the instance returned by `createRouter()`. Import router components from `vue-router-ns`. Template snippets belong in the indicated component and do not replace the initial app setup.

[Installation](./install) · [Transition from an element](./transitions#card-with-routerlink) · [Complete demo](https://github.com/rafaelaugustos/vue-router-ns/tree/main/demo)

## Open a page from a card

<Clip name="ios-zoom" caption="The card opens the message with UIKit zoom and receives the return transition. iOS 26 simulator." />

The tapped element can be the source of UIKit’s native zoom. Give `RouterLink` a single child; Android and runtimes without the zoom API use the normal transition.

```vue
<RouterLink :to="{ name: 'message', params: { id: 1 } }" zoom>
  <StackLayout padding="24" borderRadius="16" backgroundColor="#dbeafe">
    <Label text="Ana" color="#1e3a8a" />
    <Label text="Lunch on Friday?" color="#1e3a8a" />
  </StackLayout>
</RouterLink>
```

[Complete example: card, list with `zoomFrom`, destination and routes](./transitions#card-with-routerlink). Zoom requires iOS 18+ and runtime support. In the demo, open Settings → Zoom from a card.

## Tabs with independent histories

Open a message, switch tabs, and return to the same message. Tap the selected tab again to return to its root. [Configure native tabs](./tabs).

<div class="clips">
<Clip name="ios-tabs" caption="UIKit tabs on iPhone, including reselect to root." />
<Clip name="android-tabs" aspect="9 / 20" caption="The same navigation with Material tabs on Android." />
</div>

<Clip name="ipad-tabs" :width="480" aspect="3 / 4" caption="UIKit's sidebar selects the same named stacks on iPad." />

```vue
<RouterTabs sidebar>
  <RouterTab name="inbox" title="Inbox" icon="tray.fill">
    <RouterView name="inbox" initial="/" backToRootOnReselect />
  </RouterTab>
  <RouterTab name="settings" title="Settings" icon="gearshape.fill">
    <RouterView name="settings" initial="/settings" backToRootOnReselect />
  </RouterTab>
</RouterTabs>
```

In the app root. `sidebar` enables the iPad sidebar; each `RouterView` retains its own stack. Navigating with `{ frame: 'settings' }` also selects that tab. [Full source](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/App.vue).

## Push, back and list/detail

The trail at the bottom is the live router stack. Opening another message adds an entry; Back to inbox removes the details in one navigation. A wide window keeps the list visible. [Navigation](./navigating) · [List and detail](./split-view).

<div class="clips">
<Clip name="ios-navigation" caption="Push two messages and return to the inbox on iPhone." />
<Clip name="ipad-split" :width="360" aspect="3 / 4" caption="Push messages into the detail pane while the inbox stays visible on iPad." />
</div>

```ts
await router.push({ name: 'message', params: { id: 1 } })
await router.push({ name: 'message', params: { id: 2 } })
await router.backToRoot()
```

In a wide window, replace the inbox `RouterView` with:

```vue
<RouterSplitView name="inbox" list="/" :breakpoint="840" :listWidth="320" />
```

Below the breakpoint, list and detail use single-column navigation. Above it, the list stays visible while details open. [Full source](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Message.vue).

## Sheets on both platforms

Compose uses a UIKit sheet with detents on iOS and a Material bottom sheet on Android. Both host a routed page with its own native navigation bar. [Modals and results](./modals).

<div class="clips">
<Clip name="ios-sheet" caption="Open, expand and close the compose sheet on iPhone." />
<Clip name="android-sheet" aspect="9 / 20" caption="Open the Material sheet and dismiss it with system Back." />
</div>

```ts
router.push('/compose', {
  modal: {
    ios: { detents: ['medium', 'large'], grabber: true },
    android: { sheet: { state: 'expanded', height: 520 } },
  },
})
```

Tap Compose, drag the sheet, and close it with Cancel or Back. Add Material to the Android release build as described in the [guide](./modals). [Full source](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Inbox.vue).

## Preview before navigating

A long press shows a message preview and actions. Tapping the preview opens the route. [Context menus](./context-menus).

<Clip name="ios-context-menu" caption="UIKit's native preview and the resulting message page." />

```vue
<RouterLink to="/messages/1" :menu="{ preview: MessagePreview, props: { id: 1 } }">
  <Label text="Lunch on Friday?" padding="24" />
</RouterLink>
```

Import `MessagePreview` from `demo/src/components/MessagePreview.vue`. Previewing does not add a page to the stack; tapping the preview commits navigation. Android presents a menu without a live preview. [Full source](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Inbox.vue).

## Guards and form restoration

Account requires a session. The guard redirects to sign-in, and typing a name activates a leave guard. On Android, that form state can also survive the operating system killing the background process. [Guards](./guards) · [Restoration](./restore).

<div class="clips">
<Clip name="ios-guards" caption="Stay keeps the typed name; Leave allows the page to close." />
<Clip name="android-restore" aspect="9 / 20" caption="Type a name, background the demo, kill its process, then reopen with the form restored." />
</div>

```ts
import { Dialogs } from '@nativescript/core'
import { ref } from 'nativescript-vue'
import { onBeforeRouteLeave, usePageState } from 'vue-router-ns'

const name = ref('')
onBeforeRouteLeave(() => Dialogs.confirm('Discard this draft?'), {
  when: () => name.value.trim() !== '',
})
usePageState<{ name: string }>('form', {
  save: () => ({ name: name.value }),
  restore: (saved) => {
    name.value = saved.name
  },
})
```

Bind `name` to a `<TextField v-model="name" />`. Persistence after process death also requires [`restore.save` and `restore.load`](./restore). The authentication guard lives in [`demo/src/router.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/router.ts). [Full source](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Login.vue).

## Native search and drawer

Search filters the current page without adding routes. The Android drawer takes destinations through the router's link policy and closes before a page is popped. [Native search](./native-bars) · [Drawer](./drawer).

<div class="clips">
<Clip name="ios-search" caption="The page owns its native search field and query." />
<Clip name="android-drawer" aspect="9 / 20" caption="Select Settings from the drawer, then close the drawer with system Back." />
</div>

```ts
import { computed, ref } from 'nativescript-vue'
import { useNativeSearch } from 'vue-router-ns'

const query = ref('')
const messages = [{ subject: 'Lunch on Friday?' }, { subject: 'Release notes' }]
const search = useNativeSearch({ query, placeholder: 'Search messages' })
const filtered = computed(() =>
  messages.filter((message) =>
    message.subject.toLowerCase().includes(query.value.toLowerCase()),
  ),
)
```

Use `filtered` as a `ListView`’s `:items` and call `search.activate()` from an `ActionItem`. For the drawer, declare `const menuOpen = ref(false)` in the app root and toggle it from a button:

```vue
<RouterDrawer v-model:open="menuOpen">
  <template #drawer>
    <StackLayout>
      <Button text="Inbox" @tap="router.push('/')" />
      <Button text="Settings" @tap="router.push('/settings')" />
    </StackLayout>
  </template>
  <RouterView />
</RouterDrawer>
```

This minimal example has one stack. The full demo combines drawer and tabs; on iOS the content remains visible and the drawer is omitted. [Full source](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/App.vue).

## Choose file conventions

The separate collection example uses generated routes, a native layout, authentication middleware and a typed modal result. Both authoring styles use the same native router. [Optional setup and source](./file-routing).

<div class="clips">
<Clip name="ios-file-routing" caption="Generated routes on iOS: detail, modal result and guarded account." />
<Clip name="android-file-routing" aspect="9 / 20" caption="The same collection flow on Android native Pages." />
</div>

```text
src/pages/
  index.vue          → /
  messages/[id].vue  → /messages/:id
  compose.vue        → /compose
```

Choose the [webpack or Vite](./file-routing) plugin to generate this table. The [layouts](./layouts) and [middleware](./middleware) examples show how to add conventions; declaring `routes` in TypeScript remains an independent option. [Full source](https://github.com/rafaelaugustos/vue-router-ns/blob/main/examples/file-routing/README.md).

## Receive a result from another page

<Clip name="ios-modal-result" caption="Reply opens the modal; Send returns the text to the originating message through pushForResult. iOS 26 simulator." />

Open Reply in a message. On send, the reply appears on the page that opened the modal.

```ts
import { ref } from 'nativescript-vue'
import { useRouter } from 'vue-router-ns'

const router = useRouter()
const reply = ref<string>()
async function compose() {
  reply.value = await router.pushForResult<string>('/compose')
}
```

In Compose, call `router.back({ result: text.value })`. Closing without sending resolves with `undefined`. The type describes the contract between pages. [Guide](./modals) · [Full source](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Message.vue).

## Open a link in the correct tab

<Clip name="ios-deep-link" caption="The system delivers vuerouterns://settings/account. Settings is selected and its guard opens login. iOS 26 simulator." />

In app configuration, use the same stack names as `RouterTabs`.

```ts
const router = createRouter({
  routes,
  links: {
    schemes: ['https', 'vuerouterns'],
    hosts: ['vue-router-ns.rafaelaugusto.dev'],
    frame: (to) => (to.path.startsWith('/settings') ? 'settings' : 'inbox'),
  },
})

await router.openLink('vuerouterns://messages/1')
```

Also try `vuerouterns://settings/account` while signed out: the guard should open login in Settings. OS URL delivery requires native scheme/domain association configuration; `openLink()` tests dispatch within the app. [Setup and notification examples](./deep-links).

## Shortcuts on the app icon

<Clip name="ios-shortcuts" caption="Long-press the demo icon and choose New message to open its route through a native quick action. iOS 26 simulator." />

Publish destinations after the app is ready, as in `demo/src/app.ts`.

```ts
router.setShortcuts([
  {
    id: 'compose',
    title: 'New message',
    to: '/compose',
    icon: { ios: 'square.and.pencil' },
  },
  { id: 'settings', title: 'Settings', to: '/settings' },
])
```

Long-press the app icon in the launcher/SpringBoard and choose New message. The route uses the same guards. Use `setShortcuts([])` to remove dynamic shortcuts on sign-out. [Limits and pinned shortcuts](./deep-links).

## Attach a system document

<Clip name="ios-document-picker" caption="Attach opens the iOS document picker. Cancelling returns to the form with Picker cancelled, without adding a route." />

In a routed page’s setup, prepare the picker and call `attach()` from an Attach button.

```ts
import { ref } from 'nativescript-vue'
import { createDocumentPicker, useNativeFlow } from 'vue-router-ns'

const attachments = ref<string[]>([])
const picker = useNativeFlow(createDocumentPicker())
async function attach() {
  const outcome = await picker.run({ types: ['application/pdf'], multiple: true })
  if (outcome.status === 'completed') attachments.value = outcome.value.uris
  else if (outcome.status === 'failed') console.error(outcome.error)
}
```

Choose a PDF or cancel. The page stays at the same history entry; cancellation retains the previous selection. URIs do not guarantee permanent permission: reading and persisting access belong to the app. [Complete picker and lifecycle](./native-flows).

## Return focus to the button that opened a modal

With VoiceOver or TalkBack enabled, open and close Reply. Focus should return to the initiating button.

```ts
import { useNavigationFocus, useRouter } from 'vue-router-ns'

const router = useRouter()
const focus = useNavigationFocus({ initial: 'heading', return: 'reply' })
async function reply() {
  focus.remember('reply')
  await router.pushForResult('/compose')
}
```

```vue
<Label id="heading" text="Message" accessible="true" />
<Button id="reply" text="Reply" @tap="reply" />
```

Place the controls inside the page. This is accessibility focus, not keyboard focus. The default `motion: 'system'` respects reduced motion. [Complete example and limits](./accessibility).

## Build a stack with a predictable way back

Use a list of destinations when an entry point needs a specific history.

```ts
await router.setStack(['/', '/messages/1', '/messages/2'])
await router.back()
await router.backToRoot({ animated: false })
```

After `setStack`, Back opens message 1; the last command returns to the inbox without animation. Guards can interrupt the sequence, and completed steps remain. [Setting the stack](./stack).

## More complete examples

- [Keyboard commands](./keyboard): Cmd/Ctrl, Escape and page scopes.
- [Typed routes](./typed-routes): names and parameters checked by TypeScript.
- [Native destinations](./native-destinations): integrate UIViewController and Fragment (experimental).
- [Predictive back](./android-back): Android gesture previews and cancellation.
- [Diagnostics](./diagnostics): observe failures, transitions and history.

The videos are recordings of native navigation. The focus example includes VoiceOver/TalkBack steps: a silent video does not demonstrate screen-reader announcements.

## Run the same app

Install the [NativeScript CLI](https://docs.nativescript.org/setup/), then build the local router from the repository root:

```sh
npm install
npm run build
cd demo
npm install
ns run ios
# or: ns run android
```

The demo resolves `vue-router-ns` from the local `dist` directory. Use `npm run dev` in a separate terminal while changing the router. See the [demo README](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/README.md) for the APIs used by each page.
