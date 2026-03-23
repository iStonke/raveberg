<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { VisualizerPreset, VisualizerState } from '../../services/api'
import ClassicVisualizerCanvas from './ClassicVisualizerCanvas.vue'
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

const transitionOpacity = ref(0)
const runtimeError = ref('')

let fadeFrameId = 0

const isExternalPreset = computed(
  () => isExternalVisualizerPreset(props.visualizer.active_preset) && !runtimeError.value,
)
const fallbackVisualizer = computed<VisualizerState>(() => ({
  ...props.visualizer,
  active_preset: 'warehouse' as VisualizerPreset,
}))

watch(
  () => props.visualizer.active_preset,
  (nextPreset, previousPreset) => {
    runtimeError.value = ''
    if (previousPreset && nextPreset !== previousPreset) {
      startFade()
    }
  },
)

onBeforeUnmount(() => {
  window.cancelAnimationFrame(fadeFrameId)
})

function startFade() {
  transitionOpacity.value = 0.28
  window.cancelAnimationFrame(fadeFrameId)
  fadeFrameId = window.requestAnimationFrame(stepFade)
}

function stepFade() {
  transitionOpacity.value = Math.max(0, transitionOpacity.value - 0.018)
  if (transitionOpacity.value > 0) {
    fadeFrameId = window.requestAnimationFrame(stepFade)
  }
}

function handleRuntimeError(message: string) {
  runtimeError.value = message
  startFade()
}
</script>

<template>
  <div class="visualizer-shell">
    <ExternalVisualizerHost
      v-if="isExternalPreset"
      :key="props.visualizer.active_preset"
      :visualizer="props.visualizer"
      :event-token="props.eventToken"
      @runtime-error="handleRuntimeError"
    />
    <ClassicVisualizerCanvas
      v-else
      :visualizer="runtimeError ? fallbackVisualizer : props.visualizer"
    />
    <div
      v-if="transitionOpacity > 0.001"
      class="visualizer-transition"
      :style="{ opacity: transitionOpacity }"
    />
  </div>
</template>

<style scoped>
.visualizer-shell {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.visualizer-transition {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: rgba(2, 4, 7, 1);
}
</style>
