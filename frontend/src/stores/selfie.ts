import { ref } from 'vue'
import { defineStore } from 'pinia'

import type { SelfieState } from '../services/api'
import { fetchSelfieState, updateSelfieState } from '../services/api'

export const useSelfieStore = defineStore('selfie', () => {
  const slideshowEnabled = ref(true)
  const slideshowIntervalSeconds = ref(6)
  const slideshowMaxVisiblePhotos = ref(4)
  const slideshowMinUploadsToStart = ref(3)
  const slideshowShuffle = ref(true)
  const overlayMode = ref<SelfieState['overlay_mode']>('logo')
  const vintageLookEnabled = ref(false)
  const moderationMode = ref<SelfieState['moderation_mode']>('auto_approve')
  const slideshowUpdatedAt = ref<string | null>(null)

  async function refresh() {
    applyState(await fetchSelfieState())
  }

  async function save(nextState: Omit<SelfieState, 'slideshow_updated_at'>) {
    const token = localStorage.getItem('raveberg-admin-token')
    if (!token) {
      throw new Error('Admin session required')
    }

    applyState(await updateSelfieState(nextState, token))
  }

  function applyState(state: SelfieState) {
    slideshowEnabled.value = state.slideshow_enabled
    slideshowIntervalSeconds.value = state.slideshow_interval_seconds
    slideshowMaxVisiblePhotos.value = state.slideshow_max_visible_photos
    slideshowMinUploadsToStart.value = state.slideshow_min_uploads_to_start
    slideshowShuffle.value = state.slideshow_shuffle
    overlayMode.value = state.overlay_mode
    vintageLookEnabled.value = state.vintage_look_enabled
    moderationMode.value = state.moderation_mode
    slideshowUpdatedAt.value = state.slideshow_updated_at
  }

  return {
    slideshowEnabled,
    slideshowIntervalSeconds,
    slideshowMaxVisiblePhotos,
    slideshowMinUploadsToStart,
    slideshowShuffle,
    overlayMode,
    vintageLookEnabled,
    moderationMode,
    slideshowUpdatedAt,
    refresh,
    save,
    applyState,
  }
})
