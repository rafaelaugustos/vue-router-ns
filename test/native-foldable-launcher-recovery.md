# Foldable input: Pixel Launcher ANR recovery

Focused validation for [#173](https://github.com/rafaelaugustos/vue-router-ns/issues/173), 2026-10-30. This corrects the Android input driver, not the router runtime.

## Evidence and cause

In [run 40311133442, foldable job 121532374913](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/40311133442/job/121532374913), the input driver reported `Missing native input target: permanent`. Its retained `adaptive-input/window.xml` contains only the Android system dialog **Pixel Launcher isn't responding**, with `android:id/aerr_close` and `android:id/aerr_wait`. The fixture's controls were inaccessible behind that dialog. The [original hierarchy](./evidence/foldable-launcher-anr.xml) is preserved verbatim as a regression input.

This establishes the obstruction that caused the missing-target failure. It does not explain why Pixel Launcher stopped responding on the hosted runner, or establish a drawer runtime defect.

## Correction

The input driver recognizes the system-owned English launcher ANR and allows one dismissal per process invocation. It captures the original hierarchy and a screenshot before tapping Close app, records the fixture PID before/after, and reads a fresh hierarchy before continuing the original scenario. It neither restarts the fixture nor retries a failed navigation assertion.

A second launcher ANR fails. ANRs from the fixture or another application fail without dismissal. Missing/invalid Close app bounds, absent fixture processes, PID changes and failed evidence capture also fail. Each detected ANR has numbered evidence; a repeated failure cannot overwrite the first recovery's report.

## Local validation

Environment: macOS arm64 host; dedicated `RouterFold60CI35` Pixel Fold emulator, API 35 arm64 Google APIs, 2208 × 1840 at 420 dpi. Fingerprint: `google/sdk_gphone64_arm64/emu64a:15/AE3A.240806.043/12960925:userdebug/dev-keys`. Published Core **9.1.3**, NativeScript-Vue **3.1.3**, Android runtime **9.1.1**; no upstream preview patches. Native drivers ran on Node 20.19.4; unit tests on Node 22.23.3.

| Control                                                         | Result                                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Corrected input driver, no injected ANR                         | Complete native input scenario passed; no recovery used                                                |
| Unmodified input driver from `64094e1`, real launcher ANR       | Failed with the same `Missing native input target: permanent` as CI; hierarchy contains the system ANR |
| Corrected input driver, same real launcher ANR                  | One dismissal; fixture PID **6205 → 6205**; complete native input scenario passed                      |
| Adaptive identity/state contract driver                         | All **38 commands** passed                                                                             |
| Unit/type suite                                                 | **661 passed**, 10 existing skips, no type errors; includes 13 recovery regression tests               |
| Package typecheck, formatting and native UI shell driver checks | Passed                                                                                                 |

For the controlled fault, root access on this dedicated userdebug emulator was used to send `SIGSTOP` only to `com.google.android.apps.nexuslauncher`, followed by a real input tap. Android itself produced the input-dispatch ANR dialog. Background ANR display was temporarily enabled. The old and corrected input drivers each initialized the real fixture normally while that obstruction persisted. Cleanup resumed the launcher if still suspended and restored the original ANR setting. Neither a synthetic dialog nor a mocked hierarchy was used for these native comparisons. The evidence archive includes the injection script, reports and raw recording. This deliberate fault injection is not enabled in CI or package code.

The corrected run checks real permanent-pane taps, push, text input, retained draft across stacks, overlay accessibility reachability, RTL/LTR and system Back. Its continuous 55-second device recording shows the ANR being dismissed and the complete visible flow at original speed; the JSON report provides the PID evidence. The first full unit attempt inside the filesystem sandbox blocked watcher/server tests; the unchanged suite passed outside the sandbox.

## Limits

The local emulator uses arm64; the hosted foldable lane uses Linux/x86_64. A new hosted foldable run and the complete native matrix remain pending. The other three failures in #173 (API 36 Back, iPad Spotlight and iPad scene reconnection) are not resolved by this change. Keep #173 open until its full acceptance criteria are met. No release or API promotion is implied.
