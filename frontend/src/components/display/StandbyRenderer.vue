<script setup lang="ts">
import { computed } from 'vue'

import AuroraPolaroidEngine from './AuroraPolaroidEngine.vue'
import RavebergLogo from '../branding/RavebergLogo.vue'
import { useVirtualStageScale } from './useVirtualStageScale'

const props = withDefaults(
  defineProps<{
    reactionToken?: number
    headline?: string
    subheadline?: string
    hueShiftDegrees?: number
  }>(),
  {
    reactionToken: 0,
    headline: 'Unterm Berg beginnt die Nacht',
    subheadline: 'Willkommen im Auberg-Keller',
    hueShiftDegrees: 0,
  },
)

const backgroundStyle = computed(() => ({
  '--standby-hue-shift': `${props.hueShiftDegrees}deg`,
}))

const STAGE_SCALE_BOOST = 1.78

const { stageShellStyle } = useVirtualStageScale({ scaleBoost: STAGE_SCALE_BOOST })

const fogLayers = [
  {
    className: 'standby-fog standby-fog-a',
    style: {
      '--fog-width': '50rem',
      '--fog-height': '30rem',
      '--fog-top': '10%',
      '--fog-left': '-10%',
      '--fog-duration': '40s',
      '--fog-delay': '-10s',
      '--fog-drift-x': '3rem',
      '--fog-drift-y': '1.5rem',
      '--fog-opacity': '0.22',
    },
  },
  {
    className: 'standby-fog standby-fog-b',
    style: {
      '--fog-width': '40rem',
      '--fog-height': '24rem',
      '--fog-top': '54%',
      '--fog-left': '58%',
      '--fog-duration': '48s',
      '--fog-delay': '-22s',
      '--fog-drift-x': '-2.5rem',
      '--fog-drift-y': '-1.3rem',
      '--fog-opacity': '0.14',
    },
  },
  {
    className: 'standby-fog standby-fog-c',
    style: {
      '--fog-width': '34rem',
      '--fog-height': '20rem',
      '--fog-top': '24%',
      '--fog-left': '60%',
      '--fog-duration': '54s',
      '--fog-delay': '-30s',
      '--fog-drift-x': '1.6rem',
      '--fog-drift-y': '1rem',
      '--fog-opacity': '0.11',
    },
  },
  {
    className: 'standby-fog standby-fog-d',
    style: {
      '--fog-width': '32rem',
      '--fog-height': '18rem',
      '--fog-top': '70%',
      '--fog-left': '14%',
      '--fog-duration': '60s',
      '--fog-delay': '-16s',
      '--fog-drift-x': '1.1rem',
      '--fog-drift-y': '-0.9rem',
      '--fog-opacity': '0.08',
    },
  },
]

