<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router-ns'

const route = useRoute()
const router = useRouter()
</script>

<template>
  <Page>
    <ActionBar title="Not found" />

    <StackLayout class="content center">
      <Label class="emoji" text="🧭" />
      <Label class="title" text="Nothing here" textAlignment="center" />
      <Label
        class="caption"
        text="The route matched the catch-all record."
        textAlignment="center"
        marginTop="4"
        marginBottom="16"
      />
      <Label class="chip" :text="route.fullPath" horizontalAlignment="center" />
      <Button
        class="button secondary"
        text="Go back"
        width="100%"
        marginTop="24"
        @tap="router.back()"
      />
    </StackLayout>
  </Page>
</template>
