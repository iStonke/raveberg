<script setup lang="ts">
import { computed } from 'vue'

import { formatImageFilter, getPolaroidTone } from './polaroidAging'
import { POLAROID_CONFIG } from './polaroidConfig'
import { getPolaroidEntryMotion } from './polaroidMotion'
import type { ActivePolaroid } from './polaroidTypes'

const props = defineProps<{
  item: ActivePolaroid
  vintageLookEnabled: boolean
}>()

const emit = defineEmits<{
  imageError: [instanceId: string]
}>()

const isPreEnter = computed(() => props.item.lifecycleStatus === 'pre_enter')
const isEntering = computed(() => props.item.lifecycleStatus === 'entering')
const isExiting = computed(() => props.item.lifecycleStatus === 'exiting')
const entryMotion = computed(() => getPolaroidEntryMotion(POLAROID_CONFIG.debug.simplifiedEntry))
const tone = computed(() => getPolaroidTone(props.item.toneStage))

function seededValue(seed: number, multiplier: number, offset: number) {
  const value = (seed * multiplier + offset) % 1
  return value < 0 ? value + 1 : value
}

const vintageStyleVars = computed(() => {
  if (!props.vintageLookEnabled) {
    return {}
  }

  const seed = props.item.motionSeed
  const seedB = seededValue(seed, 1.73, 0.19)
  const seedC = seededValue(seed, 2.37, 0.41)
  const seedD = seededValue(seed, 3.11, 0.13)
  const edgeWearOpacity = (0.08 + seed * 0.05).toFixed(3)
  const dustOpacity = (0.07 + seed * 0.05).toFixed(3)
  const scratchOpacity = (0.05 + (1 - seed) * 0.035).toFixed(3)
  const warmOpacity = (0.12 + seed * 0.05).toFixed(3)
  const vignetteOpacity = (0.12 + (1 - seed) * 0.05).toFixed(3)
  const fadeOpacity = (0.08 + seed * 0.04).toFixed(3)
  const filmOpacity = (0.12 + seed * 0.05).toFixed(3)
  const photoDustOpacity = (0.08 + (1 - seed) * 0.04).toFixed(3)
  const creaseOpacity = (0.09 + seed * 0.04).toFixed(3)
  const crackOpacity = (0.06 + (1 - seed) * 0.03).toFixed(3)
  const overexposureOpacity = (0.14 + seed * 0.06).toFixed(3)

  return {
    '--vintage-edge-opacity': (Number(edgeWearOpacity) + 0.05).toFixed(3),
    '--vintage-dust-opacity': dustOpacity,
    '--vintage-scratch-opacity': scratchOpacity,
    '--vintage-warm-opacity': warmOpacity,
    '--vintage-vignette-opacity': vignetteOpacity,
    '--vintage-fade-opacity': fadeOpacity,
    '--vintage-film-opacity': filmOpacity,
    '--vintage-photo-dust-opacity': photoDustOpacity,
    '--vintage-crease-opacity': creaseOpacity,
    '--vintage-crack-opacity': crackOpacity,
    '--vintage-overexposure-opacity': overexposureOpacity,
    '--vintage-tilt': `${(-0.25 + seed * 0.5).toFixed(3)}deg`,
    '--vintage-crease-a-angle': `${(82 + seed * 38).toFixed(2)}deg`,
    '--vintage-crease-a-pos': `${(22 + seedB * 46).toFixed(2)}%`,
    '--vintage-crease-b-angle': `${(168 + seedC * 28).toFixed(2)}deg`,
    '--vintage-crease-b-pos': `${(48 + seedD * 26).toFixed(2)}%`,
    '--vintage-crack-a-angle': `${(112 + seedB * 32).toFixed(2)}deg`,
    '--vintage-crack-a-pos': `${(10 + seedC * 18).toFixed(2)}%`,
    '--vintage-crack-b-angle': `${(62 + seedD * 34).toFixed(2)}deg`,
    '--vintage-crack-b-pos': `${(68 + seed * 14).toFixed(2)}%`,
    '--vintage-crack-c-angle': `${(138 + seedC * 26).toFixed(2)}deg`,
    '--vintage-crack-c-pos': `${(46 + seedB * 18).toFixed(2)}%`,
  }
})

