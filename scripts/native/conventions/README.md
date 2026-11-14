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
