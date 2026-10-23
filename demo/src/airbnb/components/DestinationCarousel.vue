<script setup lang="ts">
import type { Stay, StaySection } from '../data'
import StayCard from './StayCard.vue'

defineProps<{ section: StaySection; stays: Stay[]; cardWidth: number }>()
const emit = defineEmits<{ open: [id: string] }>()
</script>

<template>
  <StackLayout class="destination-section">
    <GridLayout columns="*, 30" class="destination-heading">
      <Label :text="section.title" class="destination-title" verticalAlignment="middle" />
      <Button
        col="1"
        class="icon destination-more"
        text="&#xe5c8;"
        :accessibilityLabel="`Ver todas: ${section.title}`"
        @tap="emit('open', section.id)"
      />
    </GridLayout>
    <ScrollView
      orientation="horizontal"
      scrollBarIndicatorVisible="false"
      :height="Math.round(cardWidth * 0.95) + 58"
    >
      <StackLayout orientation="horizontal" paddingLeft="24" paddingRight="12">
        <StayCard
          v-for="stay in stays"
          :key="stay.id"
          :stay="stay"
          compact
          :cardWidth="cardWidth"
        />
      </StackLayout>
    </ScrollView>
  </StackLayout>
</template>

<style scoped>
.destination-section {
  margin-bottom: 20;
}
.destination-heading {
  margin: 0 24 14;
  height: 30;
}
.destination-title {
  font-size: 16;
  font-weight: 700;
  letter-spacing: -0.025;
  margin-right: 8;
}
.destination-more {
  height: 29;
  width: 29;
  border-radius: 15;
  background-color: #f3f3f3;
  color: #222222;
  font-size: 20;
}
</style>
