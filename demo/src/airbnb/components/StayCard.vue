<script setup lang="ts">
import { PageTransition, SharedTransition } from '@nativescript/core'
import { RouterLink, type RouteMenuOptions } from 'vue-router-ns'
import type { Stay } from '../data'
import { money, stayTotal } from '../utils/stays'
import { saved, toggleSaved } from '../store'
import StayPreview from './StayPreview.vue'
const props = withDefaults(
  defineProps<{ stay: Stay; compact?: boolean; cardWidth?: number }>(),
  {
    compact: false,
    cardWidth: 170,
  },
)
const transition = SharedTransition.custom(new PageTransition())
const menu: RouteMenuOptions = {
  preview: StayPreview,
  props: { stay: props.stay },
  size: { width: 320, height: 350 },
  openTitle: 'Ver acomodação',
  actions: [
    {
      get title() {
        return saved.value.includes(props.stay.id)
          ? 'Remover dos favoritos'
          : 'Salvar nos favoritos'
      },
      image: 'heart',
      run: () => toggleSaved(props.stay.id),
    },
  ],
}
</script>

<template>
  <StackLayout
    class="stay-card"
    :class="{ 'compact-card': compact }"
    :width="compact ? cardWidth : undefined"
  >
    <GridLayout :height="compact ? Math.round(cardWidth * 0.95) : 300">
      <RouterLink :to="`/stays/${stay.id}`" zoom :transition="transition" :menu="menu">
        <GridLayout
          class="photo-card"
          :accessibilityLabel="`Ver ${stay.title}, ${stay.location}`"
          accessible="true"
          accessibilityRole="button"
        >
          <Image
            :src="stay.image"
            stretch="aspectFill"
            :sharedTransitionTag="`stay-${stay.id}`"
          />
          <Label
            class="guest-favorite"
            :text="compact ? 'Preferido' : 'Preferido dos hóspedes'"
            horizontalAlignment="left"
            verticalAlignment="top"
          />
        </GridLayout>
      </RouterLink>
      <GridLayout
        class="save-control"
        horizontalAlignment="right"
        verticalAlignment="top"
        :width="compact ? 32 : 36"
        :height="compact ? 32 : 36"
        :margin="compact ? 8 : 12"
      >
        <Label
          v-if="compact"
          class="icon"
          text="&#xe87d;"
          :color="saved.includes(stay.id) ? '#ff385c' : '#66000000'"
          fontSize="25"
          textAlignment="center"
          verticalAlignment="middle"
          isUserInteractionEnabled="false"
        />
        <Button
          class="icon heart-button"
          :text="compact ? '\ue87e' : saved.includes(stay.id) ? '\ue87d' : '\ue87e'"
          :color="compact ? '#ffffff' : saved.includes(stay.id) ? '#ff385c' : '#222222'"
          :accessibilityLabel="
            saved.includes(stay.id) ? 'Remover dos favoritos' : 'Salvar nos favoritos'
          "
          @tap="toggleSaved(stay.id)"
        />
      </GridLayout>
    </GridLayout>
    <RouterLink :to="`/stays/${stay.id}`">
      <StackLayout
        :paddingTop="compact ? 8 : 13"
        paddingBottom="5"
        :paddingLeft="compact ? 3 : 0"
      >
        <Label
          v-if="compact"
          class="compact-title"
          :text="stay.cardTitle || stay.title"
        />
        <GridLayout v-else columns="*, auto">
          <Label class="card-title" :text="stay.location" />
          <Label col="1" class="rating" :text="`★ ${stay.rating}`" />
        </GridLayout>
        <Label v-if="!compact" class="muted card-line" :text="stay.distance" />
        <Label class="muted card-line" :text="stay.dates" />
        <Label
          v-if="compact"
          class="compact-total"
          :text="`${stayTotal(stay)} total · ★ ${stay.rating}`"
        />
        <Label v-else marginTop="7">
          <FormattedString>
            <Span :text="money(stay.price)" fontWeight="700" />
            <Span text=" / noite" />
          </FormattedString>
        </Label>
      </StackLayout>
    </RouterLink>
  </StackLayout>
</template>

<style scoped>
.stay-card {
  margin-bottom: 27;
}
.photo-card {
  border-radius: 16;
  background-color: #eeeeee;
}
.photo-card Image {
  border-radius: 16;
}
.guest-favorite {
  margin: 14;
  padding: 7 12;
  border-radius: 16;
  background-color: #ffffff;
  font-size: 11;
  font-weight: 700;
}
.heart-button {
  width: 36;
  height: 36;
  border-radius: 18;
  margin: 0;
  font-size: 23;
  background-color: #ffffff;
}
.compact-card {
  margin-right: 12;
  margin-bottom: 0;
}
.compact-card .photo-card,
.compact-card .photo-card Image {
  border-radius: 20;
}
.compact-card .guest-favorite {
  margin: 12 10;
  padding: 5 8;
  border-radius: 15;
  border-width: 1;
  border-color: #ffffff;
  background-color: #f9f9f9;
  font-size: 10;
  font-weight: 600;
}
.compact-card .heart-button {
  width: 32;
  height: 32;
  border-radius: 0;
  background-color: transparent;
  font-size: 25;
}
.compact-title {
  font-size: 11.5;
  font-weight: 600;
}
.compact-card .card-line {
  font-size: 10.5;
  margin-top: 4;
}
.compact-total {
  font-size: 10.5;
  color: #717171;
  margin-top: 3;
}
.card-title {
  font-weight: 600;
  font-size: 15;
}
.rating {
  font-size: 14;
  margin-left: 8;
}
.card-line {
  font-size: 14;
  margin-top: 4;
}
</style>
