# vue-router-ns playground

A self-contained NativeScript-Vue 3 example using `vue-router-ns@0.1.0-beta.6` from npm. The StackBlitz startup configuration follows the [official NativeScript-Vue template](https://github.com/nativescript-vue/nativescript-vue/tree/main/packages/stackblitz-template).

[Open in StackBlitz](https://stackblitz.com/fork/github/rafaelaugustos/vue-router-ns/tree/main/examples/playground?file=src%2Frouter.ts)

Install [NativeScript Preview](https://preview.nativescript.org/) on your device, open the project, wait for the terminal to display the Preview QR code, and scan it. The editor runs in the browser; the UI runs natively on the device.

Try selecting an item, pushing the next item and going back through the history. Compose a reply to try modal results, or cancel a nonempty draft to exercise the leave guard. A wide window shows list and detail side by side; change `breakpoint` in `src/App.vue` to experiment with layout.

For a locally installed NativeScript CLI:

```sh
npm install
ns preview
```

`npm run typecheck`, `npm run build:android` and `npm run build:ios` check TypeScript and platform JavaScript bundles; they do not compile an APK/IPA or verify a Preview device session. Preview supplies the native runtime and manifest. Features such as predictive back and iOS zoom depend on its versions/configuration and the device OS. Use the repository's `demo/` with a full native build to validate those capabilities.
