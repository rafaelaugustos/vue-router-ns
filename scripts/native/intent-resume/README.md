# Explicit authentication resumption — #182 stage 2

The fixture receives an actual OS URL in one router with two retained Frames.
Its normal authentication guard opens a native login Page. The app retains the
requested URL with `suspendIntent`; tapping the Page's sign-in button authorizes
and resumes it. Authentication is controlled fixture state, without an external
identity provider, network credentials or simulated router/native callbacks.

```sh
npm run build
npx tsc --noEmit -p scripts/native/intent-resume/tsconfig.json
python3 scripts/native/entrypoints/prepare.py
ns build ios --path demo --for-device false --env.intentresumeTest --no-hmr
IOS_SIMULATOR=<dedicated-iPad-UUID> RECORD_VIDEO=1 \
  OUT=scripts/native/out/intent-resume node scripts/native/intent-resume/ios.mjs
```

Use Node 20.19.4 for the NativeScript CLI. Xcode and Ruby's `xcodeproj` gem are
required. The driver only reinstalls the demo on the explicitly selected simulator,
bounds XCTest to 300 seconds and retains environment, reports, result bundle and
optional recording. Use a new output directory for every run.

Nine reports cover OS URL to login, authorized resume, repeated completion, login
cancellation, account change, expiry, supersession, sign-out during an asynchronous
guard and a removed destination. Every check compares native and logical histories
and asserts the source's exact native Page and unsent draft remain unchanged.
The resumed request replaces the login Page; the router does not guess this policy.

This is simulator evidence for one window and app-controlled authentication.
Account changes during target readiness/redirects, cold ownership disposal and
invalid policies also have unit coverage. Persistence, real authentication SDKs,
Android native acceptance and physical accessibility remain outside this stage.
