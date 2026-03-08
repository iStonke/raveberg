<template>
  <div class="idle-renderer">
    <div class="idle-dot" />
  </div>
</template>

<style scoped>
.idle-renderer {
  width: 100vw;
  height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.04), transparent 45%), #050608;
}

.idle-dot {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.32);
  box-shadow: 0 0 40px rgba(255, 255, 255, 0.18);
}
</style>
