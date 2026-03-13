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

const fogLayers = [
  {
    className: 'idle-fog idle-fog-a',
    style: {
      '--fog-width': '48rem',
      '--fog-height': '28rem',
      '--fog-top': '8%',
      '--fog-left': '-8%',
      '--fog-duration': '38s',
      '--fog-delay': '-9s',
      '--fog-drift-x': '3rem',
      '--fog-drift-y': '1.4rem',
      '--fog-opacity': '0.2',
    },
  },
  {
    className: 'idle-fog idle-fog-b',
    style: {
      '--fog-width': '42rem',
      '--fog-height': '24rem',
      '--fog-top': '56%',
      '--fog-left': '56%',
      '--fog-duration': '46s',
      '--fog-delay': '-21s',
      '--fog-drift-x': '-2.4rem',
      '--fog-drift-y': '-1.3rem',
      '--fog-opacity': '0.14',
    },
  },
  {
    className: 'idle-fog idle-fog-c',
    style: {
      '--fog-width': '36rem',
      '--fog-height': '20rem',
      '--fog-top': '28%',
      '--fog-left': '62%',
      '--fog-duration': '52s',
      '--fog-delay': '-28s',
      '--fog-drift-x': '1.8rem',
      '--fog-drift-y': '1.1rem',
      '--fog-opacity': '0.11',
    },
  },
  {
    className: 'idle-fog idle-fog-d',
    style: {
      '--fog-width': '34rem',
      '--fog-height': '18rem',
      '--fog-top': '68%',
      '--fog-left': '12%',
      '--fog-duration': '58s',
      '--fog-delay': '-15s',
      '--fog-drift-x': '1.3rem',
      '--fog-drift-y': '-1rem',
      '--fog-opacity': '0.08',
    },
  },
]

const particles = [
  { x: '7%', y: '18%', size: '0.22rem', blur: '0px', opacity: '0.26', delay: '-6s', duration: '24s', driftX: '1rem', driftY: '-1.2rem' },
  { x: '13%', y: '36%', size: '0.42rem', blur: '2px', opacity: '0.14', delay: '-17s', duration: '32s', driftX: '1.2rem', driftY: '0.9rem' },
  { x: '18%', y: '72%', size: '0.18rem', blur: '0px', opacity: '0.24', delay: '-10s', duration: '27s', driftX: '-0.7rem', driftY: '1rem' },
  { x: '26%', y: '12%', size: '0.16rem', blur: '0px', opacity: '0.32', delay: '-14s', duration: '21s', driftX: '-0.8rem', driftY: '1.1rem' },
  { x: '32%', y: '62%', size: '0.52rem', blur: '3px', opacity: '0.14', delay: '-5s', duration: '35s', driftX: '1.5rem', driftY: '-1rem' },
  { x: '38%', y: '26%', size: '0.28rem', blur: '0px', opacity: '0.24', delay: '-22s', duration: '28s', driftX: '-0.9rem', driftY: '1.4rem' },
  { x: '44%', y: '48%', size: '0.14rem', blur: '0px', opacity: '0.34', delay: '-8s', duration: '23s', driftX: '0.7rem', driftY: '-1rem' },
  { x: '52%', y: '16%', size: '0.62rem', blur: '3px', opacity: '0.16', delay: '-20s', duration: '38s', driftX: '1.8rem', driftY: '0.9rem' },
  { x: '58%', y: '38%', size: '0.24rem', blur: '0px', opacity: '0.24', delay: '-11s', duration: '26s', driftX: '-0.8rem', driftY: '1.2rem' },
  { x: '64%', y: '66%', size: '0.36rem', blur: '1px', opacity: '0.18', delay: '-18s', duration: '31s', driftX: '-1.1rem', driftY: '-0.9rem' },
  { x: '71%', y: '14%', size: '0.16rem', blur: '0px', opacity: '0.32', delay: '-12s', duration: '22s', driftX: '0.8rem', driftY: '1rem' },
  { x: '78%', y: '46%', size: '0.48rem', blur: '2px', opacity: '0.14', delay: '-24s', duration: '36s', driftX: '1.2rem', driftY: '-0.8rem' },
  { x: '84%', y: '22%', size: '0.24rem', blur: '0px', opacity: '0.24', delay: '-7s', duration: '25s', driftX: '-0.8rem', driftY: '1rem' },
  { x: '91%', y: '62%', size: '0.18rem', blur: '0px', opacity: '0.26', delay: '-16s', duration: '27s', driftX: '-0.7rem', driftY: '-1rem' },
  { x: '11%', y: '84%', size: '0.2rem', blur: '0px', opacity: '0.18', delay: '-15s', duration: '29s', driftX: '0.6rem', driftY: '-0.8rem' },
  { x: '23%', y: '54%', size: '0.34rem', blur: '1px', opacity: '0.13', delay: '-19s', duration: '34s', driftX: '-1rem', driftY: '0.8rem' },
  { x: '57%', y: '82%', size: '0.26rem', blur: '0px', opacity: '0.18', delay: '-9s', duration: '28s', driftX: '0.9rem', driftY: '-0.7rem' },
  { x: '86%', y: '78%', size: '0.4rem', blur: '2px', opacity: '0.13', delay: '-21s', duration: '33s', driftX: '-0.8rem', driftY: '1.2rem' },
]
</script>

