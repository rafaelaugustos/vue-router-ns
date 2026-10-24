<script setup lang="ts">
import { useRouter } from 'vue-router-ns'
import { drawer } from '../state'
const router = useRouter()
</script>
<template>
  <Page>
    <ActionBar title="About Fieldnotes">
      <NavigationButton
        text="Back"
        android.systemIcon="ic_menu_back"
        @tap="router.back()"
      />
      <ActionItem text="Menu" ios.position="right" @tap="drawer?.open()" />
    </ActionBar>
    <StackLayout class="content">
      <Label text="Built on native navigation" class="heading" textWrap="true" />
      <Label
        text="One drawer, one native stack. Page headers, search and menus belong to their native owners. Notes are fictional and kept only in memory."
        class="muted"
        textWrap="true"
      />
      <Button text="Return to library" @tap="router.backToRoot()" />
    </StackLayout>
  </Page>
</template>
