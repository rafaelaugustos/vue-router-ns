# Native convention/Vite acceptance

The shared runner builds and installs the actual app through the NativeScript CLI,
then edits files while it runs. The CLI owns iOS stop/start. A `Restarting application`
message or temporarily absent PID does not authorize a second launch. Run-identified
CLI results take priority; historical log lookup is only allowed after CLI sync
acknowledgement and is disabled after a log-service timeout. No navigation retry or
larger readiness budget is introduced.

From the repository root, prepare the packed local consumer and a dedicated booted
iPhone 16 Pro / iOS 18.6 simulator:

```sh
npm run build
npm ci --prefix examples/file-routing
npm run setup --prefix examples/file-routing
ROUTER_BUNDLER=vite NS_HMR_HOST=127.0.0.1 \
  IOS_SIMULATOR=<dedicated-UUID> RECORD_VIDEO=1 \
  OUT=/tmp/router-vite-acceptance node scripts/native/conventions-watch.mjs ios
```

Use a fresh output directory. The fixture edits the example's template, middleware,
metadata and temporary pages; do not run two copies against the same checkout.
Cleanup attempts each restoration even if a diagnostic fails. It stops only its
own CLI process group and the selected fixture application. Environment metadata
reads the example's actual packages, not the demo's different Vue version.

The initial environment report captures the source commit, dirty state and installed
packages before fixture edits, with `device.metadata.phase: "pending"`. After native
acceptance and all CLI/source/app cleanup attempts, four native tool probes run once.
The final report preserves the initial snapshot and records observations with
`device.metadata.phase: "after-cleanup"` and `collectedAt`. This avoids querying
versions during freshly booted simulator startup; no probe is retried.
Environment command probes retain their 20-second deadlines and settle independently.
A failed probe leaves its value `null` and details in `environment.json` under
`device.metadata.errors`; `device.metadata.complete` is then false. Successful
fields and all command journals remain available. These diagnostics do not prevent
the CLI from building/running the app. An incomplete environment report is not
evidence of an exact toolchain version; native assertion failures still fail the run.
See [the provenance acceptance report](../../../test/native-ios-vite-provenance-183.md).

Acceptance still requires 24 distinct native navigation/watch assertions plus seven
template-retention invariants. `results.json` is the app result; `outcome.json`
also requires successful cleanup. `commands/*.json` records command arguments,
start time, duration, deadline, stdout/stderr and failure code/signal. A command that
never finishes leaves a running record. Diagnostic failures remain explicit even
when native acceptance succeeds. Optional `native-vite.mp4` records the app from
build/startup through the final screenshot, before cleanup terminates it.

Run `node --test scripts/native/conventions/observer.test.mjs` for observer,
real subprocess timeout/output and cleanup regressions. The ordinary CI shell
check runs these tests too. The Native workflow's manual `ios-vite` selection runs
only this hosted lane; default `all` and reusable full-matrix calls retain every lane.

## Controlled slow-launch comparison

[trace-xcrun.py](./trace-xcrun.py) is a test-only wrapper that records actual simctl
commands. With `VITE183_DELAY=1`, it delays CLI-owned launch calls by three seconds;
it never changes application code or invokes delegates. Put a copy named `xcrun`
at the front of PATH for this one command, with an absolute trace destination:

```sh
VITE183_BIN=$(mktemp -d)
cp scripts/native/conventions/trace-xcrun.py "$VITE183_BIN/xcrun"
chmod +x "$VITE183_BIN/xcrun"
PATH="$VITE183_BIN:$PATH" VITE183_DELAY=1 \
  VITE183_TRACE=/tmp/router-vite-launch-trace.jsonl \
  ROUTER_BUNDLER=vite NS_HMR_HOST=127.0.0.1 \
  IOS_SIMULATOR=<dedicated-UUID> OUT=/tmp/router-vite-slow-launch \
  node scripts/native/conventions-watch.mjs ios
```

Compare with the runner at `231e8548af5b85f4ab89805ed59bae1ce9367dec` in a separate
prepared checkout, sequentially on the dedicated simulator. The former runner
issues a competing launch while the CLI is pending; the corrected runner issues
none. Both versions complete all native assertions in this controlled experiment.
The unchanged CLI itself may issue multiple launches under the injected delay;
the retained trace reports them. This proves the runner race, not the cause of the
original hosted timeout. See [the report](../../../test/native-ios-vite-183.md).

## Controlled environment failure

[fail-environment.py](./fail-environment.py) is a test-only `xcodebuild` shim.
It fails only the convention runner's `-version` subprocess with exit code 7;
the CLI's commands and actual native builds are forwarded unchanged. It records
the parent command and injected failure. Install it under the executable name:

```sh
VITE183_ENV_BIN=$(mktemp -d)
cp scripts/native/conventions/fail-environment.py "$VITE183_ENV_BIN/xcodebuild"
chmod +x "$VITE183_ENV_BIN/xcodebuild"
PATH="$VITE183_ENV_BIN:$PATH" VITE183_ENV_TRACE=/tmp/router-environment-trace.jsonl \
  ROUTER_BUNDLER=vite NS_HMR_HOST=127.0.0.1 \
  IOS_SIMULATOR=<dedicated-UUID> RECORD_VIDEO=1 \
  OUT=/tmp/router-environment-control node scripts/native/conventions-watch.mjs ios
```

The runner at `3fc652ef32d0bd62395959b6e60faa37894e5739` exits before spawning
the CLI. The corrected runner preserves the error and completes all native checks.
Run comparisons sequentially in prepared checkouts and fresh output directories.
Final ordinary acceptance uses the normal PATH with no shim. This control proves
failure isolation; it does not diagnose why a hosted version query timed out.
See [the follow-up report](../../../test/native-ios-vite-environment-183.md).
