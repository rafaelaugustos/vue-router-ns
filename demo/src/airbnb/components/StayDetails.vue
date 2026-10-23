<script setup lang="ts">
import type { Stay } from '../data'

defineProps<{ stay: Stay }>()
</script>

<template>
  <StackLayout>
    <GridLayout columns="48, *" class="host-row">
      <Label :text="stay.initials" class="host-avatar" />
      <StackLayout col="1" marginLeft="14" verticalAlignment="middle">
        <Label :text="`Hospedado por ${stay.host}`" fontWeight="600" fontSize="16" />
        <Label
          text="Superhost · 4 anos hospedando"
          class="muted"
          fontSize="13"
          marginTop="4"
        />
      </StackLayout>
    </GridLayout>
    <GridLayout columns="34, *" class="feature-row">
      <Label class="icon" text="&#xe8e8;" fontSize="26" />
      <StackLayout col="1">
        <Label text="Check-in autônomo" fontWeight="600" />
        <Label
          text="Faça check-in por conta própria."
          class="muted"
          fontSize="13"
          marginTop="4"
        />
      </StackLayout>
    </GridLayout>
    <GridLayout columns="34, *" class="feature-row">
      <Label class="icon" text="&#xe88a;" fontSize="26" />
      <StackLayout col="1">
        <Label text="Acomodação inteira" fontWeight="600" />
        <Label
          text="Aproveite a acomodação inteira."
          class="muted"
          fontSize="13"
          marginTop="4"
        />
      </StackLayout>
    </GridLayout>
    <Label class="description" :text="stay.description" textWrap="true" />
    <Label class="section-heading" text="O que esse lugar oferece" marginBottom="20" />
    <GridLayout columns="*, *" rows="auto, auto" class="amenities">
      <Label text="Wi-Fi rápido" />
      <Label col="1" text="Cozinha equipada" />
      <Label row="1" text="Estacionamento" marginTop="18" />
      <Label row="1" col="1" text="Vista para a região" marginTop="18" />
    </GridLayout>
  </StackLayout>
</template>

<style scoped>
.host-row {
  padding: 24 0;
  border-bottom-width: 1;
  border-bottom-color: #ebebeb;
  margin-bottom: 22;
}
.host-avatar {
  width: 48;
  height: 48;
  border-radius: 24;
  background-color: #eaded2;
  color: #56483b;
  font-size: 15;
  font-weight: 600;
  text-align: center;
  vertical-align: middle;
  padding-top: 15;
}
.feature-row {
  padding: 0 0 22;
}
.description {
  font-size: 16;
  line-height: 6;
  padding-top: 24;
  padding-bottom: 28;
  border-top-width: 1;
  border-top-color: #ebebeb;
}
.amenities {
  padding-bottom: 22;
  font-size: 14;
}
</style>
