<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type { VideoAsset, VideoState } from '../../services/api'

const props = defineProps<{
  settings: VideoState
  assets: VideoAsset[]
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const isTransitioning = ref(false)
const queueIds = ref<number[]>([])
const currentAssetId = ref<number | null>(null)
const currentToken = ref(0)

let fadeTimer: number | undefined

const orderedAssets = computed(() => [...props.assets].sort((left, right) => left.position - right.position))
const activeAsset = computed(() =>
  orderedAssets.value.find((asset) => asset.id === currentAssetId.value) ?? null,
)
const filterStyle = computed(() =>
  props.settings.vintage_filter_enabled
    ? 'grayscale(1) contrast(1.24) brightness(0.86) saturate(0.08) sepia(0.18)'
    : 'none',
)
const objectFitClass = computed(() =>
  props.settings.object_fit === 'cover' ? 'video-stage__video--cover' : 'video-stage__video--contain',
)
const vintageStyleVars = computed(() => {
  if (!props.settings.vintage_filter_enabled || currentAssetId.value == null) {
    return {}
  }

  const seed = ((currentAssetId.value % 17) + 1) / 18
  const seedB = ((currentAssetId.value * 7) % 19) / 19
  const seedC = ((currentAssetId.value * 11) % 23) / 23

  return {
    '--video-vintage-grain-opacity': (0.18 + seed * 0.12).toFixed(3),
    '--video-vintage-dust-opacity': (0.16 + seedB * 0.1).toFixed(3),
    '--video-vintage-scratch-opacity': (0.14 + seedC * 0.12).toFixed(3),
    '--video-vintage-flicker-opacity': (0.08 + seed * 0.06).toFixed(3),
    '--video-vintage-vignette-opacity': (0.26 + seedB * 0.12).toFixed(3),
    '--video-vintage-jitter-x': `${(-0.3 + seed * 0.6).toFixed(3)}%`,
    '--video-vintage-jitter-y': `${(-0.22 + seedC * 0.44).toFixed(3)}%`,
    '--video-vintage-scratch-angle': `${(84 + seed * 36).toFixed(2)}deg`,
    '--video-vintage-scratch-offset': `${(18 + seedB * 54).toFixed(2)}%`,
  }
})

watch(
  () => [props.settings, props.assets] as const,
  () => {
    void syncPlaybackState()
  },
  { deep: true, immediate: true },
)

onBeforeUnmount(() => {
  if (fadeTimer) {
    window.clearTimeout(fadeTimer)
  }
})

async function syncPlaybackState() {
  if (!orderedAssets.value.length) {
    currentAssetId.value = null
    queueIds.value = []
    const video = videoRef.value
    if (video) {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
    return
  }

  if (props.settings.playlist_enabled) {
    const nextQueue = buildQueue()
    const preferredId =
      currentAssetId.value && nextQueue.includes(currentAssetId.value)
        ? currentAssetId.value
        : props.settings.active_video_id && nextQueue.includes(props.settings.active_video_id)
          ? props.settings.active_video_id
          : nextQueue[0]

    queueIds.value = nextQueue
    if (preferredId == null) {
      return
    }
    await playAsset(preferredId)
    return
  }

  queueIds.value = []
  const singleId =
    props.settings.active_video_id && orderedAssets.value.some((asset) => asset.id === props.settings.active_video_id)
      ? props.settings.active_video_id
      : orderedAssets.value[0]?.id ?? null

  if (singleId == null) {
    return
  }
  await playAsset(singleId)
}

function buildQueue() {
  const ids = orderedAssets.value.map((asset) => asset.id)
  if (props.settings.playback_order === 'upload_order') {
    return ids
  }
  return shuffle(ids)
}

async function playAsset(assetId: number) {
  const asset = orderedAssets.value.find((entry) => entry.id === assetId)
  if (!asset) {
    return
  }

  const token = currentToken.value + 1
  currentToken.value = token
  currentAssetId.value = asset.id
  await nextTick()
  const video = videoRef.value
  if (!video) {
    return
  }
  video.muted = true
  video.volume = 0
  video.defaultMuted = true
  video.playsInline = true
  video.loop = !props.settings.playlist_enabled && props.settings.loop_enabled

  if (props.settings.transition === 'fade') {
    isTransitioning.value = true
    if (fadeTimer) {
      window.clearTimeout(fadeTimer)
    }
    await wait(180)
  }

  video.src = asset.stream_url
  video.load()

  try {
    await waitForMetadata(video)
    if (currentToken.value !== token) {
      return
    }
    await video.play()
  } catch {
    return
  } finally {
    if (props.settings.transition === 'fade') {
      fadeTimer = window.setTimeout(() => {
        isTransitioning.value = false
      }, 30)
    }
  }
}

function handleEnded() {
  if (!orderedAssets.value.length || currentAssetId.value == null) {
    return
  }

  if (!props.settings.playlist_enabled) {
    if (props.settings.loop_enabled) {
      void playAsset(currentAssetId.value)
    }
    return
  }

  const queue = queueIds.value.length ? queueIds.value : buildQueue()
  const currentIndex = queue.indexOf(currentAssetId.value)
  const nextIndex = currentIndex + 1
  if (nextIndex < queue.length) {
    void playAsset(queue[nextIndex])
    return
  }

  if (!props.settings.loop_enabled) {
    return
  }

  const nextQueue = buildQueue()
  queueIds.value = nextQueue
  if (nextQueue[0] != null) {
    void playAsset(nextQueue[0])
  }
}

function waitForMetadata(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    if (video.readyState >= 2) {
      resolve()
      return
    }
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('Video konnte nicht geladen werden'))
    }
    const cleanup = () => {
      video.removeEventListener('loadeddata', onReady)
      video.removeEventListener('error', onError)
    }
    video.addEventListener('loadeddata', onReady, { once: true })
    video.addEventListener('error', onError, { once: true })
  })
}