const particles = [
  { x: '6%', y: '17%', size: '0.22rem', blur: '0px', opacity: '0.26', delay: '-5s', duration: '24s', driftX: '1rem', driftY: '-1.2rem' },
  { x: '12%', y: '40%', size: '0.44rem', blur: '2px', opacity: '0.14', delay: '-17s', duration: '33s', driftX: '1.2rem', driftY: '0.9rem' },
  { x: '18%', y: '74%', size: '0.18rem', blur: '0px', opacity: '0.24', delay: '-10s', duration: '27s', driftX: '-0.7rem', driftY: '1rem' },
  { x: '24%', y: '11%', size: '0.16rem', blur: '0px', opacity: '0.32', delay: '-14s', duration: '21s', driftX: '-0.8rem', driftY: '1.1rem' },
  { x: '30%', y: '64%', size: '0.54rem', blur: '3px', opacity: '0.14', delay: '-4s', duration: '36s', driftX: '1.4rem', driftY: '-1rem' },
  { x: '38%', y: '24%', size: '0.28rem', blur: '0px', opacity: '0.22', delay: '-21s', duration: '28s', driftX: '-0.9rem', driftY: '1.4rem' },
  { x: '46%', y: '50%', size: '0.14rem', blur: '0px', opacity: '0.34', delay: '-8s', duration: '23s', driftX: '0.7rem', driftY: '-1rem' },
  { x: '53%', y: '15%', size: '0.62rem', blur: '3px', opacity: '0.15', delay: '-20s', duration: '38s', driftX: '1.8rem', driftY: '1rem' },
  { x: '61%', y: '36%', size: '0.24rem', blur: '0px', opacity: '0.24', delay: '-11s', duration: '26s', driftX: '-0.8rem', driftY: '1.2rem' },
  { x: '67%', y: '66%', size: '0.38rem', blur: '1px', opacity: '0.18', delay: '-18s', duration: '32s', driftX: '-1.1rem', driftY: '-0.9rem' },
  { x: '74%', y: '13%', size: '0.16rem', blur: '0px', opacity: '0.32', delay: '-12s', duration: '22s', driftX: '0.8rem', driftY: '1rem' },
  { x: '81%', y: '44%', size: '0.5rem', blur: '2px', opacity: '0.14', delay: '-24s', duration: '36s', driftX: '1.1rem', driftY: '-0.8rem' },
  { x: '87%', y: '20%', size: '0.24rem', blur: '0px', opacity: '0.24', delay: '-7s', duration: '25s', driftX: '-0.8rem', driftY: '1rem' },
  { x: '92%', y: '60%', size: '0.18rem', blur: '0px', opacity: '0.24', delay: '-16s', duration: '27s', driftX: '-0.7rem', driftY: '-1rem' },
  { x: '11%', y: '84%', size: '0.2rem', blur: '0px', opacity: '0.18', delay: '-15s', duration: '29s', driftX: '0.6rem', driftY: '-0.8rem' },
  { x: '22%', y: '56%', size: '0.34rem', blur: '1px', opacity: '0.13', delay: '-19s', duration: '34s', driftX: '-1rem', driftY: '0.8rem' },
  { x: '58%', y: '82%', size: '0.26rem', blur: '0px', opacity: '0.18', delay: '-9s', duration: '28s', driftX: '0.9rem', driftY: '-0.7rem' },
  { x: '86%', y: '78%', size: '0.42rem', blur: '2px', opacity: '0.13', delay: '-21s', duration: '33s', driftX: '-0.8rem', driftY: '1.2rem' },
]
</script>

<template>
  <div class="standby-renderer" :style="backgroundStyle">
    <div class="standby-background" aria-hidden="true">
      <div class="standby-base-layer">
        <AuroraPolaroidEngine
          class="standby-engine"
          color-mode="cool"
          quality="auto"
          :intensity="0.8"
          :particle-density="0.52"
          :pulse-token="reactionToken"
        />
        <div class="standby-color-field standby-color-a" />
        <div class="standby-color-field standby-color-b" />
        <div class="standby-color-field standby-color-c" />
        <div class="standby-ribbon standby-ribbon-a" />
        <div class="standby-ribbon standby-ribbon-b" />
      </div>

      <div class="standby-fog-field">
        <div
          v-for="(fog, index) in fogLayers"
          :key="`standby-fog-${index}`"
          :class="fog.className"
          :style="fog.style"
        />
      </div>

      <div class="standby-particle-field">
        <span
          v-for="(particle, index) in particles"
          :key="`standby-particle-${index}`"
          class="standby-particle"
          :style="{
            '--particle-x': particle.x,
            '--particle-y': particle.y,
            '--particle-size': particle.size,
            '--particle-blur': particle.blur,
            '--particle-opacity': particle.opacity,
            '--particle-delay': particle.delay,
            '--particle-duration': particle.duration,
            '--particle-drift-x': particle.driftX,
            '--particle-drift-y': particle.driftY,
          }"
        />
      </div>

      <div class="standby-luma-layer" />
      <div class="standby-noise" />
      <div class="standby-vignette" />
    </div>

    <div class="standby-stage-shell" :style="stageShellStyle">
      <div class="standby-stage">
        <div class="standby-content-glow" aria-hidden="true" />

        <div class="standby-content">
          <div class="standby-brand-wrap">
            <div class="standby-brand-group">
              <RavebergLogo class="standby-logo" muted />

              <div class="standby-copy">
                <h1 class="standby-headline">{{ headline }}</h1>
                <p class="standby-subheadline">{{ subheadline }}</p>
              </div>
            </div>
          </div>
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
  padding: clamp(1.6rem, 4vw, 3.4rem);
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 16%, rgba(50, 124, 194, 0.14), transparent 28%),
    linear-gradient(180deg, #040912 0%, #071220 44%, #02050a 100%);
}

.standby-background {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  filter: hue-rotate(var(--standby-hue-shift, 0deg)) saturate(1.04);
  transition: filter 320ms ease;
}

.standby-base-layer,
.standby-fog-field,
.standby-particle-field,
.standby-luma-layer,
.standby-noise,
.standby-vignette {
  position: absolute;
  inset: 0;
}

.standby-base-layer {
  z-index: 0;
}

