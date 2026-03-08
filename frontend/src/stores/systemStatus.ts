import { ref } from 'vue'
import { defineStore } from 'pinia'

import { fetchHealth, fetchSystemInfo } from '../services/api'

export const useSystemStatusStore = defineStore('systemStatus', () => {
  const health = ref<string>('unknown')
  const environment = ref<string>('development')
  const backendReachable = ref(false)
  const dbReachable = ref(false)
  const uploadCount = ref(0)
  const currentMode = ref<'visualizer' | 'selfie' | 'blackout' | 'idle'>('visualizer')
  const moderationMode = ref<'auto_approve' | 'manual_approve'>('auto_approve')
  const displayTarget = ref('Visualizer Renderer')
  const slideshowEnabled = ref(true)
  const visualizerAutoCycleEnabled = ref(false)
  const rateLimitTriggerCount = ref(0)
  const lastRateLimitAt = ref<string | null>(null)
  const lastCleanupAt = ref<string | null>(null)
  const lastCleanupRemoved = ref(0)
  const lastDisplayHeartbeatAt = ref<string | null>(null)
  const lastDisplayStateSyncAt = ref<string | null>(null)
  const storage = ref({
    app_data_path: '',
    uploads_path: '',
    display_cache_path: '',
  })
  const appliance = ref({
    event_name: '',
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
    slideshowEnabled.value = systemResponse.status.slideshow_enabled
    visualizerAutoCycleEnabled.value = systemResponse.status.visualizer_auto_cycle_enabled
    rateLimitTriggerCount.value = systemResponse.status.rate_limit_trigger_count
    lastRateLimitAt.value = systemResponse.status.last_rate_limit_at
    lastCleanupAt.value = systemResponse.status.last_cleanup_at
    lastCleanupRemoved.value = systemResponse.status.last_cleanup_removed
    lastDisplayHeartbeatAt.value = systemResponse.status.last_display_heartbeat_at
    lastDisplayStateSyncAt.value = systemResponse.status.last_display_state_sync_at
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
    slideshowEnabled,
    visualizerAutoCycleEnabled,
    rateLimitTriggerCount,
    lastRateLimitAt,
    lastCleanupAt,
    lastCleanupRemoved,
    lastDisplayHeartbeatAt,
    lastDisplayStateSyncAt,
    storage,
    appliance,
    refresh,
  }
})
