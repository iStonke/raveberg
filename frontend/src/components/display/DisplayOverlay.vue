<script setup lang="ts">
import QrCodeMatrix from '../branding/QrCodeMatrix.vue'
import RavebergLogo from '../branding/RavebergLogo.vue'

defineProps<{
  mode: 'logo' | 'qr'
  guestUploadUrl?: string
  position?: 'fixed' | 'absolute'
}>()
</script>

<template>
  <div class="display-overlay" :class="position === 'absolute' ? 'display-overlay--absolute' : ''">
    <Transition name="overlay-content-switch" mode="out-in" appear>
      <div v-if="mode === 'logo'" key="logo" class="overlay-logo-shell">
        <RavebergLogo mode="compact" class="overlay-logo" muted />
      </div>
      <div v-else key="qr" class="overlay-qr-shell">
        <div class="overlay-qr-card">
          <div class="overlay-qr-frame">
            <QrCodeMatrix class="overlay-qr-code" :text="guestUploadUrl || ''" :quiet-zone="4" />
          </div>
          <span class="overlay-qr-caption">Upload</span>
        </div>
      </div>
    </Transition>
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
  pointer-events: none;
  z-index: 10;
}

.display-overlay--absolute {
  position: absolute;
}

.overlay-qr-shell {
  display: inline-flex;
  padding: 0.68rem;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.09);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.overlay-logo-shell {
  display: inline-flex;
  padding: 0.68rem 0.88rem;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.09);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.overlay-qr-card {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.42rem;
  width: 8.1rem;
}

.overlay-qr-frame {
  width: 100%;
  padding: 0.48rem;
  border-radius: 12px;
  background: #ffffff;
}

.overlay-qr-code {
  display: block;
  width: 100%;
  height: auto;
  color: #111;
  opacity: 1;
  filter: none;
}

.overlay-qr-caption {
  font-size: 0.84rem;
  line-height: 1;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
}

:deep(.overlay-logo.brandmark[data-mode='compact']) {
  width: 11rem;
}

:deep(.overlay-logo .brandmark-image) {
  filter: none;
}

.overlay-content-switch-enter-active,
.overlay-content-switch-leave-active {
  transition:
    opacity 280ms cubic-bezier(0.22, 0.61, 0.36, 1),
    transform 320ms cubic-bezier(0.22, 0.61, 0.36, 1),
    filter 320ms cubic-bezier(0.22, 0.61, 0.36, 1);
  will-change: opacity, transform, filter;
}

.overlay-content-switch-enter-from,
.overlay-content-switch-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.985);
  filter: blur(8px);
}

.overlay-content-switch-enter-to,
.overlay-content-switch-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}
</style>
