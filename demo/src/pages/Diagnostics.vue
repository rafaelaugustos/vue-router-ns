<script lang="ts" setup>
import { getCurrentInstance, onUnmounted, shallowRef } from 'nativescript-vue'
import { Utils, type Page } from '@nativescript/core'
import { onPageActivated, useRouter } from 'vue-router-ns'
import { showNativeMismatch } from '../diagnostics'

const router = useRouter()
const diagnostics = router.diagnostics!
const instance = getCurrentInstance()!
const report = shallowRef('')
const timeline = shallowRef('')
const status = shallowRef('')
let pending: ReturnType<typeof setTimeout> | undefined

function refresh() {
  if (pending !== undefined) clearTimeout(pending)
  pending = undefined
  report.value = JSON.stringify(diagnostics.snapshot(), null, 2)
  timeline.value = diagnostics.events
    .slice(-35)
    .map(
      (event) =>
        `${event.time.toFixed(1)}ms ${event.navigationId ? `#${event.navigationId} ` : ''}${event.phase} ${event.status} ${event.detail ?? ''}${event.duration === undefined ? '' : ` ${event.duration.toFixed(1)}ms`}${event.outcome ? ` ${event.outcome}` : ''}${event.code ? ` ${event.code}` : ''}`,
    )
    .join('\n')
}

const stop = diagnostics.subscribe(() => {
  if (pending === undefined) pending = setTimeout(refresh, 50)
})
onPageActivated(refresh)
onUnmounted(() => {
  stop()
  if (pending !== undefined) clearTimeout(pending)
})

function copy() {
  Utils.copyToClipboard(diagnostics.export())
  status.value = 'Redacted JSON report copied'
}

function mismatch() {
  const page = instance.proxy!.$el.nativeView as Page
  showNativeMismatch(page.frame, diagnostics)
}

function clear() {
  diagnostics.clear()
  refresh()
}
</script>

<template>
  <Page>
    <ActionBar title="Navigation diagnostics" />
    <ScrollView>
      <StackLayout class="section">
        <Label text="Debug-only inspector" class="title" />
        <Label
          text="Try each scenario, then return to compare guard, mount and transition durations. Reports contain route patterns and opaque IDs."
          textWrap="true"
          class="muted"
        />
        <Button
          text="Slow guard (350ms)"
          class="button"
          @tap="router.push('/diagnostics/slow')"
        />
        <Button
          text="Heavy page setup (80ms)"
          class="button"
          @tap="router.push('/diagnostics/heavy')"
        />
        <Button text="Unmanaged native Page" class="button secondary" @tap="mismatch" />
        <Button text="Copy JSON report" class="button secondary" @tap="copy" />
        <Button text="Clear timeline" class="button secondary" @tap="clear" />
        <Label :text="status" class="muted" textWrap="true" />
        <Label text="Latest events" class="title" />
        <Label :text="timeline" fontFamily="monospace" fontSize="11" textWrap="true" />
        <Label text="Logical / native snapshot" class="title" />
        <Label :text="report" fontFamily="monospace" fontSize="11" textWrap="true" />
      </StackLayout>
    </ScrollView>
  </Page>
</template>