function wait(durationMs: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs)
  })
}

function shuffle(values: number[]) {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}
</script>

<template>
  <section
    class="video-stage"
    :class="{ 'video-stage--vintage': props.settings.vintage_filter_enabled }"
    :style="vintageStyleVars"
  >
    <video
      v-if="activeAsset"
      ref="videoRef"
      class="video-stage__video"
      :class="[objectFitClass, { 'video-stage__video--hidden': isTransitioning }]"
      :style="{ filter: filterStyle }"
      autoplay
      muted
      playsinline
      @ended="handleEnded"
    />
    <template v-if="activeAsset && props.settings.vintage_filter_enabled">
      <div class="video-stage__vintage video-stage__vintage--grain" />
      <div class="video-stage__vintage video-stage__vintage--dust" />
      <div class="video-stage__vintage video-stage__vintage--scratches" />
      <div class="video-stage__vintage video-stage__vintage--flicker" />
      <div class="video-stage__vintage video-stage__vintage--vignette" />
    </template>
    <div v-else class="video-stage__empty">
      Keine Videos geladen.
    </div>
  </section>
</template>

<style scoped>
.video-stage {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
  background:
    radial-gradient(circle at top, rgba(76, 115, 162, 0.18), transparent 34%),
    linear-gradient(180deg, #05080b 0%, #020304 100%);
}

.video-stage__video {
  width: 100%;
  height: 100%;
  opacity: 1;
  transition:
    opacity 220ms ease,
    transform 280ms ease,
    filter 280ms ease;
  background: #020304;
}

.video-stage--vintage .video-stage__video {
  transform: translate(var(--video-vintage-jitter-x, 0), var(--video-vintage-jitter-y, 0)) scale(1.018);
  animation: video-vintage-gate-weave 2.9s steps(1) infinite;
}

.video-stage__video--cover {
  object-fit: cover;
}

.video-stage__video--contain {
  object-fit: contain;
}

.video-stage__video--hidden {
  opacity: 0;
}

.video-stage__vintage {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.video-stage__vintage--grain {
  opacity: var(--video-vintage-grain-opacity, 0.16);
  mix-blend-mode: soft-light;
  background:
    radial-gradient(circle at 22% 28%, rgba(255, 255, 255, 0.52) 0 0.7px, transparent 1.25px),
    radial-gradient(circle at 68% 62%, rgba(255, 255, 255, 0.34) 0 0.85px, transparent 1.45px),
    radial-gradient(circle at 48% 18%, rgba(0, 0, 0, 0.52) 0 0.95px, transparent 1.55px),
    radial-gradient(circle at 34% 76%, rgba(0, 0, 0, 0.42) 0 0.78px, transparent 1.28px),
    radial-gradient(circle at 58% 46%, rgba(255, 255, 255, 0.3) 0 0.65px, transparent 1.15px);
  background-size: 12px 12px, 14px 14px, 17px 17px, 19px 19px, 23px 23px;
  animation: video-vintage-grain 180ms steps(2) infinite;
}

.video-stage__vintage--dust {
  opacity: var(--video-vintage-dust-opacity, 0.12);
  background:
    radial-gradient(circle at 12% 26%, rgba(255, 255, 255, 0.92) 0 1.2px, transparent 2px),
    radial-gradient(circle at 24% 74%, rgba(255, 255, 255, 0.78) 0 1.35px, transparent 2.1px),
    radial-gradient(circle at 56% 32%, rgba(255, 255, 255, 0.88) 0 1.1px, transparent 1.9px),
    radial-gradient(circle at 78% 18%, rgba(255, 255, 255, 0.76) 0 1.2px, transparent 1.95px),
    radial-gradient(circle at 82% 68%, rgba(255, 255, 255, 0.82) 0 1.55px, transparent 2.25px),
    radial-gradient(circle at 66% 84%, rgba(34, 24, 18, 0.82) 0 1.8px, transparent 2.5px),
    radial-gradient(circle at 44% 58%, rgba(255, 255, 255, 0.74) 0 0.9px, transparent 1.6px);
}

.video-stage__vintage--scratches {
  opacity: var(--video-vintage-scratch-opacity, 0.1);
  background:
    linear-gradient(
      var(--video-vintage-scratch-angle, 98deg),
      transparent 0 calc(var(--video-vintage-scratch-offset, 38%) - 0.24%),
      rgba(255, 255, 255, 0.98) calc(var(--video-vintage-scratch-offset, 38%) - 0.05%),
      rgba(64, 46, 28, 0.76) calc(var(--video-vintage-scratch-offset, 38%) + 0.18%),
      transparent calc(var(--video-vintage-scratch-offset, 38%) + 0.7%)
    ),
    linear-gradient(88deg, transparent 0 62%, rgba(255, 255, 255, 0.72) 62.2%, transparent 62.7%),
    linear-gradient(103deg, transparent 0 14%, rgba(54, 39, 26, 0.58) 14.25%, transparent 14.6%),
    linear-gradient(96deg, transparent 0 84%, rgba(255, 255, 255, 0.42) 84.2%, transparent 84.7%);
  mix-blend-mode: screen;
}

.video-stage__vintage--flicker {
  opacity: var(--video-vintage-flicker-opacity, 0.06);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(0, 0, 0, 0.34)),
    linear-gradient(90deg, transparent 0 76%, rgba(255, 255, 255, 0.24) 88%, transparent 100%);
  mix-blend-mode: soft-light;
  animation: video-vintage-flicker 1200ms steps(2) infinite;
}

.video-stage__vintage--vignette {
  opacity: var(--video-vintage-vignette-opacity, 0.2);
  background:
    radial-gradient(circle at 50% 50%, transparent 48%, rgba(11, 8, 6, 0.78) 100%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.1), transparent 18%, transparent 74%, rgba(0, 0, 0, 0.34));
}

