import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const DEFAULT_STAGE_WIDTH = 1920
const DEFAULT_STAGE_HEIGHT = 1080

type UseVirtualStageScaleOptions = {
  stageWidth?: number
  stageHeight?: number
  scaleBoost?: number
}

export function useVirtualStageScale(options: UseVirtualStageScaleOptions = {}) {
  const stageWidth = options.stageWidth ?? DEFAULT_STAGE_WIDTH
  const stageHeight = options.stageHeight ?? DEFAULT_STAGE_HEIGHT
  const scaleBoost = options.scaleBoost ?? 1

  const viewportWidth = ref(stageWidth)
  const viewportHeight = ref(stageHeight)

  const stageShellStyle = computed(() => ({
    '--stage-scale': `${Math.min(viewportWidth.value / stageWidth, viewportHeight.value / stageHeight) * scaleBoost}`,
  }))

  function syncViewport() {
    viewportWidth.value = window.innerWidth
    viewportHeight.value = window.innerHeight
  }

  onMounted(() => {
    syncViewport()
    window.addEventListener('resize', syncViewport)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', syncViewport)
  })

  return {
    stageHeight,
    stageShellStyle,
    stageWidth,
  }
}
