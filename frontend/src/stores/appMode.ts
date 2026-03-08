import { ref } from 'vue'
import { defineStore } from 'pinia'

import type { AppMode } from '../services/api'
import { fetchMode, updateMode } from '../services/api'

export const useAppModeStore = defineStore('appMode', () => {
  const mode = ref<AppMode>('visualizer')
  const source = ref('backend')
  const updatedAt = ref<string | null>(null)
  const isLoading = ref(false)

  async function refresh() {
    isLoading.value = true
    try {
      const response = await fetchMode()
      mode.value = response.mode
      source.value = response.source
      updatedAt.value = response.updated_at
    } finally {
      isLoading.value = false
    }
  }

  async function setMode(nextMode: AppMode) {
    if (!isModeType(nextMode)) {
      throw new Error('Ungueltiger Moduswert')
    }

    if (nextMode === mode.value) {
      return
    }

    const token = localStorage.getItem('raveberg-admin-token')
    if (!token) {
      throw new Error('Admin session required')
    }

    const response = await updateMode(nextMode, token)
    applyMode(response)
  }

  function applyMode(payload: { mode: AppMode; source: string; updated_at: string | null }) {
    mode.value = payload.mode
    source.value = payload.source
    updatedAt.value = payload.updated_at
  }

  return {
    mode,
    source,
    updatedAt,
    isLoading,
    refresh,
    setMode,
    applyMode,
  }
})

function isModeType(value: unknown): value is AppMode {
  return value === 'visualizer' || value === 'selfie' || value === 'blackout' || value === 'idle'
}
