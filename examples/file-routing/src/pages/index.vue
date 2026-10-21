<script setup lang="ts">
import { useRouter } from 'vue-router-ns'
import { useDraft, signedIn } from '../state'

const router = useRouter()
const draft = useDraft('Weekend favorites')
</script>
<template>
  <ScrollView
    ><StackLayout class="content">
      <Label text="THE NATIVE COLLECTION" class="eyebrow" />
      <Label
        id="page-heading"
        text="Made for everyday."
        class="heading"
        accessible="true"
      />
      <Label
        text="A small collection. Pages that feel right at home."
        class="subtitle"
        textWrap="true"
      />
      <StackLayout class="card">
        <Label text="01 / FIELD NOTES" class="eyebrow" />
        <Label text="The everyday notebook" class="card-title" />
        <Label
          text="Soft cover. Plenty of room for your next idea."
          class="subtitle"
          textWrap="true"
        />
        <Button
          text="Explore notebook"
          class="primary"
          @tap="router.push({ name: 'products-id', params: { id: 7 } })"
        />
      </StackLayout>
      <Label text="YOUR COLLECTION NAME" class="eyebrow" />
      <TextField v-model="draft" hint="Give it a name" />
      <Button
        :text="signedIn ? 'Your account' : 'Open your account'"
        @tap="router.push('/account')"
      />
      <Button text="About the example" @tap="router.push('/about')" /> </StackLayout
  ></ScrollView>
</template>
