# Stable artifact consumer

Prepare a fresh copy of the historical Pocket notes acceptance app with the
candidate tarball, published Core 9.1.4 and NativeScript-Vue 3.1.3:

```sh
npm pack --pack-destination /tmp
OUT=/tmp/stable-consumer node scripts/native/release-consumer/prepare.mjs /tmp/vue-router-ns-0.1.0.tgz
```

The output directory must not contain a consumer. Preparation installs and cleanly
reinstalls the package, checks types, verifies the lockfile's tarball integrity and
rejects a linked router. It preserves the historical fixture and copies its native
runners, changing only the displayed version/title and dependency metadata.
`package-proof.json` identifies the exact artifact. No unpublished Core patch or
router source alias is used.

Build the prepared `consumer` with `ns build ios --for-device false` and
`ns build android`. Install only on dedicated test devices. Generate the iOS
project with `ruby <out>/runner/rc3-consumer/project.rb <out>/checks`, then run
`ConsumerChecks/ConsumerUITests/testFirstAppFlow` through XCTest. Run Android
with `ANDROID_SERIAL=<serial> CONSUMER_REPORT=<out>/android node <out>/runner/rc3-consumer/android.mjs`.
The existing tests cover real keyboard input, query retention, native modal
results, guard refusal and discard; iOS also checks reversed/committed Back.

Record the actual application for release evidence. Retain the package proof,
consumer lockfile, build logs, native results and system-preference observations.
These focused consumer checks complement the full release workflow; they do not
replace its same-commit native matrix or claim new screen-reader certification.
