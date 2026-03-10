import { POLAROID_CONFIG } from './polaroidConfig'
import type { PolaroidToneStage } from './polaroidTypes'

export interface PolaroidToneState {
  brightness: number
  saturate: number
  contrast: number
  sepia: number
  shadowStrength: number
}

export function getPolaroidTone(stage: PolaroidToneStage) {
  return {
    brightness: POLAROID_CONFIG.aging.brightnessByStage[stage],
    saturate: stage === 'final'
      ? POLAROID_CONFIG.aging.endDesaturation
      : POLAROID_CONFIG.aging.saturateByStage[stage],
    contrast: POLAROID_CONFIG.aging.contrastByStage[stage],
    sepia: POLAROID_CONFIG.aging.sepiaByStage[stage],
    shadowStrength: POLAROID_CONFIG.aging.shadowStrengthByStage[stage],
  }
}

export function formatImageFilter(tone: PolaroidToneState) {
  return [
    `brightness(${tone.brightness.toFixed(3)})`,
    `saturate(${tone.saturate.toFixed(3)})`,
    `contrast(${tone.contrast.toFixed(3)})`,
    `sepia(${tone.sepia.toFixed(3)})`,
  ].join(' ')
}
