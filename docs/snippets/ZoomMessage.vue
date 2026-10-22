<script setup lang="ts">
const props = defineProps<{ id: string }>()
const subjects: Record<string, string> = {
  '1': 'Lunch on Friday?',
  '2': 'Release notes',
}
</script>

<template>
  <Page>
    <ActionBar title="Message" />
    <StackLayout padding="24">
      <Label
        :text="subjects[props.id] ?? 'Message'"
        :sharedTransitionTag="`message-${props.id}`"
        fontSize="28"
        textWrap="true"
      />
      <Label
        text="This is a native Page. Use Back to return to the inbox."
        textWrap="true"
      />
    </StackLayout>
  </Page>
</template>
