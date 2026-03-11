<script setup lang="ts">
import { computed, onBeforeUnmount, onErrorCaptured, onMounted, ref, watch } from 'vue'

import type { SelfiePlaybackEvent } from '../../services/api'
import { sendDisplayHeartbeat } from '../../services/api'
import DisplayOverlay from '../../components/display/DisplayOverlay.vue'
import { useAppModeStore } from '../../stores/appMode'
import { usePublicRuntimeStore } from '../../stores/publicRuntime'
import { useSelfieStore } from '../../stores/selfie'
import { useStandbyStore } from '../../stores/standby'
import { useVideoStore } from '../../stores/video'
import { useVisualizerStore } from '../../stores/visualizer'
import BlackoutRenderer from '../../components/display/BlackoutRenderer.vue'
import IdleRenderer from '../../components/display/IdleRenderer.vue'
import SelfieRenderer from '../../components/display/SelfieRenderer.vue'
import StandbyRenderer from '../../components/display/StandbyRenderer.vue'
import VideoRenderer from '../../components/display/VideoRenderer.vue'
import VisualizerRenderer from '../../components/display/VisualizerRenderer.vue'

const appModeStore = useAppModeStore()
const publicRuntimeStore = usePublicRuntimeStore()
const selfieStore = useSelfieStore()
const standbyStore = useStandbyStore()
const videoStore = useVideoStore()
const visualizerStore = useVisualizerStore()
const uploadRefreshToken = ref(0)
const idleReactionToken = ref(0)
const visualizerReactionToken = ref(0)
const selfiePlaybackCommand = ref<SelfiePlaybackEvent | null>(null)
const hasInitialState = ref(false)
const connectionState = ref<'connecting' | 'connected' | 'reconnecting'>('connecting')
const reconnectAttempt = ref(0)
const lastStateSyncAt = ref<string | null>(null)
const rendererCrashMessage = ref('')

let eventSource: EventSource | null = null
let reconnectTimer: number | undefined
let heartbeatTimer: number | undefined
let disposed = false

const heartbeatIntervalMs = Math.max(
  5,
  Number(import.meta.env.VITE_DISPLAY_HEARTBEAT_INTERVAL_SECONDS ?? '15'),
) * 1000

const activeRenderer = computed(() => {
  if (!hasInitialState.value) return StandbyRenderer
  if (appModeStore.mode === 'selfie') return SelfieRenderer
  if (appModeStore.mode === 'video') return VideoRenderer
  if (appModeStore.mode === 'blackout') return BlackoutRenderer
  if (appModeStore.mode === 'idle') return StandbyRenderer
  return VisualizerRenderer
})

const activeRendererKey = computed(() => {
  if (!hasInitialState.value) {
    return 'standby:boot'
  }
  return `mode:${appModeStore.mode}`
})

const rendererProps = computed(() => {
  if (!hasInitialState.value) {
    return {}
  }

  if (appModeStore.mode === 'selfie') {
    return {
      mode: appModeStore.mode,
      refreshToken: uploadRefreshToken.value,
      standbyReactionToken: idleReactionToken.value,
      playbackCommand: selfiePlaybackCommand.value,
      settings: {
        slideshow_enabled: selfieStore.slideshowEnabled,
        slideshow_interval_seconds: selfieStore.slideshowIntervalSeconds,
        slideshow_max_visible_photos: selfieStore.slideshowMaxVisiblePhotos,
        slideshow_min_uploads_to_start: selfieStore.slideshowMinUploadsToStart,
        slideshow_shuffle: selfieStore.slideshowShuffle,
        vintage_look_enabled: selfieStore.vintageLookEnabled,
        moderation_mode: selfieStore.moderationMode,
        slideshow_updated_at: selfieStore.slideshowUpdatedAt,
      },
    }
  }

  if (appModeStore.mode === 'visualizer') {
    return {
      visualizer: {
        active_preset: visualizerStore.activePreset,
        intensity: visualizerStore.intensity,
        speed: visualizerStore.speed,
        brightness: visualizerStore.brightness,
        color_scheme: visualizerStore.colorScheme,
        auto_cycle_enabled: visualizerStore.autoCycleEnabled,
        auto_cycle_interval_seconds: visualizerStore.autoCycleIntervalSeconds,
        updated_at: visualizerStore.updatedAt,
      },
      eventToken: visualizerReactionToken.value,
    }
  }

  if (appModeStore.mode === 'video') {
    return {
      settings: {
        playlist_enabled: videoStore.playlistEnabled,
        loop_enabled: videoStore.loopEnabled,
        playback_order: videoStore.playbackOrder,
        vintage_filter_enabled: videoStore.vintageFilterEnabled,
        object_fit: videoStore.objectFit,
        transition: videoStore.transition,
        active_video_id: videoStore.activeVideoId,
        updated_at: videoStore.updatedAt,
      },
      assets: videoStore.assets,
    }
  }

  if (appModeStore.mode === 'idle') {
    return {
      reactionToken: idleReactionToken.value,
      headline: standbyStore.headline,
      subheadline: standbyStore.subheadline,
      hueShiftDegrees: standbyStore.hueShiftDegrees,
    }
  }

  return {}
})

