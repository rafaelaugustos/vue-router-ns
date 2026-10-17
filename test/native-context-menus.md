# Native context menu validation — #59

2026-10-17, NativeScript 9.1.3, NativeScript-Vue 3.1.2, library at the `feat/context-menus` branch.

## iPhone 17 simulator, iOS 26.0 (Xcode 27.0)

Driven with `idb ui tap --duration` and read back through `idb ui describe-all`, since the Mac has no Simulator GUI.

- A 0.9 s press on an inbox row opens `UIContextMenuInteraction`'s menu: the `MessagePreview` component in the preview (370×121 pt in the tree, sized from the content measured at the row's width after `callLoaded`, which is when the app's CSS applies) and the two actions with their SF Symbols. The list underneath is untouched and the route stays `/`.
- Tapping the preview commits: the message page mounts fresh at `/messages/1`, the trail shows `/ › /messages/1`, back returns to the list.
- Tapping an action (`Mark as read`, 0.3 s press) runs it and the menu closes without navigating: no `Preview` element remains and the three rows are back. A press on `Reply` opened the compose sheet with the subject prefilled.
- A press on another row opens its own menu; a tap outside dismisses it with the list intact.
- Two things found on the way: the row's component instance inside a `ListView` template has no `$router`, so the directive now resolves the router from the view's page (registered when a page links to its entry) and binds its platform side once the view is loaded; and a preview measured before `callLoaded` came out 8 pt tall, so the preview loads before it is measured.

## Android API 36 emulator

- A long press (900 ms `input swipe` in place) on a row shows a `PopupMenu` with `Open`, `Reply`, `Mark as read`; `Open` pushes `/messages/1`. The listener is the list's own `OnItemLongClickListener`, so a normal tap on a row still opens its message afterwards, and back dismisses the popup without popping the page.
- Checked before the demo's preview stylesheet class was renamed (`.preview` → `.message-preview`, a demo-only CSS collision with the row's preview label); the library code did not change after that.

## Automated

Five scenarios in `test/context-menu.spec.ts`: a preview mounts in its own app without `afterEach`, history or route changes; committing pushes once through the guards and `willEnd` disposes the preview; `canPreview` and live options at press time; nothing offered without preview or actions; `<RouterLink menu>` attaching on `loaded` and releasing on `unloaded`; the Android popup with the route first. Suite: 315 tests, typecheck, format.
