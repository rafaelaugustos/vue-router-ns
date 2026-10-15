# Native keyboard commands

Commands are opt-in and belong to a routed page. Render `NavigationCommandScope` inside its Page around the content. It is a native GridLayout: normal layout attributes (`rows`, `columns`, padding) work. Its iOS 13+ UIView participates in the focused responder chain; Android listens for unhandled native keys through ViewCompat, after the focused control gets its chance.

```vue
<script setup lang="ts">
import { NavigationCommandScope, useNavigationCommands } from 'vue-router-ns'

const commands = useNavigationCommands([
  {
    id: 'back',
    title: 'Go back',
    shortcut: { input: '[', modifiers: ['meta'] },
    action: 'back',
  },
  {
    id: 'close',
    title: 'Close modal',
    shortcut: { input: 'Escape' },
    action: 'closeModal',
    allowInTextInput: true,
  },
  {
    id: 'compose',
    title: 'Compose',
    shortcut: { input: 'n', modifiers: ['meta'] },
    action: (router) => router.push('/compose'),
  },
])
</script>

<template>
  <Page>
    <ActionBar title="Messages" />
    <NavigationCommandScope :commands="commands">
      <Label text="Use the keyboard or the normal native controls." />
    </NavigationCommandScope>
  </Page>
</template>
```

Choose platform bindings explicitly, for example `isIOS ? 'meta' : 'ctrl'`. Supported inputs are characters with modifiers, `Escape`, `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `Enter` and `Tab`. Modifiers are `meta`, `ctrl`, `alt` and `shift`. Keep titles localized with refs or getters; the command list itself may be a ref/getter. Ids and shortcuts must be unique within one registry. Mount one scope per registry.

`commands.list()` resolves current titles and enabled state; `execute(id)` returns whether an enabled command was dispatched, not whether its navigation succeeded. Navigation failures/guards retain the router's normal behavior. Repeated dispatch is disabled while that action runs. `focus()` selects this pane's command responder and refuses to steal focus from a text editor. Tapping its content also selects the scope when no editor owns focus.

`back` is disabled at a non-modal root. `closeModal` closes the whole modal stack through all normal leave guards and is disabled outside a cancelable modal. App-defined actions receive the page-bound typed router, so they target that stack without consulting a process-global Frame. Next/previous tab or destination are app actions: a native stack has no forward history. The demo includes next/previous tab bindings using the page's own NativeWindow.

## Editing and Escape

Commands are disabled in text editors unless explicitly marked `allowInTextInput`. Standard select/copy/paste/cut/undo/redo bindings are rejected even with that flag; IME composition is always left alone. Printable keys require a modifier. Platform system shortcuts still belong to the OS; do not register system-reserved combinations.

Escape first belongs to the focused native control/IME. For an enabled router Escape binding, an active page-owned search is dismissed before the registered action runs. Application overlays can register their own Escape action and decide when to delegate; otherwise an explicit `closeModal` binding passes through modal guards. No unregistered Escape/back binding is installed. Android observes the owning Page so Toolbar search fields are included. UIKit search fields outside the content scope keep UIKit's own responder behavior.

On iPad, enabled commands expose native `UIKeyCommand` discovery titles. Android has no UIKit-style discovery overlay; `list()` can populate an application help view. Hidden tabs, covered pages and disposed hosts cannot dispatch commands. Multiple windows have independent native responder/view trees; commands bind to the actual view, not the globally last-created Activity. Modal presentation explicitly targets the originating page.

This does not add support for retaining router history across Activity recreation or scene reconnect; that is tracked separately in #46. See [guards](./guards), [native search](./native-bars), and [UIKit key commands](https://developer.apple.com/documentation/uikit/uikeycommand).
