<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { RemoteRendererFallback } from '../../services/api'

type RemoteRendererStatus =
  | 'idle'
  | 'checking'
  | 'ready'
  | 'display_not_loaded'
  | 'browser_failed'
  | 'ffmpeg_failed'
  | 'hls_not_ready'
  | 'remote_unavailable'

type RemoteRendererHealthPayload = {
  status?: string
  statusDetail?: string
  lastError?: string
  preferred_output?: {
    ready?: boolean
  }
  preferredOutput?: {
    ready?: boolean
  }
}

const props = withDefaults(
  defineProps<{
    baseUrl: string
    outputPath?: string
    healthUrl?: string
    reconnectMs?: number
    fallback?: RemoteRendererFallback
  }>(),
  {
    outputPath: '/preview',
    healthUrl: '',
    reconnectMs: 3000,
    fallback: 'local',
  },
)

const emit = defineEmits<{
  'availability-change': [available: boolean]
  'status-change': [payload: { available: boolean; state: RemoteRendererStatus; detail: string }]
}>()

const remoteState = ref<RemoteRendererStatus>('idle')
const remoteDetail = ref('Renderer wird vorbereitet.')
const outputSrc = ref('')
const outputNonce = ref(0)
const frameVisible = ref(false)

let pollTimer: number | undefined
let requestCounter = 0

const normalizedBaseUrl = computed(() => props.baseUrl.trim().replace(/\/+$/, ''))
const normalizedOutputPath = computed(() => normalizePath(props.outputPath))
const normalizedHealthUrl = computed(() => {
  const configured = props.healthUrl.trim()
  if (!configured) {
    return joinUrl(normalizedBaseUrl.value, '/health')
  }
  return configured.startsWith('http://') || configured.startsWith('https://')
    ? configured
    : joinUrl(normalizedBaseUrl.value, configured)
})
const resolvedOutputUrl = computed(() => joinUrl(normalizedBaseUrl.value, normalizedOutputPath.value))
const effectiveReconnectMs = computed(() => Math.max(1000, props.reconnectMs ?? 3000))
const outputKind = computed<'preview' | 'hls'>(() =>
  normalizedOutputPath.value.endsWith('.m3u8') ? 'hls' : 'preview',
)
const statusClass = computed(() => `remote-renderer-player__status--${remoteState.value}`)

watch(
  () => [
    normalizedBaseUrl.value,
    normalizedOutputPath.value,
    normalizedHealthUrl.value,
    effectiveReconnectMs.value,
  ],
  () => {
    resetState()
    if (!normalizedBaseUrl.value) {
      setStatus('remote_unavailable', 'Kein externer Renderer konfiguriert.', false)
      return
    }
    void pollHealth(true)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  window.clearTimeout(pollTimer)
})

async function pollHealth(immediate = false) {
  window.clearTimeout(pollTimer)
  pollTimer = undefined

  if (!normalizedBaseUrl.value) {
    return
  }

  if (immediate || remoteState.value === 'idle') {
    setStatus('checking', 'Renderer-Status wird geprüft.', false)
  }

  const requestId = ++requestCounter

  try {
    const response = await fetch(normalizedHealthUrl.value, {
      cache: 'no-store',
      mode: 'cors',
    })
    if (!response.ok) {
      throw new Error(`Renderer-Health antwortet mit ${response.status}`)
    }

    const payload = (await response.json()) as RemoteRendererHealthPayload
    if (requestId !== requestCounter) {
      return
    }
    applyHealth(payload)
  } catch (error) {
    if (requestId !== requestCounter) {
      return
    }
    const detail = error instanceof Error ? error.message : 'Renderer nicht erreichbar'
    setStatus('remote_unavailable', detail, false)
  } finally {
    if (normalizedBaseUrl.value) {
      pollTimer = window.setTimeout(() => {
        void pollHealth()
      }, effectiveReconnectMs.value)
    }
  }
}

function applyHealth(payload: RemoteRendererHealthPayload) {
  const preferredReady = Boolean(
    payload.preferred_output?.ready ?? payload.preferredOutput?.ready,
  )
  const statusDetail = payload.statusDetail ?? ''
  const lastError = payload.lastError?.trim() ?? ''

  if (preferredReady) {
    outputNonce.value += 1
    const separator = resolvedOutputUrl.value.includes('?') ? '&' : '?'
    outputSrc.value = `${resolvedOutputUrl.value}${separator}rb_remote=${outputNonce.value}`
    setStatus('ready', 'Externer Renderer aktiv.', true)
    return
  }

  if (statusDetail === 'ffmpeg_failed') {
    setStatus('ffmpeg_failed', lastError || 'ffmpeg im Renderer ist nicht bereit.', false)
    return
  }
  if (statusDetail === 'browser_failed') {
    setStatus('browser_failed', lastError || 'Headless-Browser im Renderer ist nicht bereit.', false)
    return
  }
  if (statusDetail === 'display_not_loaded') {
    setStatus('display_not_loaded', lastError || 'Remote-/display ist noch nicht geladen.', false)
    return
  }

  setStatus('hls_not_ready', lastError || 'Renderer läuft, aber der Video-Output ist noch nicht bereit.', false)
}

