# vue-router-ns demo

A small mail app with two tabs, each one its own stack:

- **Inbox**: `RouterSplitView` shows the list beside the selected message in wide windows and keeps the same history when resized. Open a message (typed params, `props: true`), go to the next one and back to the inbox in one step (`backTo`). Reply in a modal that hands the text back (`pushForResult`), and that asks before discarding a draft, only when there is one (`onBeforeRouteLeave` with `when`). The unread count refreshes whenever you come back to the inbox (`onPageActivated`). On Android 14+, a message shrinks as you swipe back from it, revealing the page below (the router’s built-in back preview). Opening one zooms it out of its row on iOS 18 (`zoomFrom`), and elsewhere moves the sender's name into place (`SharedTransition`).
- **Settings**: the account page needs a session, so a global guard sends you to the login page first, which then replaces itself with the account page. Signing out starts the tab over (`clearHistory`). A link to a path with no route lands on the catch-all page.

`RouterTabs` selects the stack targeted by a deep link, shows badges, and adapts from Android bottom navigation to a rail at 600 device-independent pixels. On iPad it enables UIKit's sidebar. Each stack returns to its root when its selected tab is tapped again. The demo saves the selected tab alongside the router's saved histories and page state.

The trail at the bottom of each page is `router.stack`, live.

Run it from the repository root:

```sh
npm install
npm run dev        # builds the router in watch mode

cd demo
npm install
ns run ios         # or: ns run android
```

The webpack config points `vue-router-ns` at `../dist`, and pins `nativescript-vue` and `@nativescript/core` to the demo's own copies, so the app and the router share one Vue.

## Integrated native navigation example (rc.3)

Fieldnotes combines the cross-platform drawer, native headers/search, item context menus, shared page actions, a guarded editor and a native modal result. Run `npm run showcase:ios` or `npm run showcase:android` from `demo` after building the package and preparing native resources as documented below. Notes are fictional and in-memory.

Follow the complete [English walkthrough](../docs/guide/native-showcase.md) or [guia em português](../docs/pt-BR/guide/native-showcase.md). Source lives in `src/showcase`; native acceptance in `scripts/native/showcase`. Published rc.2 alone does not include the iOS drawer or shared page actions used here.

## Route data example

`--env.loadersTest` selects the standalone product/details example in `src/testing/loaders-app.ts`: real HTTP, per-page pending/error/retry, shared app cache and cancellation after Back. See [setup and native acceptance](../test/native-route-data.md) for the local API and simulator/emulator commands.

## Native Suspense example

`--env.suspenseTest` selects an experimental stable-Page composition with route loaders, Vue async content and explicit native container registration. Stock NativeScript-Vue 3.1.2 does not support this boundary without that registration. See [compatibility and reproduction](../test/native-suspense.md) before copying the recipe into an app.

## Airbnb-inspired navigation demo

`src/airbnb/` is **Airbnb NS**, an opt-in NativeScript-Vue app using the local `vue-router-ns` 0.1.0-rc.2 build. [Watch the 27-second iOS walkthrough](../docs/public/media/ios-airbnb.mp4).

With the NativeScript CLI and native SDKs installed, run from the repository root. `App_Resources` is generated and ignored by Git, so a fresh checkout first needs the blank template's resources:

```sh
npm install
npm run build

if [ ! -d demo/App_Resources ]; then
  resource_dir=$(mktemp -d)
  ns create airbnb-resources --template @nativescript/template-blank-ts --path "$resource_dir"
  cp -R "$resource_dir/airbnb-resources/App_Resources" demo/App_Resources
fi

cd demo
npm install
npm run airbnb:ios
# or: npm run airbnb:android
```

Pass a device with `npm run airbnb:ios -- --device <udid>`. The flag `--env.airbnb` selects a separate app entry and stylesheet; running `ns run ios` or `ns run android` without it still opens the mail demo. Both entries use the same native app ID. Favorites use their own `airbnb.saved` settings key.