const wrapperStyle = computed(() => {
  const entry = entryMotion.value
  const baseRotation = props.item.layout.rotation
  const baseScale = props.item.layout.scale
  const baseTranslate = `translate3d(${props.item.layout.x.toFixed(2)}px, ${props.item.layout.y.toFixed(2)}px, 0) translate(-50%, -50%)`
  const finalTransform = `${baseTranslate} rotate(${baseRotation.toFixed(2)}deg) scale(${baseScale.toFixed(4)})`
  const startTransform = `${baseTranslate} rotate(${(baseRotation + entry.rotationOffsetDeg).toFixed(2)}deg) scale(${(baseScale * entry.scaleMultiplier).toFixed(4)}) translate3d(${entry.offsetX.toFixed(2)}px, ${entry.offsetY.toFixed(2)}px, 0)`

  return {
    width: `${props.item.layout.width}px`,
    height: `${props.item.layout.height}px`,
    '--polaroid-pad-top': 'clamp(0.46rem, 0.98vw, 0.66rem)',
    '--polaroid-pad-side': 'clamp(0.46rem, 1vw, 0.68rem)',
    '--polaroid-caption-height': '72px',
    zIndex: String(2 + props.item.order),
    opacity: isPreEnter.value ? '0' : isExiting.value ? '0' : '1',
    transform: isPreEnter.value ? startTransform : finalTransform,
    boxShadow: isEntering.value
      ? '0 10px 22px rgba(12, 14, 18, 0.12)'
      : `0 14px 28px rgba(12, 14, 18, ${(0.1 + tone.value.shadowStrength * 0.05).toFixed(3)})`,
    transitionDuration: `${props.item.timings.entryDurationMs}ms, ${
      isExiting.value ? props.item.timings.exitDurationMs : 460
    }ms`,
    willChange: isPreEnter.value || isEntering.value ? 'transform, opacity' : isExiting.value ? 'opacity' : 'auto',
    contain: 'layout paint style',
    ...vintageStyleVars.value,
  }
})

const imageStyle = computed(() => {
  if (isPreEnter.value || isEntering.value) {
    return {
      filter: 'brightness(1.1) saturate(0.92)',
      opacity: isPreEnter.value ? '0.78' : '0.92',
      transform: isPreEnter.value ? 'scale(1.042)' : 'scale(1.028)',
      transitionDuration: `${props.item.timings.developmentDurationMs}ms`,
      willChange: 'opacity',
    }
  }

  return {
    filter: props.vintageLookEnabled
      ? `${formatImageFilter(tone.value)} grayscale(0.14) saturate(0.62) contrast(0.87) brightness(0.94) sepia(0.16)`
      : formatImageFilter(tone.value),
    opacity: '1',
    transform: props.vintageLookEnabled ? 'scale(1.024)' : 'scale(1.018)',
    transitionDuration: `${props.item.timings.developmentDurationMs}ms`,
    willChange: 'auto',
  }
})

const developVeilOpacity = computed(() => {
  if (isPreEnter.value) {
    return 0.88
  }
  if (isEntering.value) {
    return 0.3
  }
  return 0
})

const developBloomOpacity = computed(() => {
  if (isPreEnter.value) {
    return 0.68
  }
  if (isEntering.value) {
    return 0.18
  }
  return 0
})

const frameClass = computed(() => ({
  'polaroid-item--pre-enter': isPreEnter.value,
  'polaroid-item--entering': isEntering.value,
  'polaroid-item--exiting': isExiting.value,
  'polaroid-item--vintage': props.vintageLookEnabled,
}))
</script>