.standby-engine,
.standby-color-field,
.standby-ribbon {
  position: absolute;
}

.standby-engine {
  inset: 0;
  transform: scale(1.08);
  transform-origin: center;
}

.standby-color-field,
.standby-ribbon {
  inset: -5%;
}

.standby-color-field {
  border-radius: 999px;
  mix-blend-mode: screen;
  filter: blur(48px);
  opacity: 0.72;
}

.standby-color-a {
  top: 4%;
  left: -12%;
  width: 44rem;
  height: 31rem;
  background: radial-gradient(circle, rgba(26, 118, 196, 0.3) 0%, rgba(26, 118, 196, 0.06) 48%, transparent 76%);
  animation: standbyBlobDriftA 28s ease-in-out infinite;
}

.standby-color-b {
  top: 50%;
  left: 58%;
  width: 35rem;
  height: 23rem;
  background: radial-gradient(circle, rgba(34, 181, 232, 0.2) 0%, rgba(34, 181, 232, 0.04) 46%, transparent 74%);
  animation: standbyBlobDriftB 34s ease-in-out infinite;
}

.standby-color-c {
  top: 16%;
  left: 44%;
  width: 30rem;
  height: 25rem;
  background: radial-gradient(circle, rgba(112, 88, 226, 0.16) 0%, rgba(112, 88, 226, 0.03) 44%, transparent 72%);
  animation: standbyBlobDriftC 38s ease-in-out infinite;
}

.standby-ribbon {
  opacity: 0.3;
  filter: blur(28px);
  mix-blend-mode: screen;
}

.standby-ribbon-a {
  background:
    radial-gradient(ellipse at 28% 48%, rgba(76, 176, 255, 0.16), transparent 48%),
    linear-gradient(110deg, transparent 16%, rgba(34, 108, 194, 0.18) 42%, transparent 72%);
  animation: standbyRibbonSweepA 26s ease-in-out infinite;
}

.standby-ribbon-b {
  background:
    radial-gradient(ellipse at 72% 42%, rgba(78, 214, 255, 0.12), transparent 44%),
    linear-gradient(140deg, transparent 20%, rgba(116, 96, 232, 0.12) 48%, transparent 76%);
  animation: standbyRibbonSweepB 32s ease-in-out infinite;
}

.standby-fog-field {
  z-index: 1;
}

.standby-fog {
  position: absolute;
  top: var(--fog-top);
  left: var(--fog-left);
  width: min(var(--fog-width), 74vw);
  height: min(var(--fog-height), 44vh);
  border-radius: 999px;
  opacity: var(--fog-opacity);
  filter: blur(44px);
  transform: translate3d(0, 0, 0);
  animation: standbyFogDrift var(--fog-duration) ease-in-out infinite;
  animation-delay: var(--fog-delay);
}

.standby-fog-a {
  background:
    radial-gradient(circle at 42% 46%, rgba(74, 142, 208, 0.44), rgba(74, 142, 208, 0.16) 38%, transparent 76%),
    radial-gradient(circle at 68% 52%, rgba(15, 70, 132, 0.2), transparent 62%);
}

.standby-fog-b {
  background:
    radial-gradient(circle at 50% 50%, rgba(84, 197, 244, 0.22), rgba(84, 197, 244, 0.08) 40%, transparent 76%),
    radial-gradient(circle at 36% 44%, rgba(20, 58, 110, 0.16), transparent 62%);
}

.standby-fog-c {
  background:
    radial-gradient(circle at 50% 50%, rgba(128, 216, 255, 0.16), rgba(128, 216, 255, 0.05) 38%, transparent 72%),
    radial-gradient(circle at 66% 42%, rgba(72, 84, 196, 0.12), transparent 60%);
}

.standby-fog-d {
  background:
    radial-gradient(circle at 46% 52%, rgba(28, 104, 168, 0.18), rgba(28, 104, 168, 0.06) 34%, transparent 70%),
    radial-gradient(circle at 64% 40%, rgba(120, 92, 216, 0.08), transparent 58%);
}

.standby-particle-field {
  z-index: 2;
}