<template>
  <div class="idle-renderer">
    <div class="idle-background" aria-hidden="true">
      <div class="idle-base-layer">
        <AuroraPolaroidEngine
          class="idle-engine"
          color-mode="cool"
          quality="auto"
          :intensity="0.82"
          :particle-density="0.58"
          :pulse-token="reactionToken ?? 0"
        />
        <div class="idle-color-field idle-color-a" />
        <div class="idle-color-field idle-color-b" />
        <div class="idle-color-field idle-color-c" />
        <div class="idle-ribbon idle-ribbon-a" />
        <div class="idle-ribbon idle-ribbon-b" />
      </div>

      <div class="idle-fog-field">
        <div
          v-for="(fog, index) in fogLayers"
          :key="`idle-fog-${index}`"
          :class="fog.className"
          :style="fog.style"
        />
      </div>

      <div class="idle-particle-field">
        <span
          v-for="(particle, index) in particles"
          :key="`idle-particle-${index}`"
          class="idle-particle"
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

      <div class="idle-luma-layer" />
      <div class="idle-noise" />
      <div class="idle-vignette" />
    </div>

    <div class="idle-stage">
      <div class="idle-content-glow" aria-hidden="true" />

      <div class="idle-content">
        <div class="idle-brand-wrap">
          <div class="idle-brand-group">
            <div class="idle-copy">
              <RavebergLogo class="idle-logo" muted />
              <h1 class="idle-headline">Selfie auf den Screen</h1>
              <p class="idle-subheadline">Foto machen und hochladen</p>
            </div>

            <div class="idle-qr-module">
              <div class="idle-qr-haze" aria-hidden="true" />
              <QrCodeMatrix class="idle-qr-code" :text="guestUploadUrl" :quiet-zone="5" />
              <div class="idle-qr-label">QR-Code scannen</div>
            </div>
          </div>
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
  padding: clamp(1.6rem, 4vw, 3.4rem);
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 16%, rgba(50, 124, 194, 0.14), transparent 28%),
    linear-gradient(180deg, #040912 0%, #071220 44%, #02050a 100%);
}

