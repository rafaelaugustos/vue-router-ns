<script setup lang="ts">
import { saved, selectedTab } from './store'
</script>

<template>
  <RouterTabs
    v-model:selected="selectedTab"
    :rail="600"
    tabBackgroundColor="#ffffff"
    tabTextColor="#717171"
    selectedTabTextColor="#ff385c"
    labelVisibility="labeled"
  >
    <RouterTab
      name="explore"
      title="Explorar"
      icon="magnifyingglass"
      androidIcon="sys://ic_menu_search"
    >
      <RouterView name="explore" initial="/" backToRootOnReselect />
    </RouterTab>
    <RouterTab
      name="saved"
      title="Favoritos"
      icon="heart"
      androidIcon="sys://btn_star_big_off"
      :badge="saved.length || undefined"
    >
      <RouterView name="saved" initial="/saved" backToRootOnReselect />
    </RouterTab>
    <RouterTab
      name="trips"
      title="Viagens"
      icon="suitcase.rolling"
      androidIcon="sys://ic_menu_myplaces"
    >
      <RouterView name="trips" initial="/trips" backToRootOnReselect />
    </RouterTab>
    <RouterTab
      name="messages"
      title="Mensagens"
      icon="message"
      androidIcon="sys://ic_dialog_email"
    >
      <RouterView name="messages" initial="/messages" backToRootOnReselect />
    </RouterTab>
    <RouterTab
      name="profile"
      title="Perfil"
      icon="person.crop.circle"
      androidIcon="sys://ic_menu_manage"
    >
      <RouterView name="profile" initial="/profile" backToRootOnReselect />
    </RouterTab>
  </RouterTabs>
</template>
