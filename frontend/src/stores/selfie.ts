import { ref } from 'vue'
import { defineStore } from 'pinia'

import type { SelfieState } from '../services/api'
import { fetchSelfieState, updateSelfieState } from '../services/api'

export const useSelfieStore = defineStore('selfie', () => {
  const slideshowEnabled = ref(true)
  const slideshowIntervalSeconds = ref(6)
  const slideshowShuffle = ref(true)
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
    slideshowShuffle.value = state.slideshow_shuffle
    moderationMode.value = state.moderation_mode
    slideshowUpdatedAt.value = state.slideshow_updated_at
  }

  return {
    slideshowEnabled,
    slideshowIntervalSeconds,
    slideshowShuffle,
    moderationMode,
    slideshowUpdatedAt,
    refresh,
    save,
    applyState,
  }
})
