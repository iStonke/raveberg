<script setup lang="ts">
import AuroraPolaroidEngine from './AuroraPolaroidEngine.vue'
import RavebergLogo from '../branding/RavebergLogo.vue'

withDefaults(
  defineProps<{
    reactionToken?: number
  }>(),
  {
    reactionToken: 0,
  },
)
</script>

<template>
  <div class="standby-renderer">
    <div class="standby-background" aria-hidden="true">
      <AuroraPolaroidEngine
        class="standby-engine"
        color-mode="cool"
        quality="auto"
        :intensity="0.82"
        :particle-density="0.7"
        :pulse-token="reactionToken"
      />
      <div class="standby-background-vignette" />
    </div>

    <div class="standby-stage">
      <div class="standby-panel">
        <RavebergLogo class="standby-logo" muted />
        <div class="standby-copy">
          <h1 class="standby-headline">Unter dem Berg beginnt die Nacht</h1>
          <p class="standby-subheadline">Willkommen im Auberg-Keller</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.standby-renderer {
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

.standby-background {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.standby-engine,
.standby-background-vignette {
  position: absolute;
  inset: 0;
}

.standby-background-vignette {
  background:
    radial-gradient(circle at 50% 44%, rgba(255, 255, 255, 0.045), transparent 24%),
    radial-gradient(circle at 50% 52%, rgba(10, 26, 43, 0.08), transparent 40%),
    radial-gradient(circle at 50% 50%, transparent 46%, rgba(3, 8, 14, 0.16) 74%, rgba(2, 6, 11, 0.34) 100%),
    linear-gradient(180deg, rgba(1, 5, 10, 0.04), rgba(1, 4, 9, 0.14));
}

.standby-stage {
  position: relative;
  z-index: 1;
  width: min(100%, 38rem);
  display: grid;
  place-items: center;
}

.standby-panel {
  position: relative;
  width: 100%;
  display: grid;
  justify-items: center;
  gap: clamp(1.1rem, 2.3vw, 1.6rem);
  padding: clamp(1.8rem, 3vw, 2.5rem);
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
  transform-origin: center center;
  will-change: transform, box-shadow, border-color;
  animation: standbyHeartbeat 3.2s cubic-bezier(0.22, 0.61, 0.36, 1) infinite;
}

.standby-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(circle at 18% 14%, rgba(255, 255, 255, 0.075), transparent 22%),
    radial-gradient(circle at 82% 20%, rgba(137, 210, 255, 0.045), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.038), rgba(255, 255, 255, 0));
  pointer-events: none;
  animation:
    standbyHeartbeatGlow 3.2s ease-in-out infinite,
    standbyPanelFlicker 3.2s linear infinite;
}

.standby-panel::after {
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

.standby-logo {
  width: min(100%, 17rem);
  filter: drop-shadow(0 24px 44px rgba(31, 94, 179, 0.16));
}

.standby-copy {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  gap: 0.32rem;
  text-align: center;
}

.standby-headline {
  margin: 0;
  font-size: clamp(1.18rem, 2.9vw, 1.9rem);
  line-height: 1.04;
  font-weight: 620;
  letter-spacing: -0.022em;
  color: #bfd7ff;
  text-shadow: 0 0 18px rgba(82, 178, 255, 0.1);
}

.standby-subheadline {
  margin: 0;
  max-width: 28rem;
  color: rgba(229, 237, 246, 0.74);
}

.standby-subheadline {
  font-size: clamp(0.98rem, 1.7vw, 1.14rem);
  line-height: 1.42;
}

@keyframes standbyHeartbeat {
  0%,
  44%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
    border-color: rgba(255, 255, 255, 0.11);
    box-shadow:
      0 26px 54px rgba(2, 8, 16, 0.24),
      0 10px 20px rgba(5, 18, 30, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      inset 0 0 0 1px rgba(189, 223, 255, 0.045),
      inset 0 -18px 30px rgba(5, 11, 19, 0.08);
  }

  8% {
    transform: translate3d(0, 0, 0) scale(0.968);
    border-color: rgba(132, 198, 247, 0.18);
    box-shadow:
      0 12px 24px rgba(2, 8, 16, 0.18),
      0 5px 10px rgba(7, 22, 36, 0.1),
      0 0 0 1px rgba(86, 176, 255, 0.06),
      inset 0 3px 0 rgba(255, 255, 255, 0.09),
      inset 0 0 0 1px rgba(189, 223, 255, 0.055),
      inset 0 -10px 16px rgba(5, 11, 19, 0.07);
  }

  12% {
    transform: translate3d(0, 0, 0) scale(1.078);
    border-color: rgba(165, 223, 255, 0.3);
    box-shadow:
      0 58px 116px rgba(2, 8, 16, 0.56),
      0 29px 58px rgba(7, 22, 36, 0.3),
      0 0 0 1px rgba(86, 176, 255, 0.22),
      0 0 54px rgba(70, 160, 255, 0.16),
      inset 0 1px 0 rgba(255, 255, 255, 0.12),
      inset 0 0 0 1px rgba(189, 223, 255, 0.12),
      inset 0 -38px 58px rgba(5, 11, 19, 0.18);
  }

  18% {
    transform: translate3d(0, 0, 0) scale(0.988);
  }

  24% {
    transform: translate3d(0, 0, 0) scale(0.978);
    border-color: rgba(136, 200, 247, 0.18);
    box-shadow:
      0 16px 32px rgba(2, 8, 16, 0.2),
      0 7px 14px rgba(7, 22, 36, 0.11),
      0 0 0 1px rgba(86, 176, 255, 0.07),
      inset 0 2px 0 rgba(255, 255, 255, 0.09),
      inset 0 0 0 1px rgba(189, 223, 255, 0.06),
      inset 0 -12px 18px rgba(5, 11, 19, 0.075);
  }

  28% {
    transform: translate3d(0, 0, 0) scale(1.046);
    border-color: rgba(148, 208, 255, 0.23);
    box-shadow:
      0 40px 82px rgba(2, 8, 16, 0.42),
      0 20px 40px rgba(7, 22, 36, 0.22),
      0 0 0 1px rgba(86, 176, 255, 0.15),
      0 0 28px rgba(70, 160, 255, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      inset 0 0 0 1px rgba(189, 223, 255, 0.09),
      inset 0 -28px 44px rgba(5, 11, 19, 0.14);
  }

  34% {
    transform: translate3d(0, 0, 0) scale(0.996);
  }
}

@keyframes standbyHeartbeatGlow {
  0%,
  44%,
  100% {
    opacity: 1;
  }

  12% {
    opacity: 1.48;
  }

  28% {
    opacity: 1.24;
  }

  34% {
    opacity: 1.08;
  }
}

@keyframes standbyPanelFlicker {
  0%,
  44%,
  100% {
    filter: brightness(1);
  }

  12% {
    filter: brightness(1.05);
  }

  28% {
    filter: brightness(1.025);
  }
}

@media (prefers-reduced-motion: reduce) {
  .standby-panel,
  .standby-panel::before {
    animation: none;
  }
}

@media (max-width: 960px) {
  .standby-stage {
    width: min(100%, 31rem);
  }

  .standby-panel {
    padding: 1.5rem;
  }

  .standby-logo {
    width: min(100%, 14rem);
  }

  .standby-headline {
    font-size: clamp(1.08rem, 4.4vw, 1.48rem);
  }

  .standby-subheadline {
    font-size: clamp(0.92rem, 3.5vw, 1.02rem);
  }
}
</style>