<template>
  <article class="polaroid-item" :class="frameClass" :style="wrapperStyle">
    <div class="polaroid-frame">
      <div class="polaroid-frame__paper-grain" />
      <div v-if="vintageLookEnabled" class="polaroid-frame__paper-wear" />
      <div class="polaroid-frame__photo-wrap">
        <div class="polaroid-frame__photo">
        <img
          class="polaroid-frame__image"
          :src="item.src"
          :alt="item.alt"
          :style="imageStyle"
          decoding="async"
          loading="eager"
          @error="emit('imageError', item.instanceId)"
        />
        <div v-if="vintageLookEnabled" class="polaroid-frame__vintage-wash" />
        <div v-if="vintageLookEnabled" class="polaroid-frame__vintage-fade" />
        <div v-if="vintageLookEnabled" class="polaroid-frame__vintage-film" />
        <div v-if="vintageLookEnabled" class="polaroid-frame__vintage-overexposure" />
        <div v-if="vintageLookEnabled" class="polaroid-frame__vintage-photo-dust" />
        <div v-if="vintageLookEnabled" class="polaroid-frame__vintage-crease" />
        <div v-if="vintageLookEnabled" class="polaroid-frame__vintage-cracks" />
        <div v-if="vintageLookEnabled" class="polaroid-frame__vintage-dust" />
        <div v-if="vintageLookEnabled" class="polaroid-frame__vintage-scratches" />
        <div v-if="vintageLookEnabled" class="polaroid-frame__vintage-vignette" />
        <div class="polaroid-frame__develop-bloom" :style="{ opacity: developBloomOpacity.toFixed(3) }" />
        <div class="polaroid-frame__develop-veil" :style="{ opacity: developVeilOpacity.toFixed(3) }" />
        </div>
      </div>
      <div class="polaroid-frame__footer">
        <span v-if="item.caption" class="polaroid-caption-text">{{ item.caption }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.polaroid-item {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  transition-property: transform, opacity;
  transition-timing-function: cubic-bezier(0.2, 0.76, 0.24, 1), ease-out;
}

.polaroid-frame {
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: var(--polaroid-pad-top) var(--polaroid-pad-side) 0;
  border-radius: 0;
  background:
    linear-gradient(180deg, rgba(254, 254, 250, 0.995), rgba(244, 242, 236, 0.992)),
    linear-gradient(135deg, rgba(255, 255, 255, 0.84), rgba(241, 239, 233, 0.68));
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.88),
    inset 0 -1px 0 rgba(188, 182, 170, 0.16);
}

.polaroid-item--vintage .polaroid-frame {
  background:
    linear-gradient(180deg, rgba(248, 241, 227, 0.998), rgba(232, 222, 206, 0.994)),
    linear-gradient(135deg, rgba(255, 249, 236, 0.88), rgba(221, 207, 188, 0.74));
  box-shadow:
    inset 0 1px 0 rgba(255, 251, 241, 0.72),
    inset 0 -1px 0 rgba(136, 109, 74, 0.18),
    inset 0 0 0 1px rgba(121, 96, 68, 0.06);
}

.polaroid-frame__paper-grain {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.12), transparent 38%),
    radial-gradient(circle at top, rgba(255, 255, 255, 0.18), transparent 32%);
  mix-blend-mode: screen;
  pointer-events: none;
}

.polaroid-frame__paper-wear {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 14% 18%, rgba(160, 132, 96, 0.12), transparent 22%),
    radial-gradient(circle at 88% 16%, rgba(144, 118, 90, 0.08), transparent 20%),
    linear-gradient(180deg, rgba(189, 166, 126, var(--vintage-edge-opacity, 0.1)), transparent 18%, transparent 78%, rgba(122, 96, 68, calc(var(--vintage-edge-opacity, 0.1) * 0.88)));
  mix-blend-mode: multiply;
  opacity: 0.9;
  pointer-events: none;
}

.polaroid-frame__photo-wrap {
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  display: block;
}

.polaroid-frame__photo {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 0;
  background: rgba(230, 228, 220, 0.94);
}

