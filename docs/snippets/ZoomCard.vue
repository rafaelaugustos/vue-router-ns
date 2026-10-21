<script setup lang="ts">
import { RouterLink } from 'vue-router-ns'
</script>

<template>
  <Page>
    <ActionBar title="Inbox" />
    <StackLayout padding="24">
      <RouterLink :to="{ name: 'message', params: { id: 1 } }" zoom>
        <StackLayout padding="24" borderRadius="16" backgroundColor="#dbeafe">
          <Label text="Ana" color="#1e3a8a" fontSize="24" />
          <Label text="Lunch on Friday?" color="#1e3a8a" textWrap="true" />
        </StackLayout>
      </RouterLink>
    </StackLayout>
  </Page>
</template>
