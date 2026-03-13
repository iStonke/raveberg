import type { HydraQuality, VisualizerPreset } from '../../../services/api'

export type HydraPreset = Extract<VisualizerPreset, 'hydra_rave' | 'hydra_chromaflow'>

export interface HydraQualityProfile {
  maxPixelRatio: number
  targetFrameMs: number
  precision: 'lowp' | 'mediump' | 'highp'
  feedbackCeiling: number
  noiseCeiling: number
}

export const HYDRA_PRESETS = new Set<HydraPreset>(['hydra_rave', 'hydra_chromaflow'])

export const HYDRA_QUALITY_PROFILES: Record<HydraQuality, HydraQualityProfile> = {
  low: {
    maxPixelRatio: 1,
    targetFrameMs: 1000 / 28,
    precision: 'lowp',
    feedbackCeiling: 0.16,
    noiseCeiling: 0.9,
  },
  medium: {
    maxPixelRatio: 1.5,
    targetFrameMs: 1000 / 36,
    precision: 'mediump',
    feedbackCeiling: 0.22,
    noiseCeiling: 1.15,
  },
  high: {
    maxPixelRatio: 2,
    targetFrameMs: 1000 / 48,
    precision: 'highp',
    feedbackCeiling: 0.3,
    noiseCeiling: 1.45,
  },
}

export const HYDRA_CHROMAFLOW_SCENE_CENTERS = {
  liquidWash: 0.08,
  blobFields: 0.34,
  kaleidoBursts: 0.58,
  mirrorFeedback: 0.79,
  colorCut: 0.93,
} as const