The Airbnb run commands first apply the **Airbnb NS** display name and the supplied pink-and-white icon on iOS and Android. The versioned assets live in `branding/airbnb/`; `npm run airbnb:prepare` reapplies them to the generated, ignored `App_Resources/` directory. Android includes adaptive-icon padding. Branding persists for both entries because they share native resources. Name and icon changes require a native rebuild and reinstall; hot reload alone cannot apply them.

The app includes a Portuguese home with horizontal destination carousels, product tabs, a destination/price search sheet, persisted favorites, and detail pages with photos, host information and a fixed reservation bar. Photos and icons are bundled for offline use. Trips, messages and profile have intentional empty states. Accommodations, prices, hosts and reviews are fictional; the reservation button only shows a demo summary.

Pages handle navigation and screen state. `components/` contains the discovery header, destination carousel, accommodation card and preview, gallery, summary, details and reservation bar, each with scoped styles. `app.css` holds shared styles. The sample catalog lives in `data.ts`, filtering and price formatting in `utils/stays.ts`, and favorites, search and selected-tab state in `store.ts`.

### Library features in this app

| Feature                                                  | Implementation                                                                                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Native tabs, colors, labels and favorite count           | [`App.vue`](src/airbnb/App.vue): `RouterTabs`, `RouterTab`, independent named stacks and `backToRootOnReselect`                                                                |
| Hide tabs on stay details                                | [`router.ts`](src/airbnb/router.ts): `meta.tabBarVisibility: 'hidden'`                                                                                                         |
| Zoom, shared elements and context menus                  | [`StayCard.vue`](src/airbnb/components/StayCard.vue): `RouterLink zoom`, `SharedTransition` and `menu` with [`StayPreview.vue`](src/airbnb/components/StayPreview.vue)         |
| Search sheet with a typed result                         | [`Explore.vue`](src/airbnb/pages/Explore.vue) and [`Search.vue`](src/airbnb/pages/Search.vue): `pushForResult<SearchFilters>()` and `back({ result })`                         |
| Per-entry data and deferred details                      | [`stay-data.ts`](src/airbnb/stay-data.ts) and [`Stay.vue`](src/airbnb/pages/Stay.vue): experimental `defineRouteLoader` / `useRouteData`, pending/error/retry and `<Deferred>` |
| Restore navigation and page state                        | [`navigation-state.ts`](src/airbnb/navigation-state.ts), [`page-scroll.ts`](src/airbnb/utils/page-scroll.ts), Explore and the gallery: `restore` and `usePageState`            |
| Focus on details/search and return to search's initiator | `useNavigationFocus` in Stay, Search and Explore                                                                                                                               |
| Incoming links into the owning tab                       | `links.frame` in the route table; e.g. `vuerouterns://stays/tortuga` and `vuerouterns://saved`                                                                                 |

The loader reads the bundled catalog, with no network dependency or artificial delay. Missing IDs show a not-found state; loader failures expose a retry button. Each route entry owns its loader state, including when the same stay is opened from different tabs. `<Deferred>` mounts the longer detail section after the page activates. The app does not require Suspense or multi-window configuration.

### Router behavior to try

- Tap a **photo**: `RouterLink zoom` opens a native page from that card on iOS 18+ with a compatible runtime. Back or the native dismissal gesture returns to the card. A `SharedTransition` on the matching photo provides the fallback, including Android. No frame default transition overrides UIKit zoom.
- Open a stay: the tab bar hides after navigation commits. Use the back button or the native dismissal gesture to return to the feed and its tabs.
- Open a destination list from Explore, switch to Favorites, and return: Explore keeps its list. Tap Explore again to return to its root. `backToRootOnReselect` is enabled now that rc.2 fixes the duplicate UIKit selection callbacks.
- Long-press a photo: iOS shows a preview and favorite action; Android shows a popup with an open action and the favorite action. Tapping the iOS preview opens the stay.
- Tap the heart without opening the card. Favorites and the tab badge update together and survive an app restart.
- Open search, select Guarujá and apply. `pushForResult` returns the filter from the modal. Cancel a later search to keep the previously applied filter.
- Search Guarujá with a nightly budget below R$ 960 to see an empty result; clear the filters to restore the feed.
- Swipe a destination carousel horizontally. Its arrow opens the full destination list through the router.
- Experiences and Services show a placeholder; only accommodation listings are implemented.
- Tap the photo or its counter on the detail page to switch between two sample photos.
- Browse, background the app, then relaunch after stopping its process. The router can restore histories and opted-in page state for 24 hours; the selected tab, applied filters and favorites have separate persisted settings. Search sheets and pending result promises are not restored.

