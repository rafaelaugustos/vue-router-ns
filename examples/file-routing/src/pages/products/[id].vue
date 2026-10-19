<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router-ns'
import { useDraft, selectedColor } from '../../state'
definePageMeta({ meta: { title: 'Field notes', revision: 1 } })
const route = useRoute('products-id'),
  router = useRouter()
const draft = useDraft('')
async function color() {
  const result = await router.pushForResult<string>('/color')
  if (result) selectedColor.value = result
}
</script>
<template>
  <ScrollView
    ><StackLayout class="content">
      <Label text="A PLACE FOR YOUR IDEAS" class="eyebrow" />
      <Label
        id="page-heading"
        text="The everyday notebook"
        class="heading"
        accessible="true"
        textWrap="true"
      />
      <StackLayout class="swatch"
        ><Label :text="selectedColor" class="swatch-text"
      /></StackLayout>
      <Label
        :text="`Edition ${route.params.id} · 120 pages · Made to keep`"
        class="subtitle"
      />
      <TextField v-model="draft" hint="Add a personal note" />
      <Button text="Choose a color" class="primary" @tap="color" />
      <Button text="Back to collection" @tap="router.back()" /> </StackLayout
  ></ScrollView>
</template>
