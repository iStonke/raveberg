<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, withDefaults } from 'vue'

import type { VisualizerState } from '../../services/api'
import ClassicVisualizerCanvas from './ClassicVisualizerCanvas.vue'
import SwarmCollisionVisualizer from './SwarmCollisionVisualizer.vue'

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

let fadeFrameId = 0

const isSwarmCollision = computed(() => props.visualizer.active_preset === 'swarm_collision')

watch(
  () => props.visualizer.active_preset,
  (nextPreset, previousPreset) => {
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
</script>

<template>
  <div class="visualizer-shell">
    <SwarmCollisionVisualizer
      v-if="isSwarmCollision"
      :visualizer="props.visualizer"
      :event-token="props.eventToken"
    />
    <ClassicVisualizerCanvas
      v-else
      :visualizer="props.visualizer"
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
  width: 100vw;
  height: 100vh;
}

.visualizer-transition {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: rgba(2, 4, 7, 1);
}
</style>
