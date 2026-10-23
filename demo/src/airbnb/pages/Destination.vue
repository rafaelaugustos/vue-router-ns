<script setup lang="ts">
import { computed } from 'nativescript-vue'
import { useRouter } from 'vue-router-ns'
import { staySections } from '../data'
import { matchingStays, staysForSection } from '../utils/stays'
import { search } from '../store'
import StayCard from '../components/StayCard.vue'
import { usePageScroll } from '../utils/page-scroll'

const props = defineProps<{ id: string }>()
const router = useRouter()
const readingPosition = usePageScroll()
const section = computed(() => staySections.find((item) => item.id === props.id))
const listings = computed(() => {
  const matches = matchingStays(search.value.destination, search.value.maxPrice)
  return section.value ? staysForSection(section.value, matches) : []
})
</script>

<template>
  <Page actionBarHidden="true" class="airbnb-page">
    <GridLayout rows="auto, *">
      <GridLayout columns="44, *" padding="8 20 16">
        <Button
          class="icon close-button"
          text="&#xe5c4;"
          accessibilityLabel="Voltar"
          @tap="router.back()"
        />
        <Label
          col="1"
          :text="section?.title || 'Destino não encontrado'"
          fontSize="18"
          fontWeight="600"
          marginLeft="12"
          verticalAlignment="middle"
          textWrap="true"
        />
      </GridLayout>
      <ScrollView
        row="1"
        scrollBarIndicatorVisible="false"
        @loaded="readingPosition.layout"
        @layoutChanged="readingPosition.layout"
        @scroll="readingPosition.scroll"
      >
        <StackLayout class="feed">
          <StayCard v-for="stay in listings" :key="stay.id" :stay="stay" />
          <Label
            v-if="!listings.length"
            class="muted"
            text="Nenhuma acomodação disponível com esses filtros."
            textWrap="true"
          />
        </StackLayout>
      </ScrollView>
    </GridLayout>
  </Page>
</template>
