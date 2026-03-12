import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type {
  DisplayRenderMode,
  PublicRuntimeInfoResponse,
  RemoteRendererFallback,
  RemoteVisualizerFallback,
  RuntimeConfig,
} from '../services/api'
import { fetchPublicRuntimeInfo, updateRuntimeConfig } from '../services/api'

export const usePublicRuntimeStore = defineStore('publicRuntime', () => {
  const isLoaded = ref(false)
  const eventName = ref('RAVEBERG')
  const eventTagline = ref('Lokaler Foto- und Visualizer-Feed')
  const displayOverlayEnabled = ref(true)
  const remoteVisualizerEnabled = ref(false)
  const remoteVisualizerUrl = ref('')
  const remoteVisualizerReconnectMs = ref(3000)
  const remoteVisualizerFallback = ref<RemoteVisualizerFallback>('local')
  const displayRenderMode = ref<DisplayRenderMode>('local')
  const remoteRendererBaseUrl = ref('')
  const remoteRendererOutputPath = ref('/preview')
  const remoteRendererHealthUrl = ref('')
  const remoteRendererReconnectMs = ref(3000)
  const remoteRendererFallback = ref<RemoteRendererFallback>('local')
  const moderationMode = ref<'auto_approve' | 'manual_approve'>('auto_approve')
  const uploadMaxBytes = ref(15 * 1024 * 1024)
  const urls = ref({
    base_url: '',
    guest_upload_url: '',
    admin_url: '',
    display_url: '',
    kiosk_start_url: '',
  })
  const network = ref({
    appliance_mode: false,
    ap_enabled: false,
    ap_ssid: '',
    ap_address: '',
    local_hostname: '',
  })

  const uploadMaxMegabytes = computed(() => Math.max(1, Math.round(uploadMaxBytes.value / (1024 * 1024))))

  async function refresh() {
    applyRuntimeInfo(await fetchPublicRuntimeInfo())
    isLoaded.value = true
  }

  async function saveRuntimeConfig(nextConfig: RuntimeConfig) {
    const token = localStorage.getItem('raveberg-admin-token')
    if (!token) {
      throw new Error('Admin session required')
    }

    applyRuntimeConfig(await updateRuntimeConfig(nextConfig, token))
  }

  function applyRuntimeInfo(response: PublicRuntimeInfoResponse) {
    eventName.value = response.event_name
    eventTagline.value = response.event_tagline
    displayOverlayEnabled.value = response.display_overlay_enabled
    remoteVisualizerEnabled.value = response.remote_visualizer_enabled
    remoteVisualizerUrl.value = response.remote_visualizer_url
    remoteVisualizerReconnectMs.value = response.remote_visualizer_reconnect_ms
    remoteVisualizerFallback.value = response.remote_visualizer_fallback
    displayRenderMode.value = response.display_render_mode
    remoteRendererBaseUrl.value = response.remote_renderer_base_url
    remoteRendererOutputPath.value = response.remote_renderer_output_path
    remoteRendererHealthUrl.value = response.remote_renderer_health_url
    remoteRendererReconnectMs.value = response.remote_renderer_reconnect_ms
    remoteRendererFallback.value = response.remote_renderer_fallback
    moderationMode.value = response.moderation_mode
    uploadMaxBytes.value = response.upload_max_bytes
    urls.value = response.urls
    network.value = response.network
  }

  function applyRuntimeConfig(config: RuntimeConfig) {
    remoteVisualizerEnabled.value = config.remote_visualizer_enabled
    remoteVisualizerUrl.value = config.remote_visualizer_url
    remoteVisualizerReconnectMs.value = config.remote_visualizer_reconnect_ms
    remoteVisualizerFallback.value = config.remote_visualizer_fallback
    displayRenderMode.value = config.display_render_mode
    remoteRendererBaseUrl.value = config.remote_renderer_base_url
    remoteRendererOutputPath.value = config.remote_renderer_output_path
    remoteRendererHealthUrl.value = config.remote_renderer_health_url
    remoteRendererReconnectMs.value = config.remote_renderer_reconnect_ms
    remoteRendererFallback.value = config.remote_renderer_fallback
  }

  return {
    isLoaded,
    eventName,
    eventTagline,
    displayOverlayEnabled,
    remoteVisualizerEnabled,
    remoteVisualizerUrl,
    remoteVisualizerReconnectMs,
    remoteVisualizerFallback,
    displayRenderMode,
    remoteRendererBaseUrl,
    remoteRendererOutputPath,
    remoteRendererHealthUrl,
    remoteRendererReconnectMs,
    remoteRendererFallback,
    moderationMode,
    uploadMaxBytes,
    uploadMaxMegabytes,
    urls,
    network,
    refresh,
    saveRuntimeConfig,
    applyRuntimeInfo,
    applyRuntimeConfig,
  }
})
