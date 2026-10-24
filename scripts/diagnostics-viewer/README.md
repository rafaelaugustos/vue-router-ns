# Diagnostics viewer acceptance

The viewer is a standalone browser tool. These checks do not require a native app, simulator, cloud service or collector changes.

```sh
npm ci
npm run diagnostics:typecheck
npm run diagnostics:build
npm test -- test/diagnostics-viewer.spec.ts
```

For the optional browser checks, install Playwright in a disposable tooling directory (or use an existing installation):

```sh
npm install --prefix /tmp/router-viewer-browser playwright@1.64.0
/tmp/router-viewer-browser/node_modules/.bin/playwright install chromium
PLAYWRIGHT_MODULE=/tmp/router-viewer-browser/node_modules/playwright/index.mjs \
  node scripts/diagnostics-viewer/check.mjs
```

The driver serves only the built HTML on an ephemeral localhost port, then tests the downloaded file with the browser offline. Override `VIEWER_URL` to exercise a hosted build; it must serve the standalone HTML, not the documentation wrapper. `OUT` defaults to `scripts/diagnostics-viewer/out`, which is ignored by Git.

Coverage includes valid/invalid versioned JSON, guard/mount durations, native mismatch, correlated request/phase/outcome filters, redirects, truncated spans, independent captures/windows with colliding identities, Portuguese, untrusted strings rendered as text, 10,000-event pagination, no persistence/outbound requests, downloadable offline operation, invalidating a pending import, mobile overflow and keyboard filter navigation. Unit tests also round-trip an actual collector export and retain its privacy contract.

Record the actual tool with clearly synthetic example data:

```sh
PLAYWRIGHT_MODULE=/tmp/router-viewer-browser/node_modules/playwright/index.mjs \
  node scripts/diagnostics-viewer/record.mjs
```

The recording driver imports saved JSON fixtures, uses actual browser controls and retains a WebM, poster and `video-path.txt`. Encode the recording as H.264 MP4 for the guides and attach the same reviewed file to the PR so GitHub displays a player. Do not present these synthetic timings as device performance measurements.

The existing fast CI check runs model tests and builds/typechecks the viewer through `docs:build`. Browser acceptance runs locally; no native/emulator job is added for this browser-only feature. See [validation and boundaries](../../test/diagnostics-viewer.md).
