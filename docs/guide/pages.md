# Every page keeps its route

Pushing a page doesn't destroy the one below: it stays mounted until it leaves the stack. That's why `useRoute()` inside a page returns that page's route, and it never changes. While `/messages/2` sits on top of `/messages/1`, the first page still sees `id: '1'`, and nothing re-runs because another page moved.

Outside pages (in `App.vue`, for example), `useRoute()` follows the page on screen. `router.currentRoute` is always the page on screen, and `router.stack` is the whole stack, bottom to top, reactive:

```ts
const { stack } = useRouter()
const canGoBack = computed(() => stack.value.length > 1)
```

`useRouter()` inside a page navigates in the stack that page lives in: its tab, or its modal.

## Props

A route record's `props` works as in Vue Router: `true` passes the params as props, an object is passed as-is, a function maps the route. On top of that, `push` takes `props` for values that can't be params, like an object to preview while the real one loads.

## When a page comes back into view

A page that stays in the stack isn't mounted again when you return to it, so `onMounted` won't help you refresh it. Use these instead:

```ts
onPageActivated(() => refresh()) // shown, and every time the user comes back
onPageDeactivated(() => pause()) // covered by another page or a modal
```

When the page leaves the stack it is unmounted, so cleanup goes in `onUnmounted`.

## Pages with a lot to lay out

In NativeScript the JavaScript runs on the main thread, so a page that takes a while to build delays its own push animation: the frame waits for the view before it moves. Native apps animate first and fill in after. `<Deferred>` does that: it renders its `fallback` until the page is on screen, after the transition, and only then its content.

```vue
<Page>
  <ActionBar title="Report" />
  <Deferred>
    <template #fallback><ActivityIndicator busy /></template>
    <ReportBody :report="report" />
  </Deferred>
</Page>
```

Measured on an Android emulator with a page of 400 rows in a `StackLayout`: the transition finished 1.1 to 2.7 seconds after the tap; with the rows inside `<Deferred>`, 0.3 to 0.7 seconds. The rows themselves take about as long to appear as before, since the work doesn't go away: it happens after the page is up instead of before. For long lists, a `ListView` or `CollectionView` is still the answer, since they only build what's visible.
