# Independent iOS Frame adapter

This private example is a separately built and packed package implementing
`NativeHost` version 1. It imports only the documented root exports of
`vue-router-ns`, NativeScript Core and NativeScript-Vue. It does not wrap a built-in
router host, import router source, or require a test framework.

The validated dependency floor is Core 9.1.4, NativeScript-Vue 3.1.3 and the
candidate router containing the conformance fixes. The broad router peer range
allows packing the current prerelease; it is not evidence that earlier rc.4
artifacts contain these fixes. This package is a reference, not a published SDK.

```ts
import { Frame } from '@nativescript/core'
import { mountNativeHost } from 'vue-router-ns'
import { createExternalFrameHost } from '@vue-router-ns/example-frame-host'

const frame = new Frame()
const host = createExternalFrameHost(frame)
const unmount = mountNativeHost(router, 'sidebar', host, '/')
// Add frame to your native owner. Later, before permanently removing that owner:
unmount()
```

The adapter implements push, replace, clearHistory and Back with stable retained
Page identities. It mounts and unmounts its own Vue views. Unloaded Frames queue
their initial presentation through Core. Covering and revealing a retained owner
Page preserves the host and its Vue state. Removing a Frame from its parent tears
down its native controller in Core: call the returned unmount function and create
a fresh Frame/adapter for the new owner. Reusing a permanently removed Frame is
not a supported reattachment operation.

Unsupported: Android, modal owner closure, held modal dismissal, pinned roots,
multiple visible pages, predictive Back preview and script-HMR replacement. The
example does not provide transition progress/control or Jolt integration.

Run the [packed consumer and native driver](../../scripts/native/native-host/README.md).
See the [versioned report](../../test/native-host-conformance-v1.md) for evidence
and remaining limits. Passing the harness does not make the contract stable.
