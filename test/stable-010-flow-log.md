# Android flow log collection

The [0.1.0 release job](https://github.com/rafaelaugustos/vue-router-ns/actions/runs/44388536282/job/135100237676)
completed all twelve native flow outcomes, then failed collecting the unfiltered
Android system log. `execFile` exceeded its eight MiB stdout buffer in `finally`,
so the workflow correctly remained failed and publication was blocked. The
[original job log](./evidence/stable-010-flow-log/hosted-failure.log.gz),
[artifact](./evidence/stable-010-flow-log/hosted-failure.zip), and
[failure metadata](./evidence/stable-010-flow-log/hosted-failure.json) preserve this
execution, including the completed outcomes and missing system log.

The flow runner now calls the existing `captureLogcat` helper used by predictive
Back acceptance. It directs subprocess stdout into the output file and retains
the complete log without a JavaScript stdout buffer. The helper closes the file,
bounds collection to sixty seconds and rejects failed subprocesses. All flow
actions, assertions and runtime-health checks remain unchanged; package code and
contents are unchanged.

A deterministic subprocess control writes twelve MiB plus start/end markers.
The old eight MiB capture rejects it; the shared helper retains every byte and
still rejects an exit status of seven. This is explicitly synthetic subprocess
output, separate from native application acceptance. Its
[result](./evidence/stable-010-flow-log/subprocess-control.json) records the checks.

A fresh Android 35 ARM64 emulator passed all twelve flow outcomes with the final
runner and exited successfully. Its ordinary system log contains 2,062,590 bytes.
[Native validation](./evidence/stable-010-flow-log/native-validation.json) records
the clean source commit, source hash, published Core 9.1.4/Vue 3.1.3 and device;
the [archive](./evidence/stable-010-flow-log/native-android35.zip) retains outcomes,
actions, observations, screenshots and logs.

After that acceptance run, a separate native-log control enlarged the dedicated
emulator's log buffer and added 16,384 numbered diagnostic messages. The old
capture rejected the resulting output. The shared helper saved 23,239,687 bytes,
retaining every numbered message from zero through 16,383. The
[control result](./evidence/stable-010-flow-log/native-log-control.json),
[generator](./evidence/stable-010-flow-log/native-log-control.sh) and
[compressed native log](./evidence/stable-010-flow-log/native-log-control.log.gz)
make this distinct from the ordinary flow run; no test assertion or input was
changed to generate the extra log volume.

[The video](../docs/public/media/stable-010-flow-log.mp4) records the actual Android
35 flow run with the corrected runner: document picker cancellation/selection,
rotation, overlapping flows, disposal, modal use and process recovery. It does
not display the later log-volume control. [Video metadata](./evidence/stable-010-flow-log/video.json)
records the native source and playback conversion.

All 69 native harness tests pass. Hosted acceptance of the correction and the
complete release gate on the final main commit remain required before publication.
