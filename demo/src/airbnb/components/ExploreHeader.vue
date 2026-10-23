<script setup lang="ts">
import { categories, type Category } from '../data'

defineProps<{ destination: string; category: Category }>()
const emit = defineEmits<{ search: []; 'update:category': [category: Category] }>()
</script>

<template>
  <StackLayout class="discovery-header" iosOverflowSafeArea="false">
    <GridLayout
      id="search-button"
      class="discovery-search"
      iosOverflowSafeArea="false"
      @tap="emit('search')"
      accessible="true"
      accessibilityRole="button"
      accessibilityLabel="Buscar acomodações"
    >
      <StackLayout
        orientation="horizontal"
        horizontalAlignment="center"
        verticalAlignment="middle"
      >
        <Label
          class="icon"
          text="&#xe8b6;"
          fontSize="20"
          marginRight="8"
          verticalAlignment="middle"
        />
        <Label
          class="discovery-search-title"
          :text="destination || 'Comece sua busca'"
          verticalAlignment="middle"
        />
      </StackLayout>
    </GridLayout>
    <ScrollView orientation="horizontal" scrollBarIndicatorVisible="false" height="60">
      <StackLayout orientation="horizontal" class="product-tabs">
        <GridLayout
          v-for="item in categories"
          :key="item.id"
          columns="auto, auto"
          class="product-pill"
          :class="{ 'product-pill-selected': category === item.id }"
          @tap="emit('update:category', item.id)"
          accessible="true"
          accessibilityRole="button"
          :accessibilityLabel="item.title"
          :accessibilityState="category === item.id ? 'selected' : undefined"
        >
          <Label
            :text="item.icon"
            fontSize="18"
            marginRight="6"
            verticalAlignment="middle"
          />
          <Label col="1" :text="item.title" fontSize="12" verticalAlignment="middle" />
        </GridLayout>
      </StackLayout>
    </ScrollView>
  </StackLayout>
</template>

<style scoped>
.discovery-header {
  background: linear-gradient(to bottom, #e9e8e6, #ffffff);
  padding-top: 0;
}
.discovery-search {
  height: 58;
  margin: 0 20 10;
  border-radius: 30;
  background-color: #ffffff;
  box-shadow: 0 10 22 rgba(0, 0, 0, 0.035);
}
.discovery-search-title {
  font-size: 13;
  font-weight: 600;
}
.product-tabs {
  padding: 6 20 12;
}
.product-pill {
  height: 40;
  padding: 0 10;
  margin-right: 8;
  border-radius: 22;
  border-width: 1;
  border-color: #ffffff;
  background: linear-gradient(to bottom, #f4f4f4, #ffffff);
  box-shadow: 0 2 3 rgba(0, 0, 0, 0.15);
}
.product-pill-selected {
  background: linear-gradient(to bottom, #d0cfcd, #e6e5e3);
  border-color: #e5e4e2;
  box-shadow: 0 1 2 rgba(0, 0, 0, 0.08);
}
</style>
