# Fieldnotes: an integrated native navigation example

<Clip name="native-showcase" aspect="402 / 874" caption="Actual iOS 26 simulator: drawer, native search and menus, shared header actions, modal result, unsaved-edit guards and return to the retained list." />

Fieldnotes is a small, runnable list/detail app. A drawer opens destinations; native page headers and search lead into a note; header and context-menu actions share state; an editor protects unsaved changes; a native modal returns a result to the same detail page.

It uses the public router APIs and the repository's upcoming **0.1.0-rc.3**. Published rc.2 already provides native headers, iOS large titles, search, context menus, guards, modal results and navigation focus. The iOS drawer and shared page actions used here are rc.3 additions. Build this checkout to run the complete example; installing rc.2 alone does not supply those additions.

## Run from a checkout

Install the NativeScript CLI and platform SDKs using the [NativeScript setup](https://docs.nativescript.org/setup/). From the repository root:

```sh
npm ci
npm run build

# Generate native resources once; App_Resources is ignored by Git.
if [ ! -d demo/App_Resources ]; then
  showcase_resources=$(mktemp -d)
  ns create showcase-resources --template @nativescript/template-blank-ts --path "$showcase_resources"
  cp -R "$showcase_resources/showcase-resources/App_Resources" demo/App_Resources
fi

cd demo
npm install
npm run showcase:ios
# or:
npm run showcase:android
```

These scripts select `--env.showcase`; the mail demo remains the default entry. Both use `org.nativescript.vuerouterns`, so installing one replaces the other on the chosen device. Pass `-- --device <id>` to select a simulator/emulator. The tested baseline is Core 9.1.3, NativeScript-Vue 3.1.2, iOS runtime 9.1.0 and Android runtime 9.1.1.

## Follow the complete flow

1. Open **Menu → About this example**, then **Return to library**. The overlay closes when navigation commits. The drawer itself adds no history entry.
2. Tap **Search**, type `coast`, and hold the matching card. Choose **Star note**. The action belongs to that item, not another note in the catalog.
3. Open **Along the coast**. Its header shows **Unstar** because the context action changed the same in-memory note. Toggle the header action, or hold the detail card to use its shared native menu.
4. Tap **Review in a modal → Mark as reviewed**. The sheet closes and the original detail page displays **Reviewed today**. Canceling a later review leaves the previous value intact.
5. Open **Edit**, change the note, then use native Back. Choose **Keep editing**. Open the drawer and try **Library**: the same guard protects that departure, and refusal keeps the drawer open. Close the pane, then **Save**.
6. Return from detail to the list. The original list page and its `coast` query remain; search does not reopen the keyboard automatically.

The sample notes are fictional and stored only in memory. Save updates that in-memory note; this is not cloud synchronization or persistence across relaunch. The list query belongs to the retained list Page; the draft belongs to the edit Page. To persist after process death, add application storage and opt-in [page-state restoration](./restore).

## Where each feature lives

| Source under `demo/src/showcase`                                                                                                 | Responsibility                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`App.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/App.vue)                                 | One `RouterDrawer` around one `RouterView`. Library explicitly returns to root; About pushes a route. Drawer selection does not create a second navigation implementation. |
| [`router.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/router.ts)                             | Lazy list/detail/edit/about routes and the native modal route.                                                                                                             |
| [`pages/Library.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/pages/Library.vue)             | Native `ActionBar`, `iosLargeTitle`, `useNativeSearch`, page-owned query and a native ScrollView. Navigation lets the search integration manage its lifecycle.             |
| [`components/NoteCard.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/components/NoteCard.vue) | Accessible native Open button plus an item-specific context menu. Stable keys keep action ownership tied to the correct note.                                              |
| [`pages/Note.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/pages/Note.vue)                   | `usePageActions` shared by `PageActionItem` and a native menu; a typed modal result; focus return target.                                                                  |
| [`pages/Edit.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/pages/Edit.vue)                   | Page-local draft, conditional leave guard and a native confirmation dialog. Save updates app data before returning.                                                        |
| [`pages/Review.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/pages/Review.vue)               | Native modal Page, cancel and `back({ result })`.                                                                                                                          |
| [`state.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/state.ts)                               | Small fictional catalog and a shared drawer ref. It does not own native history.                                                                                           |

The app has one native Frame stack. About is a route in that stack, not an independent tab. If independent destination histories are required, compose named Frames in tabs as explained in [container choices](./capabilities). Adaptive drawer, diagnostics visualization and transition adapters are not required to run this example.

## Native presentation and accessible alternatives

On iOS, `iosLargeTitle` uses the actual UIKit navigation bar with native scrolling content, and `useNativeSearch` installs a page-owned search controller. Android keeps its normal Toolbar and temporarily presents native SearchView in the title area. The sample does not draw a fake collapsing Android large title or replace a native stack to mimic a transition.

Every route remains reachable with native buttons. Cards have an explicit Open button; contextual actions are also available on the detail header or through its Review button. `useNavigationFocus` declares initial headings and return targets for list/detail/modal navigation. The drawer provides its existing accessibility isolation and restoration. The app requests the default system motion policy, without additional custom motion.

The three-card ScrollView keeps the example small. Use a virtualized list for a large catalog and retest row reuse/menu ownership and any zoom source. This example deliberately uses normal transitions; [interactive transition limitations](./interactive-transitions) remain applicable.

## Validation and recordings

See the [native acceptance report](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-showcase.md) and [reproduction scripts](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/showcase). They distinguish real UI input, diagnostics-based identity checks, recorded platforms and manual accessibility boundaries. A successful build alone is not evidence that navigation or focus works.

The optional `--env.showcaseTest` entry runs the **same app** and writes bounded diagnostic snapshots for acceptance. Normal `--env.showcase` does not include that polling/file bridge; neither ships in the router package.
