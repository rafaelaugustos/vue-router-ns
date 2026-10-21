# Page state restoration validation — #49

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

## Remaining acceptance

- Independent native windows, including reconstruction after process death, still depend on #46. This fixture uses one native window and cannot close that part of #49.
- This run does not establish native iOS process-restoration behavior or physical-device coverage.

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
- Duplicate paths and reading positions were not exercised in that run; the 2026-10-19 fixture above covers them on Android. Independent windows and native iOS restoration remain unvalidated.
