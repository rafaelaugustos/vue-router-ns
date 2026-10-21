# Static Android shortcuts

This explicit native resource example preserves an existing NativeScript task when a user taps a static shortcut. Android otherwise adds `NEW_TASK | CLEAR_TASK` to static shortcut intents.

Copy `Android/src/main/java/org/nativescript/router/ShortcutEntryActivity.java` into the same path under your `App_Resources`. Register the Activity and point the static shortcut intent at it as shown in the [deep-link guide](../../docs/guide/deep-links.md#static-android-shortcuts). It forwards to `com.tns.NativeScriptActivity`; adapt that class name for a custom main Activity.

The receiver accepts only the router's shortcut scheme/authority. Route validation and authentication still happen in the router. The Java Activity has an empty task affinity, finishes immediately, then forwards after its native window is retired. No JavaScript lifecycle or navigation implementation is patched. This example is built and exercised by `scripts/native/entrypoints` on cold and warm launches.
