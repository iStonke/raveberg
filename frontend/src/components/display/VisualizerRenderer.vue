<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { VisualizerPreset, VisualizerState } from '../../services/api'
import ClassicVisualizerCanvas from './ClassicVisualizerCanvas.vue'
import DisplaySwitchLayer from './DisplaySwitchLayer.vue'
import ExternalVisualizerHost from './ExternalVisualizerHost.vue'
import { isExternalVisualizerPreset } from './visualizer/runtime'

const props = withDefaults(
  defineProps<{
    visualizer: VisualizerState
    eventToken?: number
  }>(),
  {
    eventToken: 0,
  },
)

const CROSSFADE_DURATION_MS = 440

const currentVisualizer = ref<VisualizerState>(cloneVisualizer(props.visualizer))
const previousVisualizer = ref<VisualizerState | null>(null)
const currentRuntimeError = ref('')
const previousRuntimeError = ref('')
const currentLayerActive = ref(true)
const previousLayerActive = ref(false)
const currentLayerKey = ref(0)
const previousLayerKey = ref(0)

let crossfadeTimer: number | undefined
let crossfadeFrameId = 0

const resolvedCurrentVisualizer = computed(() =>
  resolveVisualizer(currentVisualizer.value, currentRuntimeError.value),
)
const resolvedPreviousVisualizer = computed(() =>
  previousVisualizer.value
    ? resolveVisualizer(previousVisualizer.value, previousRuntimeError.value)
    : null,
)
const isCurrentExternalPreset = computed(
  () => isExternalVisualizerPreset(resolvedCurrentVisualizer.value.active_preset) && !currentRuntimeError.value,
)
const isPreviousExternalPreset = computed(
  () =>
    !!resolvedPreviousVisualizer.value &&
    isExternalVisualizerPreset(resolvedPreviousVisualizer.value.active_preset) &&
    !previousRuntimeError.value,
)

watch(
  () => props.visualizer,
  (nextVisualizer, previousVisualizerState) => {
    if (!previousVisualizerState) {
      currentVisualizer.value = cloneVisualizer(nextVisualizer)
      currentRuntimeError.value = ''
      return
    }

    if (nextVisualizer.active_preset !== previousVisualizerState.active_preset) {
      previousVisualizer.value = cloneVisualizer(currentVisualizer.value)
      previousRuntimeError.value = currentRuntimeError.value
      previousLayerKey.value += 1
      currentVisualizer.value = cloneVisualizer(nextVisualizer)
      currentRuntimeError.value = ''
      currentLayerKey.value += 1
      startCrossfade()
      return
    }

    currentVisualizer.value = cloneVisualizer(nextVisualizer)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  window.cancelAnimationFrame(crossfadeFrameId)
  if (crossfadeTimer) {
    window.clearTimeout(crossfadeTimer)
  }
})

function cloneVisualizer(visualizer: VisualizerState): VisualizerState {
  return { ...visualizer }
}

function resolveVisualizer(visualizer: VisualizerState, runtimeError: string): VisualizerState {
  if (!runtimeError) {
    return visualizer
  }

  return {
    ...visualizer,
    active_preset: 'warehouse' as VisualizerPreset,
  }
}

function startCrossfade() {
  previousLayerActive.value = true
  currentLayerActive.value = false
  if (crossfadeTimer) {
    window.clearTimeout(crossfadeTimer)
  }
  window.cancelAnimationFrame(crossfadeFrameId)
  crossfadeFrameId = window.requestAnimationFrame(() => {
    crossfadeFrameId = window.requestAnimationFrame(() => {
      previousLayerActive.value = false
      currentLayerActive.value = true
    })
  })
  crossfadeTimer = window.setTimeout(() => {
    previousVisualizer.value = null
    previousRuntimeError.value = ''
    previousLayerActive.value = false
    crossfadeTimer = undefined
  }, CROSSFADE_DURATION_MS + 40)
}

function handleCurrentRuntimeError(message: string) {
  currentRuntimeError.value = message
  currentLayerKey.value += 1
}

function handlePreviousRuntimeError(message: string) {
  previousRuntimeError.value = message
  previousLayerKey.value += 1
}
</script>

<template>
  <div class="visualizer-shell">
    <DisplaySwitchLayer
      v-if="resolvedPreviousVisualizer"
      :active="previousLayerActive"
      :visible="!!resolvedPreviousVisualizer"
      :duration-ms="CROSSFADE_DURATION_MS"
      :z-index="1"
    >
      <ExternalVisualizerHost
        v-if="isPreviousExternalPreset"
        :key="`previous:${previousLayerKey}:${resolvedPreviousVisualizer.active_preset}`"
        :visualizer="resolvedPreviousVisualizer"
        @runtime-error="handlePreviousRuntimeError"
      />
      <ClassicVisualizerCanvas
        v-else
        :key="`previous:fallback:${previousLayerKey}:${resolvedPreviousVisualizer.active_preset}`"
        :visualizer="resolvedPreviousVisualizer"
      />
    </DisplaySwitchLayer>

    <DisplaySwitchLayer
      :active="currentLayerActive"
      :duration-ms="CROSSFADE_DURATION_MS"
      :z-index="2"
    >
      <ExternalVisualizerHost
        v-if="isCurrentExternalPreset"
        :key="`current:${currentLayerKey}:${resolvedCurrentVisualizer.active_preset}`"
        :visualizer="resolvedCurrentVisualizer"
        :event-token="props.eventToken"
        @runtime-error="handleCurrentRuntimeError"
      />
      <ClassicVisualizerCanvas
        v-else
        :key="`current:fallback:${currentLayerKey}:${resolvedCurrentVisualizer.active_preset}`"
        :visualizer="resolvedCurrentVisualizer"
      />
    </DisplaySwitchLayer>
  </div>
</template>

<style scoped>
.visualizer-shell {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
