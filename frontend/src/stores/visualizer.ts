import { ref } from 'vue'
import { defineStore } from 'pinia'

import type {
  ColorScheme,
  HydraPaletteMode,
  HydraQuality,
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
  const activePreset = ref<VisualizerPreset>('warehouse')
  const intensity = ref(65)
  const speed = ref(55)
  const brightness = ref(70)
  const colorScheme = ref<ColorScheme>('acid')
  const hydraColorfulness = ref(78)
  const hydraSceneChangeRate = ref(46)
  const hydraSymmetryAmount = ref(38)
  const hydraFeedbackAmount = ref(24)
  const hydraQuality = ref<HydraQuality>('medium')
  const hydraAudioReactivityEnabled = ref(true)
  const hydraPaletteMode = ref<HydraPaletteMode>('auto')
  const overlayMode = ref<VisualizerState['overlay_mode']>('logo')
  const autoCycleEnabled = ref(false)
  const autoCycleIntervalSeconds = ref(600)
  const updatedAt = ref<string | null>(null)
  const presets = ref<VisualizerOptionsResponse['presets']>([])
  const colorSchemes = ref<VisualizerOptionsResponse['color_schemes']>([])
  const hydraQualities = ref<VisualizerOptionsResponse['hydra_qualities']>([])
  const hydraPaletteModes = ref<VisualizerOptionsResponse['hydra_palette_modes']>([])

  async function refresh() {
    applyState(await fetchVisualizerState())
  }

  async function refreshOptions() {
    const options = await fetchVisualizerOptions()
    presets.value = options.presets
    colorSchemes.value = options.color_schemes
    hydraQualities.value = options.hydra_qualities
    hydraPaletteModes.value = options.hydra_palette_modes
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
    hydraColorfulness.value = state.hydra_colorfulness
    hydraSceneChangeRate.value = state.hydra_scene_change_rate
    hydraSymmetryAmount.value = state.hydra_symmetry_amount
    hydraFeedbackAmount.value = state.hydra_feedback_amount
    hydraQuality.value = state.hydra_quality
    hydraAudioReactivityEnabled.value = state.hydra_audio_reactivity_enabled
    hydraPaletteMode.value = state.hydra_palette_mode
    overlayMode.value = state.overlay_mode
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
    hydraColorfulness,
    hydraSceneChangeRate,
    hydraSymmetryAmount,
    hydraFeedbackAmount,
    hydraQuality,
    hydraAudioReactivityEnabled,
    hydraPaletteMode,
    overlayMode,
    autoCycleEnabled,
    autoCycleIntervalSeconds,
    updatedAt,
    presets,
    colorSchemes,
    hydraQualities,
    hydraPaletteModes,
    refresh,
    refreshOptions,
    save,
    applyState,
  }
})
