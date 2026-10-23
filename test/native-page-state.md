# Page state restoration validation — #49

## Completed multi-window acceptance — 2026-10-23

The remaining #49 dependency was delivered by #46 / PR #65 and is now on `main`. This completion audit inspected the actual JSON artifacts from the [passing native suite for PR #125](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/39901734873), head `f54b2492e1f671138955c20ca69c5d81dff775d7`. Its tree is the same as merge commit `98237e60ffe434bab34e70277e4faf1a6a5ca384`. These are existing hosted native runs, not newly performed local device runs.

| Artifact / scenario                                          | Process evidence                                                            | Verified outcome                                                                                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `native-smoke-android` / `state` (API 34)                    | Six `am kill` cycles: 14676 → 14907 → 15196 → 15391 → 15563 → 15717 → 15876 | Duplicate drafts and native scroll offsets, stable keys, native Back, schema migration, expiry, removed routes, signed-out guards and legacy format. |
| `native-windows-android-34` / `windows`                      | 2824 → 4052                                                                 | App-owned reconstruction into new windows retains independent documents and entry keys.                                                              |
| `native-windows-android-34` / `windows-os-tasks`             | 4918 → 5329                                                                 | Both original task IDs survive; A's two `/edit` drafts and B's separate `/edit` draft return to their own windows.                                   |
| `native-windows-android-36` / `windows`                      | 2714 → 3415                                                                 | App-owned reconstruction retains each window's history, draft and entry keys.                                                                        |
| `native-windows-android-36` / `windows-os-tasks`             | 4079 → 4561                                                                 | Original tasks and per-document state survive genuine process death.                                                                                 |
| `native-windows-ipad` / `windows-ios-restored` (iPadOS 18.6) | 13924 → 14689                                                               | Original UIKit session IDs remain associated with A/B, with distinct drafts, stable entry keys and matching native controller/page counts.           |

For each multi-window report, `prepare.json` contains A at `['/', '/edit', '/edit']` and B at `['/', '/edit']`. The restore fixture checks A's top draft, then performs Back and checks its first draft while B remains unchanged. The final restoration report therefore contains two pages per window; its entry keys must equal the corresponding original key prefix. The audit also checked `ok`, process changes, native page counts, task IDs on Android and session/controller identity on iPad. Same-process reconnect/background-resume artifacts are separate and are not counted as proof of process death.

The checked-in drivers keep these assertions in required CI: [Android window restoration](../scripts/native/windows/android.mjs), [UIKit restoration](../scripts/native/windows/ios.mjs), [page state](../scripts/native/state-android.sh) and their [native fixtures](../demo/src/testing/windows-app.ts). The new page-state regression verifies that application-owned path migration in `restore.load` preserves two renamed-route entries' distinct keys/drafts, including after Back. It adds no new runtime API.

### Acceptance mapping and boundaries

- Versioned opt-in snapshots, stable keys, loaded-page restore hooks, schema migration, JSON/size limits, opt-out and legacy format are already implemented and covered by unit/native tests.
- History/page state remains separate from selected-tab state and app-owned document/window identity. `restore.key`/`windowKey` isolate snapshots. The EN/pt-BR guide now explains exact-path migrations, index alignment, expiry preservation and storage cleanup on sign-out.
- Removed paths reset the affected stack to `initial`; a guard redirect does not transfer the private draft to the redirected page. Sensitive stores and account boundaries remain application-owned.
- Modals, native objects and pending result Promises are not serialized. Recoverable operations need app-owned persisted data.
- Native scroll restoration and schema/session compatibility were validated by the single-window Android fixture; independent-window draft/key restoration was validated separately on Android and iPad. No multi-window scroll or physical-device pass is claimed.
- Multi-window ownership remains experimental, with the [documented Core/platform limits](../docs/guide/windows.md). Automatic original Android task reconstruction requires API 29+; the tested APIs here are 34/36. This acceptance does not promote the API to stable or claim arbitrary OS versions.

## Repeatable native acceptance — 2026-10-19

The opt-in `demo/src/testing/state-app.ts` fixture and `scripts/native/state-android.sh` runner passed on the Medium Phone Android 16 / API 36 emulator, NativeScript Android runtime 9.1.1 and NativeScript-Vue 3.1.2. No router or native host methods are patched. The runner checks the rendered drafts with UIAutomator and records screenshots, hierarchies, runtime assertions and each process's before/after PID under `scripts/native/out/state`. All six deaths used `am kill`, with PID transitions `25086 → 25223 → 25485 → 25664 → 25809 → 25966 → 26114`; no fallback kill was needed.

