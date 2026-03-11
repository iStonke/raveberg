<script setup lang="ts">
import QrCodeMatrix from '../branding/QrCodeMatrix.vue'
import RavebergLogo from '../branding/RavebergLogo.vue'

defineProps<{
  mode: 'logo' | 'qr'
  guestUploadUrl?: string
}>()
</script>

<template>
  <div class="display-overlay">
    <RavebergLogo v-if="mode === 'logo'" mode="compact" class="overlay-logo" muted />
    <div v-else class="overlay-qr-shell">
      <div class="overlay-qr-card">
        <div class="overlay-qr-frame">
          <QrCodeMatrix class="overlay-qr-code" :text="guestUploadUrl || ''" :quiet-zone="4" />
        </div>
        <span class="overlay-qr-caption">Upload</span>
      </div>
    </div>
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

.overlay-qr-shell {
  display: inline-flex;
}

.overlay-qr-card {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.42rem;
  width: 7.05rem;
  padding: 0.55rem;
  border-radius: 14px;
  background: rgba(20, 30, 40, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(6px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
}

.overlay-qr-frame {
  width: 100%;
  padding: 0.36rem;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.92);
}

.overlay-qr-code {
  display: block;
  width: 100%;
  height: auto;
  color: #111;
  opacity: 0.9;
  filter: contrast(0.9);
}

.overlay-qr-caption {
  font-size: 0.75rem;
  line-height: 1;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
}

:deep(.overlay-logo.brandmark[data-mode='compact']) {
  width: 11rem;
}

:deep(.overlay-logo .brandmark-image) {
  filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.18));
}
</style>