.polaroid-item--vintage .polaroid-frame__photo {
  background: rgba(216, 205, 187, 0.96);
}

.polaroid-frame__image,
.polaroid-frame__vintage-wash,
.polaroid-frame__vintage-fade,
.polaroid-frame__vintage-film,
.polaroid-frame__vintage-overexposure,
.polaroid-frame__vintage-photo-dust,
.polaroid-frame__vintage-crease,
.polaroid-frame__vintage-cracks,
.polaroid-frame__vintage-dust,
.polaroid-frame__vintage-scratches,
.polaroid-frame__vintage-vignette,
.polaroid-frame__develop-bloom,
.polaroid-frame__develop-veil {
  position: absolute;
  inset: 0;
}

.polaroid-frame__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition-property: transform, opacity, filter;
  transition-timing-function: cubic-bezier(0.2, 0.76, 0.24, 1);
  transform-origin: center center;
}

.polaroid-frame__vintage-wash {
  background:
    linear-gradient(180deg, rgba(255, 224, 172, var(--vintage-warm-opacity, 0.14)), rgba(112, 78, 45, calc(var(--vintage-warm-opacity, 0.14) * 0.58))),
    radial-gradient(circle at 22% 16%, rgba(255, 244, 214, 0.2), transparent 26%),
    radial-gradient(circle at 76% 74%, rgba(110, 84, 60, 0.12), transparent 34%);
  mix-blend-mode: multiply;
  transform: rotate(var(--vintage-tilt, 0deg)) scale(1.02);
  opacity: 0.62;
  pointer-events: none;
}

.polaroid-frame__vintage-fade {
  background:
    linear-gradient(180deg, rgba(255, 250, 238, calc(var(--vintage-fade-opacity, 0.08) * 1.2)), transparent 34%, rgba(90, 66, 44, calc(var(--vintage-fade-opacity, 0.08) * 0.72))),
    radial-gradient(circle at 18% 14%, rgba(255, 251, 242, calc(var(--vintage-fade-opacity, 0.08) * 1.35)), transparent 24%);
  mix-blend-mode: screen;
  opacity: 0.72;
  pointer-events: none;
}

.polaroid-frame__vintage-film {
  background:
    radial-gradient(circle at 24% 20%, rgba(248, 235, 205, calc(var(--vintage-film-opacity, 0.12) * 0.95)), transparent 18%),
    radial-gradient(circle at 76% 68%, rgba(120, 86, 54, calc(var(--vintage-film-opacity, 0.12) * 0.78)), transparent 24%),
    linear-gradient(180deg, rgba(255, 239, 204, calc(var(--vintage-film-opacity, 0.12) * 0.78)), rgba(94, 67, 42, calc(var(--vintage-film-opacity, 0.12) * 0.5)));
  mix-blend-mode: color;
  opacity: 0.9;
  pointer-events: none;
}

.polaroid-frame__vintage-overexposure {
  background:
    radial-gradient(circle at 18% 16%, rgba(255, 251, 242, calc(var(--vintage-overexposure-opacity, 0.16) * 1.22)), transparent 24%),
    radial-gradient(circle at 78% 30%, rgba(255, 246, 226, calc(var(--vintage-overexposure-opacity, 0.16) * 0.92)), transparent 20%),
    linear-gradient(180deg, rgba(255, 248, 234, calc(var(--vintage-overexposure-opacity, 0.16) * 0.56)), transparent 28%, transparent 72%, rgba(255, 239, 210, calc(var(--vintage-overexposure-opacity, 0.16) * 0.28)));
  mix-blend-mode: screen;
  opacity: 0.84;
  filter: blur(0.6px);
  pointer-events: none;
}