The first process opens `/edit` twice. Its two page instances contain `first draft` at 240 DIP and `second draft` at 840 DIP. The normal background save callback persists them. After Home → `am kill` → relaunch, the top page restores its own text and native ScrollView offset; Back reveals the earlier page with its different text and offset. All three entry keys (root plus both editors) survive. Each editor's restore callback runs exactly once with an already loaded native Page. Screenshots show reading line 22 on the top page and line 7 on the earlier page.

Additional seeded snapshots exercise application updates and session changes:

| Scenario                  | Native assertion                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Schema migration          | A version-1 `{ body }` draft becomes the version-2 `{ text, offset }` shape after native load; its entry key stays unchanged.         |
| Expired snapshot          | A snapshot older than the default 30-minute limit starts at the native root with no draft restored.                                   |
| Removed route             | An unmatched saved path returns to the initial root; the expected development warning is logged.                                      |
| Signed-out session        | A guard redirects the saved private route to the root before an editor mounts; private state is absent from the replacement snapshot. |
| Legacy path-only snapshot | The native history rebuilds with a fresh editor and is saved in version-2 format.                                                     |

Compatibility cases freeze the old process's persistence callback after seeding so backgrounding cannot overwrite their input. Duplicate draft/scroll restoration uses ordinary router persistence throughout. The runner requires a missing old PID before relaunch and a different new PID afterward; it never substitutes a force-stop for these process-death checks. If `am kill` refuses a non-cached process, it can use `run-as` to kill only that same debuggable app PID.

The suite is wired into Native CI on Android 14 / API 34. Reproduce with the commands in [native checks](../scripts/native/README.md#page-state-after-process-death). The existing unit suite also covers JSON/size limits, opting out of state, guard redirects, migration refusal, and save-on-suspend/clear-on-exit behavior.

## Scope of the 2026-10-19 run

That fixture exercised one Android native window. Independent-window and UIKit cold-restoration evidence is recorded in the completion section above; physical devices remain outside this automated matrix.

## Earlier demo validation — 2026-10-16

2026-10-16, NativeScript Android runtime 9.1.1, NativeScript-Vue 3.1.2, Medium Phone emulator, Android 16 / API 36. The demo persists `restore` through `ApplicationSettings`; the login page keeps its typed name with `usePageState('form', …)` and the message page its scroll offset with `usePageState('reading', …)`.

## Genuine process death

Open Settings → Account, land on the login page through the `requiresAuth` guard, type a name, press Home, then `adb shell am kill org.nativescript.vuerouterns`. `pidof` went from 4303 to empty. Relaunch the activity: new pid 4892, the settings tab came back on the login page with the name in the field, and reselecting the tab asked the page's own leave guard, which only arms while a name is typed.

The snapshot `suspend` wrote, read from the app's shared preferences:

```json
{
  "version": 2,
  "savedAt": 1792199036344,
  "stacks": {
    "inbox": ["/"],
    "settings": ["/settings", "/login?next=%2Fsettings%2Faccount"]
  },
  "entries": {
    "inbox": [{ "key": "mvboxpvlp2zu-1" }],
    "settings": [
      { "key": "mvboxpvlp2zu-2" },
      {
        "key": "mvboxpvlp2zu-4",
        "state": { "form": { "version": 1, "value": { "name": "Rafa" } } }
      }
    ]
  }
}
```

Paths stay in `stacks`, as before; identities and state live in `entries`, aligned with them.

## Automated

`test/page-state.spec.ts` covers what the emulator run did not: two pages at the same path restored with their own drafts and keys, saves on `suspend` and `null` on `exit`, version migration and starting fresh without one, state left behind when a guard redirects the restored page, loading the path-only format, and JSON/size checks with their warnings. 276 tests pass.

## Limitations of the earlier demo run

- The reading-position restore on the message page could not be driven on this emulator: synthetic taps do not fire NativeScript `ListView` item taps there (see `test/native-bottom-sheets.md`), so no message page could be opened and scrolled before the kill.
- Duplicate paths and reading positions were not exercised in that run; the 2026-10-19 fixture above covers them on Android. Independent windows and native iOS restoration were not validated by that earlier run; see the completion evidence above.
