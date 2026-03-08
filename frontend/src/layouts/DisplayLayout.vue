<template>
  <v-main class="display-layout">
    <router-view />
  </v-main>
</template>

<style scoped>
.display-layout {
  min-height: 100vh;
  background:
    radial-gradient(circle at top, rgba(103, 212, 255, 0.16), transparent 35%),
    linear-gradient(180deg, #05070a 0%, #0c1016 100%);
}
</style>
