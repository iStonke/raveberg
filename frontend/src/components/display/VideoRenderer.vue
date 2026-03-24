<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import type { VideoAsset, VideoState } from '../../services/api'
import DisplaySwitchLayer from './DisplaySwitchLayer.vue'

const props = defineProps<{
  settings: VideoState
  assets: VideoAsset[]
}>()

const CROSSFADE_DURATION_MS = 420

type VideoLayerName = 'a' | 'b'
type VideoLayerState = {
  asset: VideoAsset | null
  active: boolean
}

const videoARef = ref<HTMLVideoElement | null>(null)
const videoBRef = ref<HTMLVideoElement | null>(null)
const isTransitioning = ref(false)
const queueIds = ref<number[]>([])
const currentAssetId = ref<number | null>(null)
const currentToken = ref(0)
const activeLayerName = ref<VideoLayerName>('a')
const layerStates = reactive<Record<VideoLayerName, VideoLayerState>>({
  a: {
    asset: null,
    active: false,
  },
  b: {
    asset: null,
    active: false,
  },
})

let fadeTimer: number | undefined

const orderedAssets = computed(() => [...props.assets].sort((left, right) => left.position - right.position))
const activeAsset = computed(() => layerStates[activeLayerName.value].asset)
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

onMounted(() => {
  syncLayerSettings()
  void syncPlaybackState()
})

onBeforeUnmount(() => {
  if (fadeTimer) {
    window.clearTimeout(fadeTimer)
  }
  stopLayer('a')
  stopLayer('b')
})