function handleMediaReady() {
  frameVisible.value = true
}

function handleMediaError() {
  frameVisible.value = false
  setStatus('remote_unavailable', 'Renderer-Output konnte nicht geladen werden.', false)
}

function resetState() {
  window.clearTimeout(pollTimer)
  pollTimer = undefined
  outputSrc.value = ''
  frameVisible.value = false
  requestCounter += 1
}

function setStatus(state: RemoteRendererStatus, detail: string, available: boolean) {
  remoteState.value = state
  remoteDetail.value = detail
  if (!available) {
    frameVisible.value = false
  }
  emit('availability-change', available)
  emit('status-change', { available, state, detail })
}

function normalizePath(pathValue: string | undefined) {
  const normalized = (pathValue ?? '/preview').trim() || '/preview'
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

function joinUrl(base: string, pathValue: string) {
  if (!base) {
    return ''
  }
  if (pathValue.startsWith('http://') || pathValue.startsWith('https://')) {
    return pathValue
  }
  return `${base}${pathValue.startsWith('/') ? pathValue : `/${pathValue}`}`
}
</script>

<template>
  <div class="remote-renderer-player">
    <div class="remote-renderer-player__shell">
      <iframe
        v-if="outputKind === 'preview' && outputSrc"
        :key="outputSrc"
        class="remote-renderer-player__frame"
        :class="{ 'remote-renderer-player__frame--visible': frameVisible }"
        :src="outputSrc"
        title="Remote renderer preview"
        loading="eager"
        referrerpolicy="no-referrer"
        @load="handleMediaReady"
      />

      <video
        v-else-if="outputSrc"
        :key="outputSrc"
        class="remote-renderer-player__video"
        :class="{ 'remote-renderer-player__video--visible': frameVisible }"
        :src="outputSrc"
        autoplay
        muted
        playsinline
        crossorigin="anonymous"
        @loadeddata="handleMediaReady"
        @error="handleMediaError"
      />
    </div>

    <div
      v-if="remoteState !== 'ready'"
      class="remote-renderer-player__status"
      :class="statusClass"
    >
      <div class="remote-renderer-player__brand">RAVEBERG</div>
      <div class="remote-renderer-player__headline">
        {{ remoteState === 'checking' ? 'Externer Renderer wird geprüft' : 'Externer Renderer nicht bereit' }}
      </div>
      <div class="remote-renderer-player__detail">{{ remoteDetail }}</div>
      <div v-if="props.fallback === 'local'" class="remote-renderer-player__fallback-copy">
        Lokaler Display-Renderer bleibt aktiv, bis der externe Renderer bereit ist.
      </div>
    </div>
  </div>
</template>

<style scoped>
.remote-renderer-player {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 18%, rgba(69, 150, 228, 0.22), transparent 32%),
    linear-gradient(180deg, #03060a 0%, #05080e 100%);
}

.remote-renderer-player__shell,
.remote-renderer-player__frame,
.remote-renderer-player__video {
  position: absolute;
  inset: 0;
}

.remote-renderer-player__frame,
.remote-renderer-player__video {
  width: 100%;
  height: 100%;
  border: 0;
  background: #020408;
  opacity: 0;
  transition: opacity 260ms ease;
}

.remote-renderer-player__frame--visible,
.remote-renderer-player__video--visible {
  opacity: 1;
}

.remote-renderer-player__video {
  object-fit: cover;
}

.remote-renderer-player__status {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  gap: 0.9rem;
  padding: 3rem;
  text-align: center;
  background: rgba(3, 6, 10, 0.62);
  backdrop-filter: blur(16px);
}

.remote-renderer-player__status--ready {
  display: none;
}

.remote-renderer-player__brand {
  font-size: 0.92rem;
  letter-spacing: 0.38em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.54);
}

.remote-renderer-player__headline {
  font-size: clamp(1.8rem, 2.8vw, 3.1rem);
  font-weight: 700;
  color: #f6fbff;
}

.remote-renderer-player__detail,
.remote-renderer-player__fallback-copy {
  max-width: 44rem;
  font-size: 1rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.78);
}
</style>
