<script setup lang="ts">
import { computed } from 'nativescript-vue'
import { useRouter } from 'vue-router-ns'
const props = defineProps<{ section: 'trips' | 'messages' | 'profile' }>()
const router = useRouter()
const content = computed(
  () =>
    ({
      trips: {
        title: 'Viagens',
        icon: '\ueb3f',
        headline: 'Nenhuma viagem reservada',
        body: 'As reservas aparecerão aqui. Por enquanto, você pode explorar e salvar acomodações.',
      },
      messages: {
        title: 'Mensagens',
        icon: '\ue0cb',
        headline: 'Nenhuma mensagem',
        body: 'As conversas com anfitriões aparecerão aqui quando essa função estiver disponível.',
      },
      profile: {
        title: 'Perfil',
        icon: '\ue853',
        headline: 'Seu perfil',
        body: 'Login e configurações de conta ainda não estão disponíveis neste demo.',
      },
    })[props.section],
)
</script>

<template>
  <Page actionBarHidden="true" class="airbnb-page">
    <StackLayout class="feed">
      <Label class="page-title" :text="content.title" />
      <StackLayout class="empty-state">
        <Label class="icon empty-icon" :text="content.icon" />
        <Label class="empty-title" :text="content.headline" textWrap="true" />
        <Label class="muted" :text="content.body" textWrap="true" />
        <Button
          class="primary"
          text="Explorar acomodações"
          @tap="router.backToRoot({ frame: 'explore' })"
        />
        <Label
          class="prototype-note"
          text="Protótipo com acomodações fictícias."
          textWrap="true"
        />
      </StackLayout>
    </StackLayout>
  </Page>
</template>
