import { computed, ref } from 'vue'

import { defaultVisualizerPresetSequence } from '../constants/visualizerPresets'
import type { VisualizerPreset, VisualizerState } from '../services/api'
import { updateVisualizerPresetOrder } from '../services/api'
import { useAdminAlert } from '../stores/adminAlert'
import { useAuthStore } from '../stores/auth'
import { useVisualizerStore } from '../stores/visualizer'

function buildVisualizerStatePayload(
  state: ReturnType<typeof useVisualizerStore>,
  activePreset: VisualizerPreset,
): Omit<VisualizerState, 'updated_at'> {
  return {
    active_preset: activePreset,
    intensity: state.intensity,
    speed: state.speed,
    brightness: state.brightness,
    color_scheme: state.colorScheme,
    hydra_colorfulness: state.hydraColorfulness,
    hydra_scene_change_rate: state.hydraSceneChangeRate,
    hydra_symmetry_amount: state.hydraSymmetryAmount,
    hydra_feedback_amount: state.hydraFeedbackAmount,
    hydra_quality: state.hydraQuality,
    hydra_audio_reactivity_enabled: state.hydraAudioReactivityEnabled,
    hydra_palette_mode: state.hydraPaletteMode,
    overlay_mode: state.overlayMode,
    auto_cycle_enabled: state.autoCycleEnabled,
    auto_cycle_interval_seconds: state.autoCycleIntervalSeconds,
  }
}

export function useAdminVisualizerPresetSequence() {
  const authStore = useAuthStore()
  const adminAlert = useAdminAlert()
  const visualizerStore = useVisualizerStore()
  const busyActions = ref<Record<string, boolean>>({})

  const orderedPresets = computed(() =>
    visualizerStore.presetSequence.length
      ? [...visualizerStore.presetSequence]
      : [...defaultVisualizerPresetSequence],
  )
  const skippedPresets = computed(() => [...visualizerStore.skippedPresets])

  function setBusy(key: string, next: boolean) {
    if (next) {
      busyActions.value = { ...busyActions.value, [key]: true }
      return
    }

    const updated = { ...busyActions.value }
    delete updated[key]
    busyActions.value = updated
  }

  async function initializeVisualizerSequence() {
    await Promise.all([
      visualizerStore.refresh(),
      visualizerStore.refreshPresetSequence(),
    ])
  }

  async function movePreset(preset: VisualizerPreset, direction: -1 | 1) {
    if (!authStore.token) {
      return
    }

    const presets = [...orderedPresets.value]
    const currentIndex = presets.indexOf(preset)
    const nextIndex = currentIndex + direction
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= presets.length) {
      return
    }

    const key = `visualizer:move:${preset}`
    setBusy(key, true)

    try {
      const nextPresets = [...presets]
      ;[nextPresets[currentIndex], nextPresets[nextIndex]] = [nextPresets[nextIndex], nextPresets[currentIndex]]
      const response = await updateVisualizerPresetOrder(
        nextPresets,
        visualizerStore.skippedPresets,
        authStore.token,
      )
      visualizerStore.applyPresetSequence(response.presets)
      visualizerStore.applySkippedPresets(response.skipped_presets)
    } catch (error) {
      adminAlert.error(
        error instanceof Error ? error.message : 'Visualizer-Reihenfolge konnte nicht gespeichert werden',
      )
    } finally {
      setBusy(key, false)
    }
  }

  async function setActivePreset(preset: VisualizerPreset) {
    if (preset === visualizerStore.activePreset) {
      return
    }

    try {
      await visualizerStore.save(buildVisualizerStatePayload(visualizerStore, preset))
    } catch (error) {
      adminAlert.error(
        error instanceof Error ? error.message : 'Visualizer-Stil konnte nicht aktiviert werden',
      )
    }
  }

  async function toggleSkippedPreset(preset: VisualizerPreset) {
    if (!authStore.token) {
      return
    }

    const isCurrentlySkipped = visualizerStore.skippedPresets.includes(preset)
    const nextSkippedPresets = isCurrentlySkipped
      ? visualizerStore.skippedPresets.filter((entry) => entry !== preset)
      : [...visualizerStore.skippedPresets, preset]

    const key = `visualizer:skip:${preset}`
    setBusy(key, true)

    try {
      const response = await updateVisualizerPresetOrder(
        orderedPresets.value,
        nextSkippedPresets,
        authStore.token,
      )
      visualizerStore.applyPresetSequence(response.presets)
      visualizerStore.applySkippedPresets(response.skipped_presets)
    } catch (error) {
      adminAlert.error(
        error instanceof Error ? error.message : 'Visualizer-Überspringen konnte nicht gespeichert werden',
      )
    } finally {
      setBusy(key, false)
    }
  }

  async function setAutoCycleIntervalMinutes(minutes: number) {
    const normalizedMinutes = Math.max(5, Math.min(30, Math.round(minutes)))

    try {
      await visualizerStore.save({
        ...buildVisualizerStatePayload(visualizerStore, visualizerStore.activePreset),
        auto_cycle_interval_seconds: normalizedMinutes * 60,
      })
    } catch (error) {
      adminAlert.error(
        error instanceof Error ? error.message : 'Visualizer-Intervall konnte nicht gespeichert werden',
      )
    }
  }

  return {
    busyActions,
    orderedPresets,
    skippedPresets,
    initializeVisualizerSequence,
    movePreset,
    setActivePreset,
    toggleSkippedPreset,
    setAutoCycleIntervalMinutes,
  }
}