.standby-particle {
  position: absolute;
  top: var(--particle-y);
  left: var(--particle-x);
  width: var(--particle-size);
  height: var(--particle-size);
  border-radius: 999px;
  opacity: var(--particle-opacity);
  filter: blur(var(--particle-blur));
  background:
    radial-gradient(circle, rgba(238, 248, 255, 0.98) 0%, rgba(148, 207, 255, 0.78) 44%, rgba(148, 207, 255, 0) 100%);
  transform: translate3d(0, 0, 0);
  animation:
    standbyParticleFloat var(--particle-duration) ease-in-out infinite,
    standbyParticlePulse calc(var(--particle-duration) * 0.65) ease-in-out infinite;
  animation-delay: var(--particle-delay), calc(var(--particle-delay) * 0.6);
}

.standby-luma-layer {
  z-index: 3;
  background:
    radial-gradient(circle at 50% 30%, rgba(112, 194, 255, 0.14), transparent 34%),
    radial-gradient(circle at 24% 68%, rgba(49, 108, 188, 0.09), transparent 36%),
    radial-gradient(circle at 76% 74%, rgba(17, 58, 116, 0.18), transparent 44%),
    linear-gradient(180deg, rgba(10, 20, 34, 0.12), rgba(2, 7, 14, 0.28));
  mix-blend-mode: screen;
  opacity: 0.36;
  animation: standbyBackgroundLuma 18s ease-in-out infinite;
}

.standby-noise {
  z-index: 4;
  opacity: 0.06;
  mix-blend-mode: soft-light;
  background:
    repeating-linear-gradient(
      0deg,
      rgba(255, 255, 255, 0.06) 0,
      rgba(255, 255, 255, 0.06) 1px,
      transparent 1px,
      transparent 3px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.04) 0,
      rgba(255, 255, 255, 0.04) 1px,
      transparent 1px,
      transparent 4px
    );
  transform: scale(1.08);
}

.standby-vignette {
  z-index: 5;
  background:
    radial-gradient(circle at 50% 42%, rgba(226, 244, 255, 0.05), transparent 22%),
    radial-gradient(circle at 50% 52%, rgba(14, 36, 62, 0.08), transparent 38%),
    radial-gradient(circle at 50% 50%, transparent 44%, rgba(2, 8, 14, 0.16) 76%, rgba(1, 4, 8, 0.52) 100%),
    linear-gradient(180deg, rgba(2, 6, 11, 0.05), rgba(2, 6, 11, 0.24));
}

.standby-stage-shell {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 1;
  width: 1920px;
  height: 1080px;
  transform: translate(-50%, -50%) scale(var(--stage-scale, 1));
  transform-origin: center;
  pointer-events: none;
}

.standby-stage {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  transform: translate3d(0, -1.4rem, 0);
  animation: standbyContentFloat 13s ease-in-out infinite;
}

.standby-content-glow {
  position: absolute;
  inset: 10% 18% 24%;
  border-radius: 999px;
  background:
    radial-gradient(circle, rgba(92, 190, 255, 0.12) 0%, rgba(92, 190, 255, 0.04) 44%, rgba(92, 190, 255, 0) 76%);
  filter: blur(40px);
  opacity: 0.62;
  animation: standbyContentGlow 11s ease-in-out infinite;
}

.standby-content {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  gap: 1.3rem;
  width: 100%;
  text-align: center;
}

.standby-brand-wrap {
  width: 100%;
  display: grid;
  place-items: center;
  perspective: 1180px;
  perspective-origin: center center;
}

.standby-brand-group {
  width: 100%;
  display: grid;
  justify-items: center;
  transform-origin: center center;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  will-change: transform;
  animation: standbyBrandPerspective 18s cubic-bezier(0.42, 0, 0.18, 1) infinite;
}

.standby-logo {
  width: min(100%, 19.4rem);
  filter:
    drop-shadow(0 10px 22px rgba(8, 16, 28, 0.2))
    drop-shadow(0 0 12px rgba(104, 193, 255, 0.06));
  backface-visibility: hidden;
  transform: translateZ(0);
  animation: standbyLogoGlow 10.5s ease-in-out infinite;
}

.standby-copy {
  display: grid;
  justify-items: center;
  gap: 0.28rem;
}

.standby-headline {
  margin: 1.1rem 0 0;
  font-size: clamp(1.16rem, 2.84vw, 1.82rem);
  line-height: 1.08;
  font-weight: 560;
  letter-spacing: -0.018em;
  color: rgba(255, 255, 255, 0.94);
  text-shadow: 0 0 10px rgba(76, 170, 255, 0.04);
}

.standby-subheadline {
  margin: 0;
  font-size: clamp(0.76rem, 1.08vw, 0.9rem);
  line-height: 1.6;
  font-weight: 520;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: rgba(221, 234, 247, 0.58);
}