.video-stage__empty {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: rgba(235, 242, 248, 0.62);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.84rem;
}

@keyframes video-vintage-grain {
  0% {
    transform: translate3d(0, 0, 0);
  }
  33% {
    transform: translate3d(-1.2%, 0.8%, 0);
  }
  66% {
    transform: translate3d(1%, -0.6%, 0);
  }
  100% {
    transform: translate3d(0.4%, 1%, 0);
  }
}

@keyframes video-vintage-flicker {
  0%,
  100% {
    opacity: calc(var(--video-vintage-flicker-opacity, 0.06) * 0.8);
  }
  18% {
    opacity: calc(var(--video-vintage-flicker-opacity, 0.06) * 1.15);
  }
  46% {
    opacity: calc(var(--video-vintage-flicker-opacity, 0.06) * 0.62);
  }
  74% {
    opacity: calc(var(--video-vintage-flicker-opacity, 0.06) * 1.28);
  }
}

@keyframes video-vintage-gate-weave {
  0%,
  100% {
    transform: translate(var(--video-vintage-jitter-x, 0), var(--video-vintage-jitter-y, 0)) scale(1.018);
  }
  25% {
    transform: translate(calc(var(--video-vintage-jitter-x, 0) * -0.65), calc(var(--video-vintage-jitter-y, 0) * 0.55)) scale(1.02);
  }
  50% {
    transform: translate(calc(var(--video-vintage-jitter-x, 0) * 0.45), calc(var(--video-vintage-jitter-y, 0) * -0.5)) scale(1.016);
  }
  75% {
    transform: translate(calc(var(--video-vintage-jitter-x, 0) * -0.35), calc(var(--video-vintage-jitter-y, 0) * -0.2)) scale(1.019);
  }
}
</style>
