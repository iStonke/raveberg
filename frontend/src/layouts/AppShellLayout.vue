<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isGuestRoute = computed(() => route.path.startsWith('/guest'))

const title = computed(() => {
  if (route.path.startsWith('/admin')) {
    return 'RAVEBERG Admin'
  }

  return 'RAVEBERG Guest'
})
</script>

<template>
  <v-layout class="min-height-screen">
    <v-app-bar v-if="!isGuestRoute" color="surface">
      <v-app-bar-title>{{ title }}</v-app-bar-title>
      <template #append>
        <v-btn to="/guest/upload" variant="text">Guest</v-btn>
        <v-btn to="/admin/login" variant="text">Admin</v-btn>
        <v-btn to="/display" variant="text">Display</v-btn>
      </template>
    </v-app-bar>

    <v-main :class="{ 'guest-main': isGuestRoute }">
      <router-view v-if="isGuestRoute" />
      <v-container v-else class="py-10">
        <router-view />
      </v-container>
    </v-main>
  </v-layout>
</template>

<style scoped>
.min-height-screen {
  min-height: 100vh;
}

.guest-main {
  min-height: 100vh;
}
</style>
