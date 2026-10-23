<script setup lang="ts">
import type { Stay } from '../data'

defineProps<{ stay: Stay }>()
</script>

<template>
  <StackLayout>
    <Label
      id="stay-heading"
      accessible="true"
      class="detail-title"
      :text="stay.title"
      textWrap="true"
    />
    <Label class="detail-location" :text="stay.location" textWrap="true" />
    <Label
      class="muted"
      :text="`${stay.guests} hóspedes · ${stay.guests > 2 ? '2 quartos' : '1 quarto'} · 1 banheiro`"
      marginTop="6"
      textAlignment="center"
      textWrap="true"
    />
    <GridLayout columns="2*, 1, 3*, 1, 2*" class="favorite-panel">
      <StackLayout verticalAlignment="middle">
        <Label
          :text="stay.rating"
          fontSize="18"
          fontWeight="700"
          textAlignment="center"
        />
        <Label text="★★★★★" fontSize="10" textAlignment="center" marginTop="2" />
      </StackLayout>
      <StackLayout col="1" height="32" backgroundColor="#ebebeb" />
      <StackLayout
        col="2"
        orientation="horizontal"
        horizontalAlignment="center"
        verticalAlignment="middle"
      >
        <Label text="❦" fontSize="28" marginRight="5" verticalAlignment="middle" />
        <Label
          :text="'Preferido dos\nhóspedes'"
          textWrap="true"
          fontWeight="700"
          fontSize="13"
          textAlignment="center"
        />
        <Label
          text="❦"
          fontSize="28"
          marginLeft="5"
          scaleX="-1"
          verticalAlignment="middle"
        />
      </StackLayout>
      <StackLayout col="3" height="32" backgroundColor="#ebebeb" />
      <StackLayout col="4" verticalAlignment="middle">
        <Label
          :text="String(stay.reviews)"
          fontSize="18"
          fontWeight="700"
          textAlignment="center"
        />
        <Label text="avaliações" fontSize="11" textAlignment="center" marginTop="2" />
      </StackLayout>
    </GridLayout>
  </StackLayout>
</template>

<style scoped>
.detail-title {
  font-size: 25;
  font-weight: 700;
  letter-spacing: -0.035;
  margin-bottom: 22;
  text-align: center;
}
.detail-location {
  font-size: 14;
  color: #717171;
  text-align: center;
}
.favorite-panel {
  padding: 0 0 28;
  margin-top: 24;
  border-bottom-width: 1;
  border-bottom-color: #ebebeb;
}
</style>