On iOS, the detail photo extends behind the status bar, with the back and favorite controls below the top safe-area inset. The rounded content panel overlaps the photo. The reservation footer accounts for the bottom inset while the tab bar is hidden. Per-route hiding supports iOS 18+ bottom bars and Android Material bottom navigation/rail. Sidebar mode and the Core fallback keep their navigation visible. UIKit controls iOS 26 translucency and may retain the system tint for unselected icons.

The sample feed uses a vertical ScrollView containing horizontal ScrollViews, with 13 cards across four destination sections. For a large catalog, replace it with a virtualized list and retest zoom return when the source card has been recycled. Vertical reading position, Explore's category and the selected gallery photo opt into page-state restoration; horizontal carousel offsets are not persisted. Tab styling uses the router's public props, with no traversal of Android native views.

For Android **release** builds, add `implementation "com.google.android.material:material:1.12.0"` inside `dependencies` in `App_Resources/Android/app.gradle`. The debug runtime already includes Material. Native URL delivery also requires registering the `vuerouterns` scheme in `Info.plist` / `AndroidManifest.xml`; follow the [deep-link guide](../docs/guide/deep-links.md). The route table alone does not register an OS scheme.

Validation for the rc.2 update: 54 focused router tests passed (route data, tab visibility, tab selection, tab styling and page state); the iOS simulator app and Android debug APK both built. The October 23 recording shows the updated iOS app's tabs, zoom open/gesture return, context-menu previews and favorite actions. It does not demonstrate cold-session restoration, loader failures or Android gesture behavior. These remain separate native checks; a successful build is not evidence of those flows.

Check platform bundles without a device using `npm run airbnb:bundle:ios` and `npm run airbnb:bundle:android` from `demo/`. These include TypeScript and Vue compilation, but do not substitute for running native navigation.

### Assets

The photos are illustrative images from Unsplash, downloaded into `src/airbnb/assets`; they do not depict the fictional Brazilian listings. Source image IDs:

| File         | Unsplash source                                                                            |
| ------------ | ------------------------------------------------------------------------------------------ |
| cabin.jpg    | [1449158743715-0a90ebb6d2d8](https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8) |
| beach.jpg    | [1613490493576-7fde63acd811](https://images.unsplash.com/photo-1613490493576-7fde63acd811) |
| mountain.jpg | [1449844908441-8829872d2607](https://images.unsplash.com/photo-1449844908441-8829872d2607) |
| loft.jpg     | [1600210492486-724fe5c67fb0](https://images.unsplash.com/photo-1600210492486-724fe5c67fb0) |
| pool.jpg     | [1576013551627-0cc20b96c2a7](https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7) |
| interior.jpg | [1600607687920-4e2a09cf159d](https://images.unsplash.com/photo-1600607687920-4e2a09cf159d) |

Material Icons Outlined is from [Google's material-design-icons](https://github.com/google/material-design-icons); its Apache 2.0 license is included in `src/fonts/MaterialIcons-LICENSE.txt`.

Additional home reference photos (illustrative):

- `garden-house.jpg`: https://images.unsplash.com/photo-1564013799919-ab600027ffc6
- `bedroom.jpg`: https://images.unsplash.com/photo-1611892440504-42a792e24d32
- `city-house.jpg`: https://images.unsplash.com/photo-1568605114967-8130f3a36994

## First-app tutorial

`npm run tutorial:ios` or `npm run tutorial:android` selects the small Pocket notes app after the setup above. Its files under `src/tutorial` are embedded directly into the [English tutorial](../docs/guide/first-app.md) and [tutorial em português](../docs/pt-BR/guide/first-app.md). The main mail app remains the default entry. Like the other demo entries, installation uses the same application ID and replaces the currently installed demo.
