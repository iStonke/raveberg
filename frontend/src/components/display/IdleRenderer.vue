<script setup lang="ts">
import AuroraPolaroidEngine from './AuroraPolaroidEngine.vue'
import RavebergLogo from '../branding/RavebergLogo.vue'
import QrCodeMatrix from '../branding/QrCodeMatrix.vue'

defineProps<{
  eventName: string
  eventTagline: string
  guestUploadUrl: string
  reactionToken?: number
}>()
</script>

<template>
  <div class="idle-renderer">
    <div class="idle-background" aria-hidden="true">
      <AuroraPolaroidEngine
        class="idle-engine"
        color-mode="cool"
        quality="auto"
        :intensity="0.82"
        :particle-density="0.7"
        :pulse-token="reactionToken ?? 0"
      />
      <div class="idle-background-vignette" />
    </div>

    <div class="idle-stage">
      <div class="idle-panel">
        <div class="idle-copy">
          <RavebergLogo class="idle-logo" muted />
          <h1 class="idle-headline">Selfie auf den Screen</h1>
          <p class="idle-subheadline">Foto machen und hochladen</p>
        </div>

        <div class="idle-qr-module">
          <QrCodeMatrix class="idle-qr-code" :text="guestUploadUrl" />
          <div class="idle-qr-label">QR-Code scannen</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.idle-renderer {
  position: relative;
  isolation: isolate;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  height: 100dvh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: clamp(1.4rem, 4vw, 3rem);
  overflow: hidden;
  background: linear-gradient(180deg, #07111c 0%, #07192b 48%, #040a12 100%);
}

.idle-background {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.idle-engine,
.idle-background-vignette {
  position: absolute;
  inset: 0;
}

.idle-background-vignette {
  background:
    radial-gradient(circle at 50% 44%, rgba(255, 255, 255, 0.045), transparent 24%),
    radial-gradient(circle at 50% 52%, rgba(10, 26, 43, 0.08), transparent 40%),
    radial-gradient(circle at 50% 50%, transparent 46%, rgba(3, 8, 14, 0.16) 74%, rgba(2, 6, 11, 0.34) 100%),
    linear-gradient(180deg, rgba(1, 5, 10, 0.04), rgba(1, 4, 9, 0.14));
}

.idle-stage {
  position: relative;
  z-index: 1;
  width: min(100%, 36rem);
  display: grid;
  place-items: center;
  transform-origin: center center;
  will-change: transform;
  animation: idleStageDrift 7.6s ease-in-out infinite;
}

.idle-panel {
  position: relative;
  width: 100%;
  display: grid;
  justify-items: center;
  align-items: start;
  gap: clamp(1rem, 2.3vw, 1.4rem);
  padding: clamp(1.45rem, 2.7vw, 2.15rem);
  border-radius: 32px;
  border: 1px solid rgba(255, 255, 255, 0.11);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.028)),
    rgba(14, 22, 34, 0.34);
  box-shadow:
    0 26px 54px rgba(2, 8, 16, 0.24),
    0 10px 20px rgba(5, 18, 30, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 0 0 1px rgba(189, 223, 255, 0.045),
    inset 0 -18px 30px rgba(5, 11, 19, 0.08);
  backdrop-filter: blur(34px) saturate(112%);
  -webkit-backdrop-filter: blur(34px) saturate(112%);
  overflow: hidden;
}

.idle-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(circle at 18% 14%, rgba(255, 255, 255, 0.075), transparent 22%),
    radial-gradient(circle at 82% 20%, rgba(137, 210, 255, 0.045), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.038), rgba(255, 255, 255, 0));
  pointer-events: none;
}

.idle-panel::after {
  content: '';
  position: absolute;
  inset: 1px;
  border-radius: calc(32px - 1px);
  background:
    radial-gradient(circle at top center, rgba(255, 255, 255, 0.04), transparent 42%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0));
  pointer-events: none;
  mix-blend-mode: screen;
}

.idle-copy {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 0.12rem;
  text-align: center;
}

.idle-logo {
  width: min(100%, 17rem);
  filter: drop-shadow(0 24px 44px rgba(31, 94, 179, 0.16));
}

.idle-headline {
  margin: 0.68rem 0 0;
  font-size: clamp(1.25rem, 3.1vw, 1.95rem);
  line-height: 1.06;
  font-weight: 620;
  letter-spacing: -0.018em;
  color: rgba(255, 255, 255, 0.94);
  text-shadow: 0 0 18px rgba(82, 178, 255, 0.1);
}

.idle-subheadline {
  margin: 0;
  font-size: clamp(0.96rem, 1.6vw, 1.08rem);
  line-height: 1.35;
  letter-spacing: 0.01em;
  color: rgba(229, 237, 246, 0.72);
}

.idle-qr-module {
  display: grid;
  justify-items: center;
  gap: 0.7rem;
  width: 100%;
  padding: 0;
}

.idle-qr-label {
  color: rgba(245, 249, 255, 0.88);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.idle-qr-code {
  width: clamp(13rem, 20vw, 17rem);
}

@keyframes idleStageDrift {
  0%,
  100% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }

  24% {
    transform: translate3d(0, -0.52rem, 0) rotate(-0.32deg) scale(1.008);
  }

  52% {
    transform: translate3d(0, 0.38rem, 0) rotate(0.28deg) scale(0.994);
  }

  78% {
    transform: translate3d(0, -0.26rem, 0) rotate(-0.22deg) scale(1.004);
  }
}

@media (prefers-reduced-motion: reduce) {
  .idle-stage {
    animation: none;
  }
}

@media (max-width: 960px) {
  .idle-stage {
    width: min(100%, 30rem);
  }

  .idle-panel {
    gap: 1.2rem;
  }

  .idle-logo {
    width: min(100%, 14rem);
  }

  .idle-headline {
    font-size: clamp(1.18rem, 4.8vw, 1.55rem);
  }

  .idle-subheadline {
    font-size: clamp(0.88rem, 3.4vw, 0.98rem);
  }

  .idle-qr-code {
    width: min(58vw, 14.5rem);
  }
}
</style>
