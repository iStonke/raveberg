import { ref } from 'vue'
import { defineStore } from 'pinia'

import type {
  ColorScheme,
  VisualizerOptionsResponse,
  VisualizerPreset,
  VisualizerState,
} from '../services/api'
import {
  fetchVisualizerOptions,
  fetchVisualizerState,
  updateVisualizerState,
} from '../services/api'

export const useVisualizerStore = defineStore('visualizer', () => {
  const activePreset = ref<VisualizerPreset>('tunnel')
  const intensity = ref(65)
  const speed = ref(55)
  const brightness = ref(70)
  const colorScheme = ref<ColorScheme>('acid')
  const autoCycleEnabled = ref(false)
  const autoCycleIntervalSeconds = ref(45)
  const updatedAt = ref<string | null>(null)
  const presets = ref<VisualizerOptionsResponse['presets']>([])
  const colorSchemes = ref<VisualizerOptionsResponse['color_schemes']>([])

  async function refresh() {
    applyState(await fetchVisualizerState())
  }

  async function refreshOptions() {
    const options = await fetchVisualizerOptions()
    presets.value = options.presets
    colorSchemes.value = options.color_schemes
  }

  async function save(nextState: Omit<VisualizerState, 'updated_at'>) {
    const token = localStorage.getItem('raveberg-admin-token')
    if (!token) {
      throw new Error('Admin session required')
    }

    applyState(await updateVisualizerState(nextState, token))
  }

  function applyState(state: VisualizerState) {
    activePreset.value = state.active_preset
    intensity.value = state.intensity
    speed.value = state.speed
    brightness.value = state.brightness
    colorScheme.value = state.color_scheme
    autoCycleEnabled.value = state.auto_cycle_enabled
    autoCycleIntervalSeconds.value = state.auto_cycle_interval_seconds
    updatedAt.value = state.updated_at
  }

  return {
    activePreset,
    intensity,
    speed,
    brightness,
    colorScheme,
    autoCycleEnabled,
    autoCycleIntervalSeconds,
    updatedAt,
    presets,
    colorSchemes,
    refresh,
    refreshOptions,
    save,
    applyState,
  }
})
