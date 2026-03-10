<script setup lang="ts">
import RavebergLogo from '../branding/RavebergLogo.vue'
</script>

<template>
  <div class="display-overlay">
    <RavebergLogo mode="compact" class="overlay-logo" muted />
  </div>
</template>

<style scoped>
.display-overlay {
  position: fixed;
  left: 1.25rem;
  bottom: 1.25rem;
  display: inline-flex;
  width: auto;
  max-width: max-content;
  align-items: center;
  justify-content: center;
  padding: 0.76rem 1.04rem;
  border-radius: 14px;
  background: rgba(4, 7, 10, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(6px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  pointer-events: none;
  z-index: 10;
}

:deep(.overlay-logo.brandmark[data-mode='compact']) {
  width: 11rem;
}

:deep(.overlay-logo .brandmark-image) {
  filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.18));
}
</style>