@keyframes standbyBlobDriftA {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  50% {
    transform: translate3d(2.8rem, -1.4rem, 0) scale(1.08);
  }
}

@keyframes standbyBlobDriftB {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  50% {
    transform: translate3d(-2rem, 1.2rem, 0) scale(1.06);
  }
}

@keyframes standbyBlobDriftC {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  50% {
    transform: translate3d(1.6rem, 1rem, 0) scale(1.04);
  }
}

@keyframes standbyRibbonSweepA {
  0%,
  100% {
    transform: translate3d(-1.5rem, 0, 0) rotate(-4deg) scale(1);
    opacity: 0.24;
  }

  50% {
    transform: translate3d(1.8rem, -0.8rem, 0) rotate(2deg) scale(1.03);
    opacity: 0.34;
  }
}

@keyframes standbyRibbonSweepB {
  0%,
  100% {
    transform: translate3d(1.2rem, 0, 0) rotate(3deg) scale(1);
    opacity: 0.18;
  }

  50% {
    transform: translate3d(-1.6rem, 0.9rem, 0) rotate(-2deg) scale(1.04);
    opacity: 0.28;
  }
}

@keyframes standbyFogDrift {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  50% {
    transform: translate3d(var(--fog-drift-x), var(--fog-drift-y), 0) scale(1.05);
  }
}

@keyframes standbyParticleFloat {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }

  50% {
    transform: translate3d(var(--particle-drift-x), var(--particle-drift-y), 0);
  }
}

@keyframes standbyParticlePulse {
  0%,
  100% {
    opacity: var(--particle-opacity);
  }

  50% {
    opacity: calc(var(--particle-opacity) + 0.1);
  }
}

@keyframes standbyBackgroundLuma {
  0%,
  100% {
    opacity: 0.18;
    transform: translate3d(0, 0, 0) scale(1);
    filter: brightness(0.8);
  }

  30% {
    opacity: 0.48;
    transform: translate3d(0.6rem, -0.42rem, 0) scale(1.035);
    filter: brightness(1.12);
  }

  60% {
    opacity: 0.1;
    transform: translate3d(-0.42rem, 0.5rem, 0) scale(0.97);
    filter: brightness(0.68);
  }

  80% {
    opacity: 0.4;
    transform: translate3d(0.3rem, 0.2rem, 0) scale(1.02);
    filter: brightness(1.06);
  }
}

@keyframes standbyContentFloat {
  0%,
  100% {
    transform: translate3d(0, -1.4rem, 0);
  }

  50% {
    transform: translate3d(0, -1.9rem, 0);
  }
}

@keyframes standbyContentGlow {
  0%,
  100% {
    opacity: 0.48;
    transform: scale(1);
  }

  50% {
    opacity: 0.68;
    transform: scale(1.03);
  }
}

@keyframes standbyBrandPerspective {
  0%,
  100% {
    transform: translate3d(0, 0.55rem, 0) translateZ(0.8rem) rotateX(8deg) rotateY(-11deg) scale(1.014);
  }

  25% {
    transform: translate3d(1.15rem, -0.62rem, 0) translateZ(4.2rem) rotateX(13deg) rotateY(6deg) scale(1.052);
  }

  50% {
    transform: translate3d(0, -1.55rem, 0) translateZ(6.4rem) rotateX(-10deg) rotateY(11deg) scale(1.082);
  }

  75% {
    transform: translate3d(-1.24rem, -0.74rem, 0) translateZ(3.4rem) rotateX(-13deg) rotateY(-6deg) scale(1.048);
  }
}

@keyframes standbyLogoGlow {
  0%,
  100% {
    opacity: 0.92;
    filter:
      drop-shadow(0 10px 22px rgba(8, 16, 28, 0.2))
      drop-shadow(0 0 12px rgba(104, 193, 255, 0.06));
  }

  50% {
    opacity: 1;
    filter:
      drop-shadow(0 10px 22px rgba(8, 16, 28, 0.18))
      drop-shadow(0 0 18px rgba(128, 206, 255, 0.1));
  }
}

@media (prefers-reduced-motion: reduce) {
  .standby-color-field,
  .standby-ribbon,
  .standby-fog,
  .standby-particle,
  .standby-luma-layer,
  .standby-stage,
  .standby-content-glow,
  .standby-brand-group,
  .standby-logo {
    animation: none;
  }
}

@media (max-width: 960px) {
  .standby-stage {
    transform: translate3d(0, -0.7rem, 0);
  }
}
</style>