const showDisplayOverlay = computed(
  () => {
    if (
      !publicRuntimeStore.displayOverlayEnabled ||
      !hasInitialState.value ||
      rendererCrashMessage.value
    ) {
      return false
    }
    if (appModeStore.mode === 'visualizer') {
      return visualizerStore.logoOverlayEnabled
    }
    if (appModeStore.mode === 'selfie') {
      return selfieStore.logoOverlayEnabled
    }
    if (appModeStore.mode === 'video') {
      return videoStore.logoOverlayEnabled
    }
    return false
  },
)

const connectionMessage = computed(() => {
  if (connectionState.value === 'connected') {
    return ''
  }
  if (connectionState.value === 'reconnecting') {
    return `Live-Verbindung wird wiederhergestellt (${reconnectAttempt.value}).`
  }
  return 'Display verbindet sich mit dem lokalen RAVEBERG-Stack.'
})

onMounted(async () => {
  disposed = false
  await loadInitialState()
  startHeartbeatLoop()
  connectEvents()
})

onBeforeUnmount(() => {
  disposed = true
  void postHeartbeat(false)
  closeEventSource()
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = undefined
  }
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer)
    heartbeatTimer = undefined
  }
})

watch(
  () => appModeStore.mode,
  () => {
    rendererCrashMessage.value = ''
  },
)

onErrorCaptured((error) => {
  rendererCrashMessage.value =
    error instanceof Error ? error.message : 'Display-Renderer konnte nicht gestartet werden'
  return false
})

async function loadInitialState() {
  try {
    await Promise.all([
      appModeStore.refresh(),
      selfieStore.refresh(),
      standbyStore.refresh(),
      videoStore.refreshState(),
      videoStore.refreshPublicLibrary(),
      visualizerStore.refresh(),
    ])
    if (!publicRuntimeStore.isLoaded) {
      void publicRuntimeStore.refresh().catch(() => {
        // Overlay branding is optional; renderer state should still boot without it.
      })
    }
    hasInitialState.value = true
    markStateSync()
  } catch {
    hasInitialState.value = false
  }
}

