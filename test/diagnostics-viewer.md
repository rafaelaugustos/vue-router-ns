# Diagnostics report viewer validation — #135

2026-10-24. Browser-only consumer of the existing `DiagnosticsExport` version 1 schema. No collector, native lifecycle or published runtime implementation changes.

## Evidence

- 640 unit tests pass (10 skipped), including 20 viewer cases: an actual collector export with an intentionally unmanaged native Page round-trips through the parser; route values remain redacted. Schema errors, field whitelisting, overlapping requests, redirects, missing/conflicting boundaries and independent report/window identities are covered.
- Chromium 156 browser acceptance passes for local imports, phase/outcome/request filters, native mismatch, truncated buffers, multiple independent captures, Portuguese, untrusted strings, 10,000-event pagination, mobile layout and keyboard filters. No console errors or outbound asset/report requests are observed.
- The hosted HTML download is opened with the browser offline and still imports a report. Reload/clear does not restore data from storage. Replacing a pending import with examples invalidates the old load.
- The actual viewer recording uses explicitly synthetic teaching reports. Its timings are examples, not device performance evidence. The same MP4 is embedded in the EN/pt-BR guides and attached to the PR.

Reproduce with [`scripts/diagnostics-viewer`](../scripts/diagnostics-viewer/README.md). Raw screenshots and `checks.json` are generated under its ignored `out` directory.

## Interpretation and ownership

Files remain separate captures even if IDs collide. Active entries do not identify the focused window. Hosts retain their own roles/window IDs; missing windows remain unknown. Snapshot issues are shown as reported, while positional comparisons are deferred for busy stacks. Summary cards and snapshot issues cover the full selected capture even when filters narrow the rows.

Start/end boundaries pair by span ID, with navigation/parent IDs preserved. Spans overlap and are never summed into a total. End-only spans show a reported duration and a point at the retained end, not an invented start. Start-only spans get no inferred duration. Conflicting boundaries remain explicit. Mount time includes synchronous Vue setup and native view creation; the viewer does not infer isolated setup time, FPS, first-pixel latency or heap usage.

The generated HTML contains its own code/styles and no analytics or remote assets. It uses a network-denying Content Security Policy, in-memory file handling, a schema whitelist and text-only rendering. File names, route patterns and names are still application/user-provided strings; validation cannot certify that manually modified reports contain no personal data.

## Boundaries

This is a read-only report viewer, not live DevTools, a transport, a profiler, a stack editor or restoration/time travel. Physical-device performance and native UI regressions are not claimed by these browser tests. The native collector is unchanged and retains its existing separate coverage.

Chromium desktop and narrow-viewport interaction checks are automated evidence, not a screen-reader certification or a complete Safari/Firefox matrix. Managed browsers can restrict local-file scripting; localhost serving remains an alternative. Native heap profiling, physical assistive technology and live runtime attachment are outside this delivery.