async function syncPlaybackState() {
  if (!orderedAssets.value.length) {
    queueIds.value = []
    currentAssetId.value = null
    isTransitioning.value = false
    layerStates.a.asset = null
    layerStates.a.active = false
    layerStates.b.asset = null
    layerStates.b.active = false
    stopLayer('a')
    stopLayer('b')
    return
  }

  if (props.settings.playlist_enabled) {
    const nextQueue = buildQueue()
    const queueChanged = !sameQueue(queueIds.value, nextQueue)
    const preferredId =
      queueChanged
        ? nextQueue[0]
        : currentAssetId.value && nextQueue.includes(currentAssetId.value)
        ? currentAssetId.value
        : props.settings.active_video_id && nextQueue.includes(props.settings.active_video_id)
          ? props.settings.active_video_id
          : nextQueue[0]

    queueIds.value = nextQueue
    if (preferredId == null) {
      return
    }
    if (preferredId === currentAssetId.value && activeAsset.value?.id === preferredId) {
      syncLayerSettings()
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
  if (singleId === currentAssetId.value && activeAsset.value?.id === singleId) {
    syncLayerSettings()
    return
  }
  await playAsset(singleId)
}

function buildQueue() {
  const ids = orderedAssets.value.map((asset) => asset.id)
  if (props.settings.playlist_enabled || props.settings.playback_order === 'upload_order') {
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
  const hasVisibleAsset = !!activeAsset.value
  const shouldCrossfade =
    props.settings.transition === 'fade' &&
    hasVisibleAsset &&
    activeAsset.value?.id !== asset.id

  if (!shouldCrossfade) {
    const layerName = activeLayerName.value
    const inactiveLayerName = getInactiveLayerName(layerName)
    const prepared = await prepareLayer(layerName, asset, token)
    if (!prepared || currentToken.value !== token) {
      return
    }
    currentAssetId.value = asset.id
    layerStates[layerName].active = true
    layerStates[inactiveLayerName].active = false
    layerStates[inactiveLayerName].asset = null
    stopLayer(inactiveLayerName)
    isTransitioning.value = false
    return
  }

  const previousLayerName = activeLayerName.value
  const nextLayerName = getInactiveLayerName(previousLayerName)
  const prepared = await prepareLayer(nextLayerName, asset, token)
  if (!prepared || currentToken.value !== token) {
    return
  }

  currentAssetId.value = asset.id
  isTransitioning.value = true
  activeLayerName.value = nextLayerName
  if (fadeTimer) {
    window.clearTimeout(fadeTimer)
  }
  window.requestAnimationFrame(() => {
    layerStates[nextLayerName].active = true
    layerStates[previousLayerName].active = false
  })
  fadeTimer = window.setTimeout(() => {
    if (currentToken.value !== token) {
      return
    }
    layerStates[previousLayerName].asset = null
    stopLayer(previousLayerName)
    isTransitioning.value = false
    fadeTimer = undefined
  }, CROSSFADE_DURATION_MS + 40)
}

function handleEnded(layerName: VideoLayerName) {
  if (
    layerName !== activeLayerName.value ||
    !orderedAssets.value.length ||
    currentAssetId.value == null
  ) {
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

  const nextQueue = buildQueue()
  queueIds.value = nextQueue
  if (nextQueue[0] != null) {
    void playAsset(nextQueue[0])
  }
}

function getVideoElement(layerName: VideoLayerName) {
  return layerName === 'a' ? videoARef.value : videoBRef.value
}

function getInactiveLayerName(layerName: VideoLayerName): VideoLayerName {
  return layerName === 'a' ? 'b' : 'a'
}

function syncLayerSettings() {
  applyVideoElementSettings(videoARef.value)
  applyVideoElementSettings(videoBRef.value)
}

async function prepareLayer(layerName: VideoLayerName, asset: VideoAsset, token: number) {
  const video = getVideoElement(layerName)
  if (!video) {
    return false
  }

  layerStates[layerName].asset = asset
  layerStates[layerName].active = false
  applyVideoElementSettings(video)
  video.pause()
  video.src = asset.stream_url
  video.load()

  try {
    await waitForMetadata(video)
    if (currentToken.value !== token) {
      return false
    }
    applyVideoElementSettings(video)
    await video.play()
    return true
  } catch {
    return false
  }
}

function applyVideoElementSettings(video: HTMLVideoElement | null) {
  if (!video) {
    return
  }
  video.muted = true
  video.volume = 0
  video.defaultMuted = true
  video.playsInline = true
  video.loop = !props.settings.playlist_enabled && props.settings.loop_enabled
}

function stopLayer(layerName: VideoLayerName) {
  const video = getVideoElement(layerName)
  if (!video) {
    return
  }
  video.pause()
  video.removeAttribute('src')
  video.load()
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

function shuffle(values: number[]) {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

function sameQueue(left: number[], right: number[]) {
  if (left.length !== right.length) {
    return false
  }
  return left.every((value, index) => value === right[index])
}
</script>

<template>
  <section
    class="video-stage"
    :class="{
      'video-stage--vintage': props.settings.vintage_filter_enabled,
      'video-stage--transitioning': isTransitioning,
    }"
    :style="vintageStyleVars"
  >
    <DisplaySwitchLayer
      :active="layerStates.a.active"
      :visible="!!layerStates.a.asset"
      :duration-ms="CROSSFADE_DURATION_MS"
      :z-index="activeLayerName === 'a' ? 2 : 1"
    >
      <video
        ref="videoARef"
        class="video-stage__video"
        :class="[objectFitClass, { 'video-stage__video--unused': !layerStates.a.asset }]"
        :style="{ filter: filterStyle }"
        autoplay
        muted
        playsinline
        @ended="handleEnded('a')"
      />
    </DisplaySwitchLayer>
    <DisplaySwitchLayer
      :active="layerStates.b.active"
      :visible="!!layerStates.b.asset"
      :duration-ms="CROSSFADE_DURATION_MS"
      :z-index="activeLayerName === 'b' ? 2 : 1"
    >
      <video
        ref="videoBRef"
        class="video-stage__video"
        :class="[objectFitClass, { 'video-stage__video--unused': !layerStates.b.asset }]"
        :style="{ filter: filterStyle }"
        autoplay
        muted
        playsinline
        @ended="handleEnded('b')"
      />
    </DisplaySwitchLayer>
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
  transition:
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

.video-stage__video--unused {
  visibility: hidden;
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
