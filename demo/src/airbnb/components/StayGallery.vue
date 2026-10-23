<script setup lang="ts">
import { computed, ref } from 'nativescript-vue'
import { usePageState } from 'vue-router-ns'
import { interior, type Stay } from '../data'
import { saved, toggleSaved } from '../store'

const props = defineProps<{ stay: Stay; height: number; topInset: number }>()
const emit = defineEmits<{ back: [] }>()
const photo = ref(0)
const photos = computed(() => [props.stay.image, interior])
usePageState('gallery', {
  save: () => ({ photo: photo.value }),
  restore(value) {
    if (
      Number.isInteger(value.photo) &&
      value.photo >= 0 &&
      value.photo < photos.value.length
    ) {
      photo.value = value.photo
    }
  },
})

function nextPhoto() {
  photo.value = (photo.value + 1) % photos.value.length
}
</script>

<template>
  <GridLayout :height="height" class="hero">
    <Image
      :src="photos[photo]"
      stretch="aspectFill"
      :sharedTransitionTag="`stay-${stay.id}`"
      @tap="nextPhoto"
      accessibilityLabel="Ver próxima foto"
    />
    <Button
      class="icon round-button back-button"
      text="&#xe5c4;"
      horizontalAlignment="left"
      verticalAlignment="top"
      :marginTop="topInset + 8"
      accessibilityLabel="Voltar"
      @tap="emit('back')"
    />
    <Button
      class="icon round-button"
      :text="saved.includes(stay.id) ? '\ue87d' : '\ue87e'"
      :color="saved.includes(stay.id) ? '#ff385c' : '#222222'"
      horizontalAlignment="right"
      verticalAlignment="top"
      :marginTop="topInset + 8"
      :accessibilityLabel="
        saved.includes(stay.id) ? 'Remover dos favoritos' : 'Salvar nos favoritos'
      "
      @tap="toggleSaved(stay.id)"
    />
    <Button
      class="photo-count"
      :text="`${photo + 1} / ${photos.length}`"
      horizontalAlignment="right"
      verticalAlignment="bottom"
      accessibilityLabel="Próxima foto"
      @tap="nextPhoto"
    />
  </GridLayout>
</template>

<style scoped>
.round-button {
  width: 40;
  height: 40;
  border-radius: 20;
  margin: 18;
  background-color: #e8e7e3;
  font-size: 22;
}
.photo-count {
  margin: 16 20 44;
  padding: 7 12;
  background-color: #222222;
  color: #ffffff;
  border-radius: 8;
  font-size: 12;
  height: 32;
}
</style>
