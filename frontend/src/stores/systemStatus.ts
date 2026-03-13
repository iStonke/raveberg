import { ref } from 'vue'
import { defineStore } from 'pinia'

import { fetchHealth, fetchSystemInfo } from '../services/api'

export const useSystemStatusStore = defineStore('systemStatus', () => {
  const health = ref<string>('unknown')
  const environment = ref<string>('development')
  const backendReachable = ref(false)
  const dbReachable = ref(false)
  const uploadCount = ref(0)
  const currentMode = ref<'visualizer' | 'selfie' | 'video' | 'blackout' | 'idle'>('visualizer')
  const moderationMode = ref<'auto_approve' | 'manual_approve'>('auto_approve')
  const displayTarget = ref('Visualizer Renderer')
  const displayLiveConnected = ref(false)
  const displayStateStale = ref(true)
  const slideshowEnabled = ref(true)
  const videoPlaylistEnabled = ref(true)
  const visualizerAutoCycleEnabled = ref(false)
  const rateLimitTriggerCount = ref(0)
  const lastRateLimitAt = ref<string | null>(null)
  const lastCleanupAt = ref<string | null>(null)
  const lastCleanupRemoved = ref(0)
  const lastDisplayHeartbeatAt = ref<string | null>(null)
  const lastDisplayStateSyncAt = ref<string | null>(null)
  const cpuLoadPercent = ref<number | null>(null)
  const memoryUsedBytes = ref<number | null>(null)
  const memoryTotalBytes = ref<number | null>(null)
  const memoryPercent = ref<number | null>(null)
  const cpuTemperatureCelsius = ref<number | null>(null)
  const fanActive = ref<boolean | null>(null)
  const fanRpm = ref<number | null>(null)
  const videoUploadMaxBytes = ref(500 * 1024 * 1024)
  const storage = ref({
    app_data_path: '',
    uploads_path: '',
    display_cache_path: '',
  })
  const appliance = ref({
    event_name: '',
    event_tagline: '',
    display_overlay_enabled: true,
    remote_visualizer_enabled: false,
    remote_visualizer_url: '',
    remote_visualizer_reconnect_ms: 3000,
    remote_visualizer_fallback: 'local' as 'local' | 'none',
    display_render_mode: 'local' as 'local' | 'remote_headless',
    remote_renderer_base_url: '',
    remote_renderer_output_path: '/preview',
    remote_renderer_health_url: '',
    remote_renderer_reconnect_ms: 3000,
    remote_renderer_fallback: 'local' as 'local' | 'notice',
    urls: {
      base_url: '',
      guest_upload_url: '',
      admin_url: '',
      display_url: '',
      kiosk_start_url: '',
    },
    network: {
      appliance_mode: false,
      ap_enabled: false,
      ap_ssid: '',
      ap_address: '',
      local_hostname: '',
    },
    storage: {
      free_bytes: null as number | null,
      total_bytes: null as number | null,
    },
  })

  async function refresh(token: string) {
    const [healthResponse, systemResponse] = await Promise.all([
      fetchHealth(),
      fetchSystemInfo(token),
    ])

    health.value = healthResponse.status
    environment.value = systemResponse.environment
    backendReachable.value = systemResponse.status.backend_reachable
    dbReachable.value = systemResponse.status.db_reachable
    uploadCount.value = systemResponse.status.upload_count
    currentMode.value = systemResponse.status.current_mode
    moderationMode.value = systemResponse.status.moderation_mode
    displayTarget.value = systemResponse.status.display_target
    displayLiveConnected.value = systemResponse.status.display_live_connected
    displayStateStale.value = systemResponse.status.display_state_stale
    slideshowEnabled.value = systemResponse.status.slideshow_enabled
    videoPlaylistEnabled.value = systemResponse.status.video_playlist_enabled
    visualizerAutoCycleEnabled.value = systemResponse.status.visualizer_auto_cycle_enabled
    rateLimitTriggerCount.value = systemResponse.status.rate_limit_trigger_count
    lastRateLimitAt.value = systemResponse.status.last_rate_limit_at
    lastCleanupAt.value = systemResponse.status.last_cleanup_at
    lastCleanupRemoved.value = systemResponse.status.last_cleanup_removed
    lastDisplayHeartbeatAt.value = systemResponse.status.last_display_heartbeat_at
    lastDisplayStateSyncAt.value = systemResponse.status.last_display_state_sync_at
    cpuLoadPercent.value = systemResponse.telemetry.cpu_load_percent
    memoryUsedBytes.value = systemResponse.telemetry.memory_used_bytes
    memoryTotalBytes.value = systemResponse.telemetry.memory_total_bytes
    memoryPercent.value = systemResponse.telemetry.memory_percent
    cpuTemperatureCelsius.value = systemResponse.telemetry.cpu_temperature_celsius
    fanActive.value = systemResponse.telemetry.fan_active
    fanRpm.value = systemResponse.telemetry.fan_rpm
    videoUploadMaxBytes.value = systemResponse.video_upload_max_bytes
    storage.value = systemResponse.storage
    appliance.value = systemResponse.appliance
  }

  return {
    health,
    environment,
    backendReachable,
    dbReachable,
    uploadCount,
    currentMode,
    moderationMode,
    displayTarget,
    displayLiveConnected,
    displayStateStale,
    slideshowEnabled,
    videoPlaylistEnabled,
    visualizerAutoCycleEnabled,
    rateLimitTriggerCount,
    lastRateLimitAt,
    lastCleanupAt,
    lastCleanupRemoved,
    lastDisplayHeartbeatAt,
    lastDisplayStateSyncAt,
    cpuLoadPercent,
    memoryUsedBytes,
    memoryTotalBytes,
    memoryPercent,
    cpuTemperatureCelsius,
    fanActive,
    fanRpm,
    videoUploadMaxBytes,
    storage,
    appliance,
    refresh,
  }
})
