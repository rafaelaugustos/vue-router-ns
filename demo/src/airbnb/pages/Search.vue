<script setup lang="ts">
import { computed, ref } from 'nativescript-vue'
import { useNavigationFocus, useRouter } from 'vue-router-ns'
import { matchingStays, money } from '../utils/stays'
import { defaultSearch } from '../store'
const props = defineProps<{ destination?: string; maxPrice?: number }>()
const router = useRouter()
useNavigationFocus({ initial: 'search-heading' })
const destination = ref(props.destination ?? defaultSearch.destination)
const maxPrice = ref(props.maxPrice ?? defaultSearch.maxPrice)
const count = computed(() => matchingStays(destination.value, maxPrice.value).length)
const suggestions = ['Guarujá', 'São Paulo', 'São Francisco', 'Gonçalves', 'Paraty']
function clear() {
  destination.value = defaultSearch.destination
  maxPrice.value = defaultSearch.maxPrice
}
function apply() {
  router.back({
    result: {
      destination: destination.value.trim(),
      maxPrice: Math.round(maxPrice.value),
    },
  })
}
</script>

<template>
  <Page actionBarHidden="true" class="airbnb-page">
    <GridLayout rows="auto, *, auto" padding="24">
      <GridLayout columns="*, 44" marginTop="12" marginBottom="24">
        <Label
          id="search-heading"
          accessible="true"
          class="page-title"
          text="Buscar acomodações"
          textWrap="true"
          marginTop="0"
        />
        <Button
          col="1"
          class="icon close-button"
          text="&#xe5cd;"
          accessibilityLabel="Fechar busca"
          @tap="router.back()"
        />
      </GridLayout>
      <ScrollView row="1">
        <StackLayout>
          <Label class="section-heading" text="Para onde?" marginBottom="16" />
          <TextField
            v-model="destination"
            class="search-field"
            hint="Busque um destino"
            returnKeyType="search"
            @returnPress="apply"
            accessibilityLabel="Destino"
          />
          <Label
            class="eyebrow"
            text="DESTINOS SUGERIDOS"
            marginTop="28"
            marginBottom="12"
          />
          <GridLayout
            v-for="city in suggestions"
            :key="city"
            columns="42, *"
            class="destination-row"
            @tap="destination = city"
            accessible="true"
            accessibilityRole="button"
            :accessibilityLabel="city"
          >
            <Label class="icon destination-icon" text="&#xe55f;" />
            <Label col="1" :text="city" verticalAlignment="middle" marginLeft="14" />
          </GridLayout>
          <Label class="section-heading" text="Seu orçamento por noite" marginTop="28" />
          <Label :text="`Até ${money(Math.round(maxPrice))}`" marginTop="12" />
          <Slider
            v-model="maxPrice"
            minValue="200"
            :maxValue="defaultSearch.maxPrice"
            color="#ff385c"
            backgroundColor="#eeeeee"
            marginTop="18"
            accessibilityLabel="Preço máximo por noite"
          />
        </StackLayout>
      </ScrollView>
      <GridLayout row="2" columns="auto, *" paddingTop="20">
        <Button text="Limpar" class="text-button" @tap="clear" />
        <Button
          col="1"
          class="primary"
          :text="`Mostrar ${count} ${count === 1 ? 'lugar' : 'lugares'}`"
          marginTop="0"
          marginLeft="18"
          @tap="apply"
        />
      </GridLayout>
    </GridLayout>
  </Page>
</template>

<style scoped>
.eyebrow {
  font-size: 9;
  font-weight: 700;
  letter-spacing: 0.14;
  color: #717171;
}
.search-field {
  padding: 18;
  border-width: 1;
  border-color: #b0b0b0;
  border-radius: 12;
  font-size: 16;
  color: #222222;
  placeholder-color: #717171;
}
.destination-row {
  padding: 8 0;
}
.destination-icon {
  background-color: #f4f4f4;
  border-radius: 10;
  width: 42;
  height: 42;
  font-size: 23;
  padding: 9;
}
</style>
