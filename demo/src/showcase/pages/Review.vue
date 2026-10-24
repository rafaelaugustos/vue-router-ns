<script setup lang="ts">
import { useRouter, useNavigationFocus } from 'vue-router-ns'
import { noteById } from '../state'
const props = defineProps<{ id: string }>()
const router = useRouter()
const note = noteById(props.id)
useNavigationFocus({ initial: 'review-heading' })
</script>
<template>
  <Page>
    <ActionBar title="Review note"
      ><ActionItem text="Cancel" ios.position="left" @tap="router.back()"
    /></ActionBar>
    <StackLayout class="content">
      <Label
        id="review-heading"
        text="A moment to reflect"
        class="heading"
        textWrap="true"
      />
      <Label :text="note?.title ?? 'Unknown note'" class="muted" />
      <Label
        text="This modal returns a result to the same detail page."
        textWrap="true"
        marginTop="20"
        marginBottom="20"
      />
      <Button text="Mark as reviewed" @tap="router.back({ result: 'Reviewed today' })" />
    </StackLayout>
  </Page>
</template>
