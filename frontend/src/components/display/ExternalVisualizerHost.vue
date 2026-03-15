<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { VisualizerState } from '../../services/api'
import {
  createVisualizerRuntime,
  isExternalVisualizerPreset,
  type VisualizerRuntimeController,
} from './visualizer/runtime'

const props = withDefaults(
  defineProps<{
    visualizer: VisualizerState
    eventToken?: number
  }>(),
  {
    eventToken: 0,
  },
)

const emit = defineEmits<{
  'runtime-error': [message: string]
}>()

const hostRef = ref<HTMLDivElement | null>(null)

let runtime: VisualizerRuntimeController | null = null
let resizeObserver: ResizeObserver | null = null
let mountToken = 0
let disposed = false

const runtimeOptions = computed(() => ({
  preset: props.visualizer.active_preset,
  intensity: props.visualizer.intensity,
  speed: props.visualizer.speed,
  brightness: props.visualizer.brightness,
  colorScheme: props.visualizer.color_scheme,
  hydraColorfulness: props.visualizer.hydra_colorfulness,
  hydraSceneChangeRate: props.visualizer.hydra_scene_change_rate,
  hydraSymmetryAmount: props.visualizer.hydra_symmetry_amount,
  hydraFeedbackAmount: props.visualizer.hydra_feedback_amount,
  hydraQuality: props.visualizer.hydra_quality,
  hydraAudioReactivityEnabled: props.visualizer.hydra_audio_reactivity_enabled,
  hydraPaletteMode: props.visualizer.hydra_palette_mode,
}))

onMounted(async () => {
  disposed = false
  await mountRuntime()
})

onBeforeUnmount(() => {
  disposed = true
  mountToken += 1
  resizeObserver?.disconnect()
  resizeObserver = null
  runtime?.destroy()
  runtime = null
})

watch(
  runtimeOptions,
  async (nextOptions, previousOptions) => {
    if (!runtime) {
      return
    }

    if (nextOptions.preset !== previousOptions?.preset) {
      await mountRuntime()
      return
    }

    try {
      await runtime.updateOptions(nextOptions)
    } catch (error) {
      emitRuntimeError(error)
    }
  },
  { deep: true },
)

watch(
  () => props.eventToken,
  (nextToken, previousToken) => {
    if (!runtime || !nextToken || nextToken === previousToken) {
      return
    }
    runtime.triggerEvent('mode_change', { token: nextToken })
  },
)

async function mountRuntime() {
  const currentMountToken = ++mountToken
  resizeObserver?.disconnect()
  resizeObserver = null
  runtime?.destroy()
  runtime = null

  const host = hostRef.value
  if (!host || !isExternalVisualizerPreset(props.visualizer.active_preset)) {
    return
  }

  host.replaceChildren()

  const nextRuntime = createVisualizerRuntime(props.visualizer)
  if (!nextRuntime) {
    return
  }
  nextRuntime.setErrorHandler((error) => emitRuntimeError(error))

  try {
    await nextRuntime.init(host, runtimeOptions.value)
    if (disposed || currentMountToken !== mountToken) {
      nextRuntime.destroy()
      return
    }

    runtime = nextRuntime
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      const width = entry?.contentRect.width ?? host.clientWidth
      const height = entry?.contentRect.height ?? host.clientHeight
      runtime?.resize(width, height)
    })
    resizeObserver.observe(host)
  } catch (error) {
    nextRuntime.destroy()
    emitRuntimeError(error)
  }
}

function emitRuntimeError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Visualizer konnte nicht initialisiert werden'
  runtime?.destroy()
  runtime = null
  emit('runtime-error', message)
}
</script>

<template>
  <div ref="hostRef" class="external-visualizer-host" />
</template>

<style scoped>
.external-visualizer-host {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #000;
  pointer-events: none;
}

.external-visualizer-host::after {
  content: '';
  position: absolute;
  inset: 0;
  background: none;
  pointer-events: none;
}

.external-visualizer-host :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
  display: block;
  pointer-events: none;
}
</style>
