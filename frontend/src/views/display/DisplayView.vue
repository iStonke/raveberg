<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { SelfiePlaybackEvent } from '../../services/api'
import { sendDisplayHeartbeat } from '../../services/api'
import { useAppModeStore } from '../../stores/appMode'
import { useSelfieStore } from '../../stores/selfie'
import { useVisualizerStore } from '../../stores/visualizer'
import BlackoutRenderer from '../../components/display/BlackoutRenderer.vue'
import IdleRenderer from '../../components/display/IdleRenderer.vue'
import SelfieRenderer from '../../components/display/SelfieRenderer.vue'
import VisualizerRenderer from '../../components/display/VisualizerRenderer.vue'

const appModeStore = useAppModeStore()
const selfieStore = useSelfieStore()
const visualizerStore = useVisualizerStore()
const uploadRefreshToken = ref(0)
const selfiePlaybackCommand = ref<SelfiePlaybackEvent | null>(null)
const hasInitialState = ref(false)
const connectionState = ref<'connecting' | 'connected' | 'reconnecting'>('connecting')
const reconnectAttempt = ref(0)
const lastStateSyncAt = ref<string | null>(null)

let eventSource: EventSource | null = null
let reconnectTimer: number | undefined
let heartbeatTimer: number | undefined
let disposed = false

const activeRenderer = computed(() => {
  if (!hasInitialState.value) return IdleRenderer
  if (appModeStore.mode === 'selfie') return SelfieRenderer
  if (appModeStore.mode === 'blackout') return BlackoutRenderer
  if (appModeStore.mode === 'idle') return IdleRenderer
  return VisualizerRenderer
})

const rendererProps = computed(() => {
  if (!hasInitialState.value) {
    return {}
  }

  if (appModeStore.mode === 'selfie') {
    return {
      mode: appModeStore.mode,
      refreshToken: uploadRefreshToken.value,
      playbackCommand: selfiePlaybackCommand.value,
      settings: {
        slideshow_enabled: selfieStore.slideshowEnabled,
        slideshow_interval_seconds: selfieStore.slideshowIntervalSeconds,
        slideshow_shuffle: selfieStore.slideshowShuffle,
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
    }
  }

  return {}
})

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

async function loadInitialState() {
  try {
    await Promise.all([appModeStore.refresh(), selfieStore.refresh(), visualizerStore.refresh()])
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
  source.addEventListener('upload_created', (event) => {
    const payload = parseEventPayload(event)
    if (!payload) return
    if (payload.approved) {
      uploadRefreshToken.value += 1
    }
    markStateSync()
  })
  source.addEventListener('upload_approved', () => {
    uploadRefreshToken.value += 1
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
  }, 15000)
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
    <component :is="activeRenderer" v-bind="rendererProps" />
    <div v-if="connectionState !== 'connected'" class="display-connection">
      {{ connectionMessage }}
    </div>
  </div>
</template>

<style scoped>
.display-surface {
  position: relative;
  min-height: 100vh;
  width: 100vw;
  background: #020304;
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
</style>