.polaroid-frame__vintage-photo-dust {
  background:
    radial-gradient(circle at 12% 26%, rgba(255, 247, 228, var(--vintage-photo-dust-opacity, 0.1)) 0 1.5px, transparent 2.2px),
    radial-gradient(circle at 46% 18%, rgba(255, 241, 216, calc(var(--vintage-photo-dust-opacity, 0.1) * 0.82)) 0 1.1px, transparent 1.9px),
    radial-gradient(circle at 66% 56%, rgba(134, 104, 74, calc(var(--vintage-photo-dust-opacity, 0.1) * 0.76)) 0 1.3px, transparent 2px),
    radial-gradient(circle at 82% 34%, rgba(255, 244, 223, calc(var(--vintage-photo-dust-opacity, 0.1) * 0.94)) 0 1px, transparent 1.8px),
    radial-gradient(circle at 28% 76%, rgba(109, 82, 58, calc(var(--vintage-photo-dust-opacity, 0.1) * 0.7)) 0 1.25px, transparent 2px);
  mix-blend-mode: soft-light;
  opacity: 0.88;
  pointer-events: none;
}

.polaroid-frame__vintage-crease {
  background:
    linear-gradient(
      var(--vintage-crease-a-angle, 96deg),
      transparent 0 calc(var(--vintage-crease-a-pos, 42%) - 1.1%),
      rgba(255, 248, 232, calc(var(--vintage-crease-opacity, 0.1) * 1.12)) calc(var(--vintage-crease-a-pos, 42%) - 0.15%),
      rgba(112, 86, 60, calc(var(--vintage-crease-opacity, 0.1) * 0.86)) calc(var(--vintage-crease-a-pos, 42%) + 0.55%),
      transparent calc(var(--vintage-crease-a-pos, 42%) + 1.8%)
    ),
    linear-gradient(
      var(--vintage-crease-b-angle, 184deg),
      transparent 0 calc(var(--vintage-crease-b-pos, 67%) - 1%),
      rgba(255, 246, 226, calc(var(--vintage-crease-opacity, 0.1) * 0.96)) calc(var(--vintage-crease-b-pos, 67%) - 0.12%),
      rgba(96, 72, 48, calc(var(--vintage-crease-opacity, 0.1) * 0.74)) calc(var(--vintage-crease-b-pos, 67%) + 0.52%),
      transparent calc(var(--vintage-crease-b-pos, 67%) + 1.5%)
    );
  mix-blend-mode: overlay;
  opacity: 0.92;
  pointer-events: none;
}

.polaroid-frame__vintage-cracks {
  background:
    linear-gradient(
      var(--vintage-crack-a-angle, 121deg),
      transparent 0 calc(var(--vintage-crack-a-pos, 18%) - 0.7%),
      rgba(255, 250, 238, calc(var(--vintage-crack-opacity, 0.07) * 1.28)) calc(var(--vintage-crack-a-pos, 18%) - 0.08%),
      rgba(74, 54, 36, calc(var(--vintage-crack-opacity, 0.07) * 1.02)) calc(var(--vintage-crack-a-pos, 18%) + 0.3%),
      transparent calc(var(--vintage-crack-a-pos, 18%) + 1.1%)
    ),
    linear-gradient(
      var(--vintage-crack-b-angle, 78deg),
      transparent 0 calc(var(--vintage-crack-b-pos, 74%) - 0.55%),
      rgba(255, 248, 230, calc(var(--vintage-crack-opacity, 0.07) * 1.04)) calc(var(--vintage-crack-b-pos, 74%) - 0.08%),
      rgba(80, 58, 38, calc(var(--vintage-crack-opacity, 0.07) * 0.86)) calc(var(--vintage-crack-b-pos, 74%) + 0.24%),
      transparent calc(var(--vintage-crack-b-pos, 74%) + 0.86%)
    ),
    linear-gradient(
      var(--vintage-crack-c-angle, 153deg),
      transparent 0 calc(var(--vintage-crack-c-pos, 58%) - 0.45%),
      rgba(255, 250, 240, calc(var(--vintage-crack-opacity, 0.07) * 0.9)) calc(var(--vintage-crack-c-pos, 58%) - 0.06%),
      transparent calc(var(--vintage-crack-c-pos, 58%) + 0.72%)
    );
  mix-blend-mode: normal;
  opacity: 0.74;
  pointer-events: none;
}

