# Page state restoration validation — #49

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

## Not validated natively

- The reading-position restore on the message page could not be driven on this emulator: synthetic taps do not fire NativeScript `ListView` item taps there (see `test/native-bottom-sheets.md`), so no message page could be opened and scrolled before the kill.
- Duplicate-path pages on a device, independent native windows (#46) and iOS were not exercised; iOS does not kill foreground-resumable apps the same way, and the format is platform-independent.
