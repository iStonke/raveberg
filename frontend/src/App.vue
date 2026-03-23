<template>
  <v-app>
    <router-view />
  </v-app>
</template>

<style>
:root {
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-right: env(safe-area-inset-right, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-left: env(safe-area-inset-left, 0px);
  --app-page-background-color: #070d15;
  --app-page-background:
    radial-gradient(circle at 18% -4%, rgba(47, 166, 255, 0.08), transparent 24%),
    radial-gradient(circle at 82% 8%, rgba(52, 215, 188, 0.05), transparent 20%),
    radial-gradient(circle at 50% 100%, rgba(33, 89, 168, 0.04), transparent 26%),
    linear-gradient(180deg, #070d15 0%, #0a121b 52%, #0d1520 100%);
}

html,
body,
#app {
  margin: 0;
  padding: 0;
  width: 100%;
  min-height: 100%;
}

html {
  height: 100%;
  background: var(--app-page-background);
  background-color: var(--app-page-background-color);
  overflow-y: auto;
}

body {
  min-height: 100%;
  overflow-x: hidden;
  background: var(--app-page-background);
  background-color: var(--app-page-background-color);
}

.v-application,
.v-application__wrap {
  width: 100%;
  max-width: 100%;
  min-height: 100%;
  background: transparent;
}

.safe-area-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding-top: var(--safe-area-top);
  padding-right: var(--safe-area-right);
  padding-bottom: var(--safe-area-bottom);
  padding-left: var(--safe-area-left);
  box-sizing: border-box;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}
</style>
