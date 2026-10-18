# Context menu previews

Long-press a row, see where it leads, then decide. On iOS, `UIContextMenuInteraction` shows a preview of the destination with a menu of actions, and tapping the preview commits it into a navigation. Android has no live preview, so the same options become a popup menu: the route first, then the actions.

```vue
<script setup lang="ts">
import { vRoutePreview, type RoutePreviewOptions } from 'vue-router-ns'
import MessagePreview from '../components/MessagePreview.vue'

function menuFor(item: Message): RoutePreviewOptions {
  return {
    to: { name: 'message', params: { id: item.id } },
    preview: MessagePreview,
    props: { id: item.id },
    actions: [
      { title: 'Reply', image: 'arrowshape.turn.up.left', run: () => reply(item) },
      {
        title: 'Archive',
        image: 'archivebox',
        destructive: true,
        run: () => archive(item),
      },
    ],
  }
}
</script>

<template>
  <ListView :items="messages" @itemTap="open">
    <template #default="{ item }">
      <GridLayout v-route-preview="menuFor(item)" columns="auto, *">
        <!-- the row -->
      </GridLayout>
    </template>
  </ListView>
</template>
```

<Clip name="ios-context-menu" caption="A long press previews a message; tapping the preview opens its route. iOS 26 simulator." />

`v-route-preview` works on any view, list rows included; the options are read again at every press, so a recycled row previews the item it shows now. `<RouterLink>` takes the same options without `to` through its `menu` prop:

```vue
<RouterLink to="/messages/1" :menu="{ preview: MessagePreview, props: { id: 1 } }">
  <Label text="Lunch on Friday?" />
</RouterLink>
```

## Options

| Option             | Meaning                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `to`               | The destination, committed with `router.push` (or `replace`). `clearHistory`, `withParents`, `frame`, `transition` and `zoom` apply too. |
| `preview`, `props` | The component shown in UIKit's preview, mounted with those props.                                                                        |
| `canPreview`       | Called at press time. `false` keeps protected content out of the preview; the actions still show.                                        |
| `size`             | Device-independent pixels. Without a height the content is measured at the source's width.                                               |
| `actions`          | `{ title, image?, destructive?, to?, run? }`. `image` is an SF Symbol on iOS; `to` navigates through the guards, `run` does anything.    |
| `openTitle`        | Android: the first item of the popup, "Open" by default.                                                                                 |

## What a preview is not

The preview renders in a Vue app of its own and is disposed when the menu closes. It is not a stack entry: no guard runs for it, `afterEach` does not fire, nothing is persisted, and no result promise settles. Committing runs the usual navigation, so the page mounts fresh; a preview is never reused as the page.

Authorization belongs to `canPreview`. A guard that would redirect to a login still runs on commit, and a press on a protected row shows only the actions until then.

## Platform

| Platform | Presentation                                                                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS 13+  | `UIContextMenuInteraction` on the view, a `UIMenu` of `UIAction`s, the preview in a layout view controller sized to the content. Commit uses the pop style, then the navigation. |
| Android  | `PopupMenu` of titles. Standalone views use the long-press gesture; list rows use the list's own item long click, so a gesture never makes the row swallow its taps.             |

The interaction follows the row's `loaded` and `unloaded`, which is how list recycling keeps one interaction per view. Native checks are in the repository's `test/native-context-menus.md`.