.idle-background {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.idle-base-layer,
.idle-fog-field,
.idle-particle-field,
.idle-luma-layer,
.idle-noise,
.idle-vignette {
  position: absolute;
  inset: 0;
}

.idle-base-layer {
  z-index: 0;
}

.idle-engine,
.idle-color-field,
.idle-ribbon {
  position: absolute;
}

.idle-engine {
  inset: 0;
  transform: scale(1.08);
  transform-origin: center;
}

.idle-color-field,
.idle-ribbon {
  inset: -5%;
}

.idle-color-field {
  border-radius: 999px;
  mix-blend-mode: screen;
  filter: blur(48px);
  opacity: 0.72;
}

.idle-color-a {
  top: 6%;
  left: -10%;
  width: 42rem;
  height: 30rem;
  background: radial-gradient(circle, rgba(24, 118, 196, 0.28) 0%, rgba(24, 118, 196, 0.06) 48%, transparent 76%);
  animation: idleBlobDriftA 28s ease-in-out infinite;
}

.idle-color-b {
  top: 48%;
  left: 58%;
  width: 34rem;
  height: 22rem;
  background: radial-gradient(circle, rgba(32, 179, 230, 0.2) 0%, rgba(32, 179, 230, 0.04) 46%, transparent 74%);
  animation: idleBlobDriftB 34s ease-in-out infinite;
}

.idle-color-c {
  top: 18%;
  left: 46%;
  width: 28rem;
  height: 24rem;
  background: radial-gradient(circle, rgba(112, 88, 226, 0.16) 0%, rgba(112, 88, 226, 0.03) 44%, transparent 72%);
  animation: idleBlobDriftC 38s ease-in-out infinite;
}

.idle-ribbon {
  opacity: 0.3;
  filter: blur(28px);
  mix-blend-mode: screen;
}

.idle-ribbon-a {
  background:
    radial-gradient(ellipse at 30% 50%, rgba(76, 176, 255, 0.16), transparent 48%),
    linear-gradient(110deg, transparent 16%, rgba(34, 108, 194, 0.18) 42%, transparent 72%);
  animation: idleRibbonSweepA 26s ease-in-out infinite;
}

.idle-ribbon-b {
  background:
    radial-gradient(ellipse at 72% 42%, rgba(78, 214, 255, 0.12), transparent 44%),
    linear-gradient(140deg, transparent 20%, rgba(116, 96, 232, 0.12) 48%, transparent 76%);
  animation: idleRibbonSweepB 32s ease-in-out infinite;
}

.idle-fog-field {
  z-index: 1;
}

.idle-fog {
  position: absolute;
  top: var(--fog-top);
  left: var(--fog-left);
  width: min(var(--fog-width), 74vw);
  height: min(var(--fog-height), 44vh);
  border-radius: 999px;
  opacity: var(--fog-opacity);
  filter: blur(44px);
  transform: translate3d(0, 0, 0);
  animation: idleFogDrift var(--fog-duration) ease-in-out infinite;
  animation-delay: var(--fog-delay);
}

.idle-fog-a {
  background:
    radial-gradient(circle at 42% 46%, rgba(74, 142, 208, 0.42), rgba(74, 142, 208, 0.16) 38%, transparent 76%),
    radial-gradient(circle at 68% 52%, rgba(15, 70, 132, 0.2), transparent 62%);
}

.idle-fog-b {
  background:
    radial-gradient(circle at 50% 50%, rgba(84, 197, 244, 0.22), rgba(84, 197, 244, 0.08) 40%, transparent 76%),
    radial-gradient(circle at 36% 44%, rgba(20, 58, 110, 0.16), transparent 62%);
}

.idle-fog-c {
  background:
    radial-gradient(circle at 50% 50%, rgba(128, 216, 255, 0.16), rgba(128, 216, 255, 0.05) 38%, transparent 72%),
    radial-gradient(circle at 66% 42%, rgba(72, 84, 196, 0.12), transparent 60%);
}

.idle-fog-d {
  background:
    radial-gradient(circle at 46% 52%, rgba(28, 104, 168, 0.18), rgba(28, 104, 168, 0.06) 34%, transparent 70%),
    radial-gradient(circle at 64% 40%, rgba(120, 92, 216, 0.08), transparent 58%);
}

.idle-particle-field {
  z-index: 2;
}

.idle-particle {
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
    idleParticleFloat var(--particle-duration) ease-in-out infinite,
    idleParticlePulse calc(var(--particle-duration) * 0.65) ease-in-out infinite;
  animation-delay: var(--particle-delay), calc(var(--particle-delay) * 0.6);
}

.idle-luma-layer {
  z-index: 3;
  background:
    radial-gradient(circle at 50% 30%, rgba(112, 194, 255, 0.14), transparent 34%),
    radial-gradient(circle at 24% 68%, rgba(49, 108, 188, 0.09), transparent 36%),
    radial-gradient(circle at 76% 74%, rgba(17, 58, 116, 0.18), transparent 44%),
    linear-gradient(180deg, rgba(10, 20, 34, 0.12), rgba(2, 7, 14, 0.28));
  mix-blend-mode: screen;
  opacity: 0.36;
  animation: idleBackgroundLuma 18s ease-in-out infinite;
}

.idle-noise {
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

.idle-vignette {
  z-index: 5;
  background:
    radial-gradient(circle at 50% 42%, rgba(226, 244, 255, 0.05), transparent 22%),
    radial-gradient(circle at 50% 52%, rgba(14, 36, 62, 0.08), transparent 38%),
    radial-gradient(circle at 50% 50%, transparent 44%, rgba(2, 8, 14, 0.16) 76%, rgba(1, 4, 8, 0.52) 100%),
    linear-gradient(180deg, rgba(2, 6, 11, 0.05), rgba(2, 6, 11, 0.24));
}

.idle-stage {
  position: relative;
  z-index: 1;
  width: min(100%, 43rem);
  display: grid;
  place-items: center;
  transform: translate3d(0, -1.6rem, 0);
  animation: idleContentFloat 13s ease-in-out infinite;
}

.idle-content-glow {
  position: absolute;
  inset: 8% 12% 18%;
  border-radius: 999px;
  background:
    radial-gradient(circle, rgba(92, 190, 255, 0.12) 0%, rgba(92, 190, 255, 0.04) 44%, rgba(92, 190, 255, 0) 76%);
  filter: blur(42px);
  opacity: 0.62;
  animation: idleContentGlow 11s ease-in-out infinite;
}

.idle-content {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  gap: clamp(1.9rem, 3.4vw, 2.7rem);
  width: 100%;
}

.idle-brand-wrap {
  width: 100%;
  display: grid;
  place-items: center;
  perspective: 1180px;
  perspective-origin: center center;
}

.idle-brand-group {
  width: 100%;
  display: grid;
  justify-items: center;
  transform-origin: center center;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  will-change: transform;
  animation: idleBrandPerspective 18s cubic-bezier(0.42, 0, 0.18, 1) infinite;
}

.idle-copy {
  display: grid;
  justify-items: center;
  gap: 0.38rem;
  text-align: center;
}

.idle-logo {
  width: min(100%, 19rem);
  filter:
    drop-shadow(0 10px 22px rgba(8, 16, 28, 0.2))
    drop-shadow(0 0 12px rgba(104, 193, 255, 0.06));
  backface-visibility: hidden;
  transform: translateZ(0);
  animation: idleLogoGlow 10.5s ease-in-out infinite;
}

.idle-headline {
  margin: 1.15rem 0 0;
  font-size: clamp(1.2rem, 3vw, 1.92rem);
  line-height: 1.08;
  font-weight: 560;
  letter-spacing: -0.018em;
  color: rgba(255, 255, 255, 0.94);
  text-shadow: 0 0 10px rgba(76, 170, 255, 0.04);
}

.idle-subheadline {
  margin: 0;
  font-size: clamp(0.78rem, 1.14vw, 0.92rem);
  line-height: 1.6;
  font-weight: 520;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: rgba(221, 234, 247, 0.58);
}

.idle-qr-module {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 1rem;
  margin-top: 0.8rem;
  isolation: isolate;
  transform: translate3d(0, 0, 1.5rem);
  transform-style: flat;
  backface-visibility: visible;
  -webkit-backface-visibility: visible;
  will-change: transform;
}

.idle-qr-haze {
  position: absolute;
  inset: 50% auto auto 50%;
  width: 18.2rem;
  height: 18.2rem;
  border-radius: 999px;
  background:
    radial-gradient(circle, rgba(120, 197, 255, 0.1) 0%, rgba(120, 197, 255, 0.03) 46%, rgba(120, 197, 255, 0) 78%);
  filter: blur(36px);
  transform: translate(-50%, -48%);
  opacity: 0.62;
}

.idle-qr-code {
  display: block;
  width: clamp(14rem, 21vw, 17.6rem);
  position: relative;
  z-index: 1;
  padding: 0.72rem;
  border-radius: 1.3rem;
  background: #fff;
  color: #111;
  overflow: hidden;
  contain: paint;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform: translateZ(0);
  will-change: transform;
  box-shadow:
    inset 0 0 0 1px rgba(10, 16, 24, 0.04),
    0 18px 48px rgba(0, 0, 0, 0.24);
}

.idle-qr-label {
  position: relative;
  z-index: 1;
  color: rgba(244, 248, 255, 0.72);
  font-size: 0.78rem;
  font-weight: 650;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

@keyframes idleBlobDriftA {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  50% {
    transform: translate3d(2.8rem, -1.4rem, 0) scale(1.08);
  }
}

@keyframes idleBlobDriftB {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  50% {
    transform: translate3d(-2rem, 1.2rem, 0) scale(1.06);
  }
}

@keyframes idleBlobDriftC {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  50% {
    transform: translate3d(1.6rem, 1rem, 0) scale(1.04);
  }
}

@keyframes idleRibbonSweepA {
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

@keyframes idleRibbonSweepB {
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

@keyframes idleFogDrift {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  50% {
    transform: translate3d(var(--fog-drift-x), var(--fog-drift-y), 0) scale(1.05);
  }
}

@keyframes idleParticleFloat {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }

  50% {
    transform: translate3d(var(--particle-drift-x), var(--particle-drift-y), 0);
  }
}

@keyframes idleParticlePulse {
  0%,
  100% {
    opacity: var(--particle-opacity);
  }

  50% {
    opacity: calc(var(--particle-opacity) + 0.1);
  }
}

@keyframes idleBackgroundLuma {
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

@keyframes idleContentFloat {
  0%,
  100% {
    transform: translate3d(0, -1.6rem, 0);
  }

  50% {
    transform: translate3d(0, -1.9rem, 0);
  }
}

@keyframes idleContentGlow {
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

@keyframes idleBrandPerspective {
  0%,
  100% {
    transform: translate3d(0, 0.36rem, 0) translateZ(0.35rem) rotateX(5.5deg) rotateY(-7.5deg) scale(1.008);
  }

  25% {
    transform: translate3d(0.72rem, -0.34rem, 0) translateZ(2.1rem) rotateX(8.5deg) rotateY(4deg) scale(1.026);
  }

  50% {
    transform: translate3d(0, -0.92rem, 0) translateZ(3.4rem) rotateX(-6.5deg) rotateY(7.8deg) scale(1.042);
  }

  75% {
    transform: translate3d(-0.82rem, -0.44rem, 0) translateZ(1.8rem) rotateX(-8.8deg) rotateY(-4.2deg) scale(1.024);
  }
}

@keyframes idleLogoGlow {
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
  .idle-color-field,
  .idle-ribbon,
  .idle-fog,
  .idle-particle,
  .idle-luma-layer,
  .idle-stage,
  .idle-content-glow,
  .idle-brand-group,
  .idle-logo {
    animation: none;
  }
}

@media (max-width: 960px) {
  .idle-stage {
    width: min(100%, 33rem);
    transform: translate3d(0, -0.8rem, 0);
  }

  .idle-content {
    gap: 1.75rem;
  }

  .idle-logo {
    width: min(100%, 15.6rem);
  }

  .idle-headline {
    font-size: clamp(1.1rem, 4.3vw, 1.52rem);
  }

  .idle-subheadline {
    font-size: clamp(0.7rem, 2.1vw, 0.82rem);
    letter-spacing: 0.18em;
  }

  .idle-qr-haze {
    width: 14.5rem;
    height: 14.5rem;
  }

  .idle-qr-code {
    width: min(62vw, 15.4rem);
  }
}
</style>
