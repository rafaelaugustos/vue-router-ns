<script setup lang="ts">
import { computed, ref } from 'nativescript-vue'
import { Screen, type EventData, type View } from '@nativescript/core'
import { useNavigationFocus, usePageState, useRouter } from 'vue-router-ns'
import { categories, staySections, type Category } from '../data'
import { usePageScroll } from '../utils/page-scroll'
import { matchingStays, staysForSection } from '../utils/stays'
import { search, defaultSearch, type SearchFilters } from '../store'
import ExploreHeader from '../components/ExploreHeader.vue'
import DestinationCarousel from '../components/DestinationCarousel.vue'

const router = useRouter()
const category = ref<Category>('all')
const readingPosition = usePageScroll()
const focus = useNavigationFocus({ return: 'search-button' })
usePageState('category', {
  save: () => ({ category: category.value }),
  restore(value) {
    if (categories.some((item) => item.id === value.category))
      category.value = value.category
  },
})
const width = ref(Screen.mainScreen.widthDIPs)
const cardWidth = computed(() => Math.min(240, Math.round(width.value * 0.425)))
const available = computed(() =>
  matchingStays(search.value.destination, search.value.maxPrice),
)
const sections = computed(() =>
  staySections
    .map((section) => ({
      ...section,
      stays: staysForSection(section, available.value),
    }))
    .filter((section) => section.stays.length),
)
const showHomes = computed(() => category.value === 'all' || category.value === 'homes')
const hasFilters = computed(
  () => !!search.value.destination || search.value.maxPrice < defaultSearch.maxPrice,
)
function resized({ object }: EventData) {
  const measured = (object as View).getActualSize().width
  if (measured > 0) width.value = measured
}
async function findStay() {
  focus.remember('search-button')
  const result = await router.pushForResult<SearchFilters>('/search', {
    props: { ...search.value },
    modal: {
      ios: { detents: ['large'], grabber: true },
      android: { sheet: { state: 'expanded', skipCollapsed: true } },
    },
  })
  if (result) {
    search.value = result
    category.value = 'homes'
  }
}
function clear() {
  search.value = { ...defaultSearch }
  category.value = 'all'
}
function openDestination(id: string) {
  router.push(`/destinations/${id}`)
}
</script>

<template>
  <Page actionBarHidden="true" class="airbnb-page" backgroundColor="#e9e8e6">
    <GridLayout rows="auto, *" @layoutChanged="resized">
      <ExploreHeader
        v-model:category="category"
        :destination="search.destination"
        @search="findStay"
      />
      <ScrollView
        row="1"
        scrollBarIndicatorVisible="false"
        @loaded="readingPosition.layout"
        @layoutChanged="readingPosition.layout"
        @scroll="readingPosition.scroll"
      >
        <StackLayout class="destination-feed">
          <GridLayout
            v-if="hasFilters && showHomes"
            columns="*, auto"
            class="applied-filters"
          >
            <Label
              :text="`${available.length} acomodações encontradas`"
              class="muted"
              fontSize="12"
              verticalAlignment="middle"
            />
            <Button
              col="1"
              text="Limpar"
              class="text-button"
              height="32"
              fontSize="12"
              @tap="clear"
            />
          </GridLayout>
          <StackLayout v-if="showHomes">
            <DestinationCarousel
              v-for="section in sections"
              :key="section.id"
              :section="section"
              :stays="section.stays"
              :cardWidth="cardWidth"
              @open="openDestination"
            />
            <StackLayout v-if="!sections.length" class="empty-state" padding="24">
              <Label
                class="empty-title"
                text="Nenhuma acomodação encontrada"
                textWrap="true"
              />
              <Label
                class="muted"
                text="Tente outro destino ou aumente o orçamento por noite."
                textWrap="true"
              />
              <Button class="primary" text="Limpar filtros" @tap="clear" />
            </StackLayout>
          </StackLayout>
          <StackLayout v-else class="empty-state" padding="32 24">
            <Label
              :text="category === 'experiences' ? '🎈' : '🛎️'"
              fontSize="48"
              marginBottom="20"
            />
            <Label
              class="empty-title"
              :text="
                category === 'experiences' ? 'Experiências em breve' : 'Serviços em breve'
              "
              textWrap="true"
            />
            <Label
              class="muted"
              text="Esta seção ainda não está disponível. Explore as acomodações enquanto isso."
              textWrap="true"
            />
            <Button class="primary" text="Ver acomodações" @tap="category = 'homes'" />
          </StackLayout>
        </StackLayout>
      </ScrollView>
    </GridLayout>
  </Page>
</template>

<style scoped>
.destination-feed {
  padding-top: 8;
  padding-bottom: 24;
  background-color: #ffffff;
}
.applied-filters {
  margin: 0 24 16;
}
</style>
