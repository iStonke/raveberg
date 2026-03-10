import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { fetchPublicRuntimeInfo } from '../services/api'

export const usePublicRuntimeStore = defineStore('publicRuntime', () => {
  const isLoaded = ref(false)
  const eventName = ref('RAVEBERG')
  const eventTagline = ref('Lokaler Foto- und Visualizer-Feed')
  const displayOverlayEnabled = ref(true)
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
    const response = await fetchPublicRuntimeInfo()
    eventName.value = response.event_name
    eventTagline.value = response.event_tagline
    displayOverlayEnabled.value = response.display_overlay_enabled
    moderationMode.value = response.moderation_mode
    uploadMaxBytes.value = response.upload_max_bytes
    urls.value = response.urls
    network.value = response.network
    isLoaded.value = true
  }

  return {
    isLoaded,
    eventName,
    eventTagline,
    displayOverlayEnabled,
    moderationMode,
    uploadMaxBytes,
    uploadMaxMegabytes,
    urls,
    network,
    refresh,
  }
})
