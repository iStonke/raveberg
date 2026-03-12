<template>
  <v-app>
    <router-view />
  </v-app>
</template>

<style>
html,
body,
#app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  min-height: 100%;
}

html {
  overflow-y: auto;
}

body {
  overflow-x: hidden;
}

.v-application,
.v-application__wrap {
  width: 100%;
  height: 100%;
  max-width: 100%;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}
</style>
