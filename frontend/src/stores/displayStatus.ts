import { computed } from 'vue'
import { defineStore } from 'pinia'

import { useAppModeStore } from './appMode'

export const useDisplayStatusStore = defineStore('displayStatus', () => {
  const appModeStore = useAppModeStore()

  const rendererLabel = computed(() => {
    if (appModeStore.mode === 'visualizer') return 'Visualizer Renderer'
    if (appModeStore.mode === 'selfie') return 'Selfie Renderer'
    if (appModeStore.mode === 'video') return 'Video Renderer'
    if (appModeStore.mode === 'blackout') return 'Blackout Placeholder'
    return 'Standby Renderer'
  })

  return {
    rendererLabel,
  }
})