function connectEvents() {
  closeEventSource()
  connectionState.value = reconnectAttempt.value > 0 ? 'reconnecting' : 'connecting'
  const source = new EventSource('/api/events/stream')
  eventSource = source

  source.onopen = async () => {
    reconnectAttempt.value = 0
    connectionState.value = 'connected'
    if (!hasInitialState.value) {
      await loadInitialState()
    }
    await postHeartbeat(true)
  }

  source.onerror = () => {
    if (disposed) {
      return
    }
    scheduleReconnect()
  }

  source.addEventListener('mode_snapshot', (event) => {
    hasInitialState.value = true
    appModeStore.applyMode(JSON.parse((event as MessageEvent).data))
    markStateSync()
  })
  source.addEventListener('mode_changed', (event) => {
    const payload = parseEventPayload(event)
    if (!payload) return
    appModeStore.applyMode(payload)
    markStateSync()
  })
  source.addEventListener('selfie_snapshot', (event) => {
    hasInitialState.value = true
    const payload = parseEventPayload(event)
    if (!payload) return
    selfieStore.applyState(payload)
    markStateSync()
  })
  source.addEventListener('standby_snapshot', (event) => {
    hasInitialState.value = true
    const payload = parseEventPayload(event)
    if (!payload) return
    standbyStore.applyState(payload)
    markStateSync()
  })
  source.addEventListener('standby_settings_updated', (event) => {
    const payload = parseEventPayload(event)
    if (!payload) return
    standbyStore.applyState(payload)
    markStateSync()
  })
  source.addEventListener('selfie_settings_updated', (event) => {
    const payload = parseEventPayload(event)
    if (!payload) return
    selfieStore.applyState(payload)
    markStateSync()
  })
  source.addEventListener('selfie_playback_updated', (event) => {
    const payload = parseEventPayload(event)
    if (!payload) return
    selfiePlaybackCommand.value = payload as SelfiePlaybackEvent
    markStateSync()
  })
  source.addEventListener('video_snapshot', (event) => {
    hasInitialState.value = true
    const payload = parseEventPayload(event)
    if (!payload) return
    videoStore.applyState(payload)
    markStateSync()
  })
  source.addEventListener('video_settings_updated', (event) => {
    const payload = parseEventPayload(event)
    if (!payload) return
    videoStore.applyState(payload)
    markStateSync()
  })
  source.addEventListener('video_library_snapshot', (event) => {
    hasInitialState.value = true
    const payload = parseEventPayload(event)
    if (!payload || !Array.isArray(payload)) return
    videoStore.applyLibrary(payload)
    markStateSync()
  })
  source.addEventListener('video_library_updated', (event) => {
    const payload = parseEventPayload(event)
    if (!payload || !Array.isArray(payload)) return
    videoStore.applyLibrary(payload)
    markStateSync()
  })
  source.addEventListener('upload_created', (event) => {
    const payload = parseEventPayload(event)
    if (!payload) return
    if (payload.approved) {
      uploadRefreshToken.value += 1
      idleReactionToken.value += 1
      visualizerReactionToken.value += 1
    }
    markStateSync()
  })
  source.addEventListener('upload_approved', () => {
    uploadRefreshToken.value += 1
    idleReactionToken.value += 1
    visualizerReactionToken.value += 1
    markStateSync()
  })
  source.addEventListener('upload_rejected', () => {
    uploadRefreshToken.value += 1
    markStateSync()
  })
  source.addEventListener('upload_deleted', () => {
    uploadRefreshToken.value += 1
    markStateSync()
  })
  source.addEventListener('visualizer_snapshot', (event) => {
    hasInitialState.value = true
    const payload = parseEventPayload(event)
    if (!payload) return
    visualizerStore.applyState(payload)
    markStateSync()
  })
  source.addEventListener('visualizer_updated', (event) => {
    const payload = parseEventPayload(event)
    if (!payload) return
    visualizerStore.applyState(payload)
    markStateSync()
  })
  source.addEventListener('visualizer_preset_changed', (event) => {
    const payload = parseEventPayload(event)
    if (!payload) return
    visualizerStore.applyState(payload)
    markStateSync()
  })
  source.addEventListener('visualizer_auto_cycle_updated', (event) => {
    const payload = parseEventPayload(event)
    if (!payload) return
    visualizerStore.applyState(payload)
    markStateSync()
  })
}

function scheduleReconnect() {
  closeEventSource()
  if (reconnectTimer) {
    return
  }

  reconnectAttempt.value += 1
  connectionState.value = 'reconnecting'
  const delay = Math.min(1000 * 2 ** Math.min(reconnectAttempt.value - 1, 3), 8000)
  reconnectTimer = window.setTimeout(async () => {
    reconnectTimer = undefined
    if (disposed) {
      return
    }
    await loadInitialState()
    connectEvents()
  }, delay)
}

function startHeartbeatLoop() {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer)
  }
  heartbeatTimer = window.setInterval(() => {
    void postHeartbeat(connectionState.value === 'connected')
  }, heartbeatIntervalMs)
}

function closeEventSource() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

function parseEventPayload(event: Event) {
  try {
    return JSON.parse((event as MessageEvent).data)
  } catch {
    return null
  }
}

