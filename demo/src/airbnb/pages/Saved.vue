<script setup lang="ts">
import { computed } from 'nativescript-vue'
import { useRouter } from 'vue-router-ns'
import { stays } from '../data'
import { saved } from '../store'
import StayCard from '../components/StayCard.vue'
import { usePageScroll } from '../utils/page-scroll'
const readingPosition = usePageScroll()
const router = useRouter()
const favorites = computed(() => stays.filter((stay) => saved.value.includes(stay.id)))
</script>

<template>
  <Page actionBarHidden="true" class="airbnb-page">
    <ScrollView
      scrollBarIndicatorVisible="false"
      @loaded="readingPosition.layout"
      @layoutChanged="readingPosition.layout"
      @scroll="readingPosition.scroll"
    >
      <StackLayout class="feed">
        <Label class="page-title" text="Favoritos" />
        <Label
          class="muted"
          :text="
            favorites.length
              ? `${favorites.length} ${favorites.length === 1 ? 'acomodação salva' : 'acomodações salvas'}`
              : 'Você ainda não salvou acomodações.'
          "
          textWrap="true"
          marginBottom="28"
        />
        <StayCard v-for="stay in favorites" :key="stay.id" :stay="stay" />
        <StackLayout v-if="!favorites.length" class="empty-state">
          <Label class="icon empty-icon" text="&#xe87e;" />
          <Label class="empty-title" text="Seus favoritos" textWrap="true" />
          <Label
            class="muted"
            text="Toque no coração de uma acomodação para encontrá-la aqui depois."
            textWrap="true"
          />
          <Button
            class="primary"
            text="Explorar acomodações"
            @tap="router.backToRoot({ frame: 'explore' })"
          />
        </StackLayout>
      </StackLayout>
    </ScrollView>
  </Page>
</template>
