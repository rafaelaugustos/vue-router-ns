# Build your first app

Build **Pocket notes**: search a short list, open a note, edit it in a native modal and return the saved text. A leave guard protects an unsaved draft. Back returns to the same list with its query intact.

This tutorial uses explicit routes and public APIs. It assumes basic Vue single-file components and the [NativeScript-Vue project setup](./install). The notes are fictional and in memory; this example does not implement persistence, authentication or a backend.

<Clip name="first-app" caption="Pocket notes on an iOS 26 simulator: retained list query, native modal editor, refused cancellation and saved result. The same tutorial source runs in the demo." />

## 1. Create the files

After installing the router, put these **seven complete files** under the app's `src` directory. Replace the starter app entry/root with the files below; keep its native resources and build configuration. Code is embedded directly from the runnable [tutorial source](https://github.com/rafaelaugustos/vue-router-ns/tree/main/demo/src/tutorial), so both language guides use the same implementation.

```text
src/
  app.ts
  App.vue
  router.ts
  notes.ts
  pages/
    Home.vue
    Note.vue
    Edit.vue
```

The root `RouterView` creates a native Frame. Each route component renders a Page. Do not wrap this RouterView in another Frame.

**`src/router.ts`** — `/` owns the list, `:id` selects a note, and `modal: true` gives the editor its own Frame. `props: true` passes the route params into the page.

<<< ../../demo/src/tutorial/router.ts

**`src/app.ts`** — install the router before starting the app.

<<< ../../demo/src/tutorial/app.ts

**`src/App.vue`** — keep the navigation host mounted.

<<< ../../demo/src/tutorial/App.vue

## 2. Add data and the list

**`src/notes.ts`** — application data shared by the list, detail and editor. Saving changes this reactive array; it does not write to disk.

<<< ../../demo/src/tutorial/notes.ts

**`src/pages/Home.vue`** — `query` belongs to this page. Opening a note covers Home; it does not destroy the page or its query.

<<< ../../demo/src/tutorial/pages/Home.vue

This two-item list uses normal native Buttons. For a large catalog, use a virtualized list. The TextField is a simple beginner search input; [native header search](./native-bars) is a later enhancement.

## 3. Open a detail and wait for a result

**`src/pages/Note.vue`** — the `id` prop belongs to this route entry. `pushForResult<string>` waits for the editor; closing without a result returns `undefined`. Checking explicitly preserves an intentionally empty saved string.

<<< ../../demo/src/tutorial/pages/Note.vue

The originating detail stays mounted while the modal is open. The generic type describes the contract between these two pages; it does not validate arbitrary data at runtime.

## 4. Protect the draft, then save

**`src/pages/Edit.vue`** — the draft is local to the editor. A conditional leave guard asks only while the draft differs from the saved note. Saving temporarily allows departure and returns the draft through `back({ result })`.

<<< ../../demo/src/tutorial/pages/Edit.vue

Cancel requests navigation through the guard. Choosing **Keep editing** keeps the editor mounted with its draft. Choosing **Discard** closes it without changing the note. Saving returns the value to the detail page, where application code updates `notes`.

A leave guard is about removing a page, not covering it. On iOS, an active guard changes which gestures can dismiss or pop a page. See the [guard platform matrix](./guards#what-the-platform-does-while-a-guard-is-active) rather than assuming every gesture can wait for a dialog.

## 5. Run and check the complete flow

In the NativeScript-Vue project you created:

```sh
ns run ios
# or:
ns run android
```

1. Type `coast` in **Find a note**. Only **Along the coast** remains.
2. Open that note, then tap **Edit in a modal**.
3. Change the text. Tap **Cancel → Keep editing** and confirm the draft remains.
4. Tap **Save note**. The original detail page shows the returned text.
5. Use native Back. Home still contains `coast`, and its filtered list is unchanged.
6. Open the editor again, change the text and choose **Cancel → Discard**. The last saved text stays unchanged.

If you prefer the repository version, follow the [checkout/resource setup](./native-showcase#run-from-a-checkout), then run `npm run tutorial:ios` or `npm run tutorial:android` from `demo`. Pass `-- --device <id>` to choose a device. The tutorial shares the demo application ID, so installation replaces the other demo entry on that device.

## What to build next

You now have one retained stack, a modal stack, a page-local draft and an application-owned result. Revisit the [interactive stack model](./mental-model) to see those lifetimes separately.

Continue with [Fieldnotes](./native-showcase) to add a drawer, page-owned native search, shared header/menu actions and explicit navigation focus. Choose [tabs or split navigation](./capabilities) when the app needs a different structure. Add [persistent storage/restoration](./restore) when state must survive process death.
