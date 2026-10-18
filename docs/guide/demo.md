# See the router on a device

These clips come from the NativeScript-Vue mail app in [`demo/`](https://github.com/rafaelaugustos/vue-router-ns/tree/main/demo), running on iOS 26 and iPadOS 26 simulators and an Android 16 emulator. Each feature's guide includes its recording beside the code. The app uses local sample messages; it does not connect to an email service.

Clips are silent, loop while visible, and have playback controls. With Reduce Motion enabled, they wait for you to press play.

## Tabs with independent histories

Open a message, switch tabs, and return to the same message. Tap the selected tab again to return to its root. [Configure native tabs](./tabs).

<div class="clips">
<Clip name="ios-tabs" caption="UIKit tabs on iPhone, including reselect to root." />
<Clip name="android-tabs" aspect="9 / 20" caption="The same navigation with Material tabs on Android." />
</div>

<Clip name="ipad-tabs" :width="480" aspect="3 / 4" caption="UIKit's sidebar selects the same named stacks on iPad." />

## Push, back and list/detail

The trail at the bottom is the live router stack. Opening another message adds an entry; Back to inbox removes the details in one navigation. A wide window keeps the list visible. [Navigation](./navigating) · [List and detail](./split-view).

<div class="clips">
<Clip name="ios-navigation" caption="Push two messages and return to the inbox on iPhone." />
<Clip name="ipad-split" :width="360" aspect="3 / 4" caption="Push messages into the detail pane while the inbox stays visible on iPad." />
</div>

## Sheets on both platforms

Compose uses a UIKit sheet with detents on iOS and a Material bottom sheet on Android. Both host a routed page with its own native navigation bar. [Modals and results](./modals).

<div class="clips">
<Clip name="ios-sheet" caption="Open, expand and close the compose sheet on iPhone." />
<Clip name="android-sheet" aspect="9 / 20" caption="Open the Material sheet and dismiss it with system Back." />
</div>

## Preview before navigating

A long press shows a message preview and actions. Tapping the preview opens the route. [Context menus](./context-menus).

<Clip name="ios-context-menu" caption="UIKit's native preview and the resulting message page." />

## Guards and form restoration

Account requires a session. The guard redirects to sign-in, and typing a name activates a leave guard. On Android, that form state can also survive the operating system killing the background process. [Guards](./guards) · [Restoration](./restore).

<div class="clips">
<Clip name="ios-guards" caption="Stay keeps the typed name; Leave allows the page to close." />
<Clip name="android-restore" aspect="9 / 20" caption="Type a name, background the demo, kill its process, then reopen with the form restored." />
</div>

## Native search and drawer

Search filters the current page without adding routes. The Android drawer takes destinations through the router's link policy and closes before a page is popped. [Native search](./native-bars) · [Drawer](./drawer).

<div class="clips">
<Clip name="ios-search" caption="The page owns its native search field and query." />
<Clip name="android-drawer" aspect="9 / 20" caption="Select Settings from the drawer, then close the drawer with system Back." />
</div>

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
