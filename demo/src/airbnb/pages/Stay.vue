<script setup lang="ts">
import { ref } from 'nativescript-vue'
import { Deferred, useNavigationFocus, useRouteData, useRouter } from 'vue-router-ns'
import {
  Dialogs,
  Screen,
  type EventData,
  type Page,
  type ScrollView,
} from '@nativescript/core'
import { stayData } from '../stay-data'
import { usePageScroll } from '../utils/page-scroll'
import { stayTotal } from '../utils/stays'
import StayGallery from '../components/StayGallery.vue'
import StaySummary from '../components/StaySummary.vue'
import StayDetails from '../components/StayDetails.vue'
import BookingBar from '../components/BookingBar.vue'

const router = useRouter()
const details = useRouteData(stayData)
const { data: stay, status } = details
const readingPosition = usePageScroll()
useNavigationFocus({ initial: 'stay-heading' })
const topInset = ref(0)
const bottomInset = ref(0)
const heroHeight = ref(Math.round(Screen.mainScreen.widthDIPs * 0.94))
const statusBarStyle = ref<'light' | 'dark'>('light')
function updateLayout({ object }: EventData) {
  const page = object as Page
  const insets = page.ios?.view.safeAreaInsets
  topInset.value = insets?.top ?? 0
  bottomInset.value = insets?.bottom ?? 0
  const width = page.getActualSize().width
  if (width > 0) heroHeight.value = Math.round(width * 0.94)
}
function onScroll({ object }: EventData) {
  readingPosition.scroll({ object, eventName: 'scroll' })
  statusBarStyle.value =
    (object as ScrollView).verticalOffset < heroHeight.value - 28 - topInset.value
      ? 'light'
      : 'dark'
}
function reserve() {
  if (!stay.value) return
  Dialogs.alert({
    title: 'Resumo da reserva',
    message: `${stay.value.title}\n${stay.value.dates} · ${stay.value.nights ?? 5} noites\n${stayTotal(stay.value)} no total.\n\nEsta é uma acomodação fictícia do demo. Nenhuma reserva ou cobrança será feita.`,
    okButtonText: 'Fechar',
  })
}
</script>

<template>
  <Page
    actionBarHidden="true"
    class="airbnb-page"
    :statusBarStyle="statusBarStyle"
    @loaded="updateLayout"
    @layoutChanged="updateLayout"
  >
    <GridLayout
      v-if="stay"
      rows="*, auto"
      iosIgnoreSafeArea="true"
      :marginTop="-topInset"
    >
      <ScrollView
        scrollBarIndicatorVisible="false"
        iosContentInsetAdjustmentBehavior="never"
        @scroll="onScroll"
        @loaded="readingPosition.layout"
        @layoutChanged="readingPosition.layout"
      >
        <StackLayout>
          <StayGallery
            :key="stay.id"
            :stay="stay"
            :height="heroHeight"
            :topInset="topInset"
            @back="router.back()"
          />
          <StackLayout class="detail-content">
            <StaySummary :stay="stay" />
            <Deferred>
              <StayDetails :stay="stay" />
              <template #fallback>
                <StackLayout height="240" padding="24">
                  <ActivityIndicator :busy="true" color="#ff385c" />
                  <Label
                    text="Preparando os detalhes…"
                    class="muted"
                    textAlignment="center"
                  />
                </StackLayout>
              </template>
            </Deferred>
          </StackLayout>
        </StackLayout>
      </ScrollView>
      <BookingBar row="1" :stay="stay" :bottomInset="bottomInset" @reserve="reserve" />
    </GridLayout>
    <StackLayout v-else class="empty-state">
      <ActivityIndicator v-if="status === 'pending'" :busy="true" color="#ff385c" />
      <Label
        id="stay-heading"
        accessible="true"
        class="empty-title"
        :text="
          status === 'pending'
            ? 'Carregando acomodação…'
            : status === 'error'
              ? 'Não foi possível carregar a acomodação'
              : 'Acomodação não encontrada'
        "
        textWrap="true"
      />
      <Button
        v-if="status === 'error'"
        class="primary"
        text="Tentar novamente"
        @tap="details.reload()"
      />
      <Button class="primary" text="Voltar" @tap="router.back()" />
    </StackLayout>
  </Page>
</template>

<style scoped>
.detail-content {
  padding: 30 24 20;
  margin-top: -28;
  border-radius: 30 30 0 0;
  background-color: #ffffff;
}
</style>