function markStateSync() {
  lastStateSyncAt.value = new Date().toISOString()
  void postHeartbeat(connectionState.value === 'connected')
}

function currentRendererLabel() {
  if (!hasInitialState.value) return 'Idle Renderer'
  if (appModeStore.mode === 'selfie') return 'Selfie Renderer'
  if (appModeStore.mode === 'video') return 'Video Renderer'
  if (appModeStore.mode === 'blackout') return 'Blackout Renderer'
  if (appModeStore.mode === 'idle') return 'Idle Renderer'
  return 'Visualizer Renderer'
}

async function postHeartbeat(isConnected: boolean) {
  try {
    await sendDisplayHeartbeat({
      current_mode: hasInitialState.value ? appModeStore.mode : 'idle',
      renderer_label: currentRendererLabel(),
      sse_connected: isConnected,
      last_state_sync_at: lastStateSyncAt.value,
    })
  } catch {
    // Keep the display calm during transient backend outages.
  }
}
</script>

<template>
  <div class="display-surface">
    <div v-if="rendererCrashMessage" class="display-safe-fallback">
      <div class="display-safe-panel">
        <div class="display-safe-title">RAVEBERG</div>
        <div class="display-safe-copy">Display wird stabilisiert.</div>
      </div>
    </div>
    <div v-else class="display-renderer-stage">
      <Transition name="display-renderer">
        <component
          :is="activeRenderer"
          :key="activeRendererKey"
          v-bind="rendererProps"
          class="display-renderer-layer"
        />
      </Transition>
    </div>
    <Transition name="display-overlay-fade">
      <DisplayOverlay v-if="showDisplayOverlay" />
    </Transition>
    <div v-if="connectionState !== 'connected'" class="display-connection">
      {{ connectionMessage }}
    </div>
  </div>
</template>

<style scoped>
.display-surface {
  position: relative;
  width: 100vw;
  height: 100dvh;
  min-height: 100dvh;
  overflow: hidden;
  background: #020304;
}

.display-renderer-stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.display-renderer-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.display-renderer-enter-active,
.display-renderer-leave-active {
  transition:
    opacity 460ms cubic-bezier(0.22, 0.61, 0.36, 1),
    transform 560ms cubic-bezier(0.22, 0.61, 0.36, 1),
    filter 560ms cubic-bezier(0.22, 0.61, 0.36, 1);
  will-change: opacity, transform, filter;
}

.display-renderer-enter-from,
.display-renderer-leave-to {
  opacity: 0;
  transform: scale(1.018);
  filter: blur(16px) saturate(1.06) brightness(1.03);
}

.display-renderer-enter-to,
.display-renderer-leave-from {
  opacity: 1;
  transform: scale(1);
  filter: blur(0) saturate(1);
}

.display-safe-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 50% 28%, rgba(52, 128, 194, 0.16), transparent 32%),
    linear-gradient(180deg, #060b12 0%, #030507 100%);
}

.display-safe-panel {
  display: grid;
  gap: 0.45rem;
  padding: 1.5rem 1.8rem;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(10, 16, 24, 0.52);
  color: rgba(255, 255, 255, 0.92);
  text-align: center;
  backdrop-filter: blur(18px);
}

.display-safe-title {
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.display-safe-copy {
  font-size: 0.98rem;
  color: rgba(226, 235, 245, 0.74);
}

.display-connection {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  padding: 0.45rem 0.75rem;
  border-radius: 999px;
  background: rgba(5, 9, 14, 0.78);
  color: rgba(255, 255, 255, 0.74);
  font-size: 0.78rem;
  letter-spacing: 0.02em;
  backdrop-filter: blur(10px);
}

.display-overlay-fade-enter-active,
.display-overlay-fade-leave-active {
  transition:
    opacity 320ms cubic-bezier(0.22, 0.61, 0.36, 1),
    transform 360ms cubic-bezier(0.22, 0.61, 0.36, 1),
    filter 360ms cubic-bezier(0.22, 0.61, 0.36, 1);
  will-change: opacity, transform, filter;
}

.display-overlay-fade-enter-from,
.display-overlay-fade-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.985);
  filter: blur(10px);
}

.display-overlay-fade-enter-to,
.display-overlay-fade-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}
</style>