.polaroid-frame__vintage-dust {
  background:
    radial-gradient(circle at 18% 30%, rgba(255, 244, 222, calc(var(--vintage-dust-opacity, 0.08) * 1.1)) 0 1.4px, transparent 2.2px),
    radial-gradient(circle at 68% 24%, rgba(148, 122, 92, var(--vintage-dust-opacity, 0.08)) 0 1.3px, transparent 2px),
    radial-gradient(circle at 52% 68%, rgba(122, 102, 78, calc(var(--vintage-dust-opacity, 0.08) * 0.9)) 0 1.5px, transparent 2.3px),
    radial-gradient(circle at 82% 58%, rgba(255, 246, 228, calc(var(--vintage-dust-opacity, 0.08) * 1.05)) 0 1.2px, transparent 1.9px);
  opacity: 1;
  mix-blend-mode: normal;
  pointer-events: none;
}

.polaroid-frame__vintage-scratches {
  background:
    linear-gradient(102deg, transparent 0 18%, rgba(255, 252, 244, var(--vintage-scratch-opacity, 0.05)) 18.6%, transparent 19.2%, transparent 54%, rgba(84, 64, 44, calc(var(--vintage-scratch-opacity, 0.05) * 0.9)) 54.5%, transparent 55.1%, transparent 100%),
    linear-gradient(88deg, transparent 0 72%, rgba(255, 248, 236, calc(var(--vintage-scratch-opacity, 0.05) * 0.95)) 72.4%, transparent 73%, transparent 100%);
  mix-blend-mode: normal;
  opacity: 0.7;
  pointer-events: none;
}

.polaroid-frame__vintage-vignette {
  background:
    radial-gradient(circle at 50% 50%, transparent 52%, rgba(72, 50, 30, calc(var(--vintage-vignette-opacity, 0.12) * 0.52)) 100%),
    linear-gradient(180deg, transparent 0 58%, rgba(120, 90, 58, calc(var(--vintage-vignette-opacity, 0.12) * 0.38)) 100%);
  mix-blend-mode: multiply;
  opacity: 0.88;
  pointer-events: none;
}

.polaroid-frame__develop-bloom {
  background:
    radial-gradient(circle at 52% 42%, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.5) 34%, rgba(255, 255, 255, 0.08) 72%, transparent 100%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.64), rgba(255, 255, 255, 0.18));
  filter: blur(10px);
  mix-blend-mode: screen;
  pointer-events: none;
  transition: opacity 1300ms cubic-bezier(0.18, 0.76, 0.24, 1);
}

.polaroid-frame__develop-veil {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.42)),
    radial-gradient(circle at 50% 28%, rgba(255, 255, 255, 0.74), transparent 68%);
  pointer-events: none;
  transition: opacity 1450ms cubic-bezier(0.18, 0.76, 0.24, 1);
}

.polaroid-frame__footer {
  flex: 0 0 var(--polaroid-caption-height);
  height: var(--polaroid-caption-height);
  min-height: var(--polaroid-caption-height);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: rgba(244, 242, 236, 0.992);
}

.polaroid-caption-text {
  display: inline-block;
  max-width: calc(100% - 1.25rem);
  font-family:
    "Caveat",
    "Bradley Hand",
    "Segoe Print",
    "Noteworthy",
    "Chalkboard SE",
    "Trebuchet MS",
    "Apple Color Emoji",
    "Segoe UI Emoji",
    "Noto Color Emoji",
    sans-serif;
  font-size: clamp(1rem, 2vw, 1.375rem);
  line-height: 1;
  text-align: center;
  color: rgba(72, 58, 44, 0.9);
  letter-spacing: normal;
  word-spacing: normal;
  white-space: normal;
  overflow-wrap: anywhere;
  font-kerning: normal;
  font-variant-ligatures: none;
  transform: translateY(-2px);
}
</style>
