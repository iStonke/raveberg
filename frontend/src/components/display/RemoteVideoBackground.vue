<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { RemoteVisualizerFallback } from '../../services/api'

const props = withDefaults(
  defineProps<{
    url: string
    reconnectMs?: number
    fallback?: RemoteVisualizerFallback
  }>(),
  {
    reconnectMs: 3000,
    fallback: 'local',
  },
)

const emit = defineEmits<{
  'availability-change': [available: boolean]
}>()

const streamSrc = ref('')
const streamNonce = ref(0)
const hasLoadedFrame = ref(false)
const isConnected = ref(false)
const isRecovering = ref(false)

let retryTimer: number | undefined
let bootstrapTimer: number | undefined

const normalizedUrl = computed(() => props.url.trim())
const effectiveReconnectMs = computed(() => Math.max(1000, props.reconnectMs ?? 3000))
const fallbackClass = computed(() =>
  props.fallback === 'none'
    ? 'remote-video-background__fallback--none'
    : 'remote-video-background__fallback--local',
)

watch(
  () => normalizedUrl.value,
  () => {
    resetStreamState()
    if (!normalizedUrl.value) {
      emitAvailability(false)
      return
    }
    beginConnection()
  },
  { immediate: true },
)

watch(
  () => props.reconnectMs,
  () => {
    if (isRecovering.value && normalizedUrl.value) {
      scheduleReconnect()
    }
  },
)

onBeforeUnmount(() => {
  window.clearTimeout(retryTimer)
  window.clearTimeout(bootstrapTimer)
})

function beginConnection() {
  window.clearTimeout(retryTimer)
  window.clearTimeout(bootstrapTimer)
  retryTimer = undefined
  bootstrapTimer = undefined
  isRecovering.value = false

  streamNonce.value += 1
  const separator = normalizedUrl.value.includes('?') ? '&' : '?'
  streamSrc.value = `${normalizedUrl.value}${separator}rb_stream=${streamNonce.value}`

  bootstrapTimer = window.setTimeout(() => {
    if (!isConnected.value) {
      handleDisconnect()
    }
  }, Math.max(effectiveReconnectMs.value * 2, 5000))
}

function handleLoad() {
  window.clearTimeout(bootstrapTimer)
  bootstrapTimer = undefined
  hasLoadedFrame.value = true
  isConnected.value = true
  isRecovering.value = false
  emitAvailability(true)
}

function handleError() {
  handleDisconnect()
}

function handleDisconnect() {
  window.clearTimeout(bootstrapTimer)
  bootstrapTimer = undefined

  if (!normalizedUrl.value) {
    resetStreamState()
    emitAvailability(false)
    return
  }

  isConnected.value = false
  isRecovering.value = true
  emitAvailability(false)
  scheduleReconnect()
}

function scheduleReconnect() {
  window.clearTimeout(retryTimer)
  retryTimer = window.setTimeout(() => {
    retryTimer = undefined
    if (!normalizedUrl.value) {
      return
    }
    beginConnection()
  }, effectiveReconnectMs.value)
}

function resetStreamState() {
  window.clearTimeout(retryTimer)
  window.clearTimeout(bootstrapTimer)
  retryTimer = undefined
  bootstrapTimer = undefined
  streamSrc.value = ''
  hasLoadedFrame.value = false
  isConnected.value = false
  isRecovering.value = false
}

function emitAvailability(available: boolean) {
  emit('availability-change', available)
}
</script>

<template>
  <div class="remote-video-background" aria-hidden="true">
    <div class="remote-video-background__fallback" :class="fallbackClass">
      <div v-if="props.fallback !== 'none'" class="remote-video-background__aurora remote-video-background__aurora--a" />
      <div v-if="props.fallback !== 'none'" class="remote-video-background__aurora remote-video-background__aurora--b" />
      <div v-if="props.fallback !== 'none'" class="remote-video-background__grain" />
    </div>

    <img
      v-if="streamSrc"
      :key="streamSrc"
      class="remote-video-background__stream"
      :class="{ 'remote-video-background__stream--visible': isConnected }"
      :src="streamSrc"
      alt=""
      referrerpolicy="no-referrer"
      @load="handleLoad"
      @error="handleError"
    >

    <div
      v-if="hasLoadedFrame && isRecovering"
      class="remote-video-background__recovering-veil"
    />
  </div>
</template>

<style scoped>
.remote-video-background {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #020304;
}

.remote-video-background__fallback,
.remote-video-background__stream,
.remote-video-background__recovering-veil {
  position: absolute;
  inset: 0;
}

.remote-video-background__fallback {
  background:
    radial-gradient(circle at 50% 22%, rgba(66, 142, 220, 0.14), transparent 26%),
    linear-gradient(180deg, #040812 0%, #02050a 100%);
}

.remote-video-background__fallback--none {
  background: linear-gradient(180deg, #020304 0%, #05070c 100%);
}

.remote-video-background__aurora {
  position: absolute;
  border-radius: 999px;
  filter: blur(90px);
  opacity: 0.42;
  mix-blend-mode: screen;
  animation: remote-video-background-drift 18s ease-in-out infinite alternate;
}

.remote-video-background__aurora--a {
  top: -12%;
  left: -8%;
  width: 42%;
  height: 46%;
  background: rgba(65, 130, 214, 0.48);
}

.remote-video-background__aurora--b {
  right: -10%;
  bottom: -16%;
  width: 46%;
  height: 50%;
  background: rgba(24, 216, 201, 0.28);
  animation-duration: 24s;
}

.remote-video-background__grain {
  position: absolute;
  inset: -20%;
  background-image:
    radial-gradient(circle at 30% 40%, rgba(255, 255, 255, 0.08) 0 1px, transparent 1px),
    radial-gradient(circle at 70% 64%, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px);
  background-size: 16px 16px, 22px 22px;
  opacity: 0.18;
  animation: remote-video-background-grain 10s linear infinite;
}

.remote-video-background__stream {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 320ms ease;
}

.remote-video-background__stream--visible {
  opacity: 1;
}

.remote-video-background__recovering-veil {
  background: rgba(3, 6, 10, 0.22);
  backdrop-filter: blur(2px);
}

@keyframes remote-video-background-drift {
  from {
    transform: translate3d(-2%, 0, 0) scale(1);
  }
  to {
    transform: translate3d(3%, 2%, 0) scale(1.08);
  }
}

@keyframes remote-video-background-grain {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(4%, -3%, 0);
  }
}
</style>
