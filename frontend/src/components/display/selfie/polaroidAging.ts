import { POLAROID_CONFIG } from './polaroidConfig'
import type {
  PolaroidFreshnessProfile,
  PolaroidToneStage,
  RenderablePolaroid,
} from './polaroidTypes'

export interface PolaroidToneState {
  brightness: number
  saturate: number
  contrast: number
  sepia: number
  grayscale: number
  shadowStrength: number
  profile: PolaroidFreshnessProfile
  isTop3: boolean
}

export function getPolaroidTone(stage: PolaroidToneStage) {
  return {
    brightness: POLAROID_CONFIG.aging.brightnessByStage[stage],
    saturate: stage === 'final'
      ? POLAROID_CONFIG.aging.endDesaturation
      : POLAROID_CONFIG.aging.saturateByStage[stage],
    contrast: POLAROID_CONFIG.aging.contrastByStage[stage],
    sepia: POLAROID_CONFIG.aging.sepiaByStage[stage],
    grayscale: POLAROID_CONFIG.aging.grayscaleByStage[stage],
    shadowStrength: POLAROID_CONFIG.aging.shadowStrengthByStage[stage],
    profile: 'fresh-top' as const,
    isTop3: false,
  }
}

export function getFreshnessProfileForRank(rank: number): PolaroidFreshnessProfile {
  if (rank < POLAROID_CONFIG.aging.topColorCount) {
    return 'fresh-top'
  }
  if (rank === POLAROID_CONFIG.aging.topColorCount) {
    return 'aged-soft'
  }
  if (rank === POLAROID_CONFIG.aging.topColorCount + 1) {
    return 'aged-medium'
  }
  return 'aged-deep'
}

export function getRenderablePolaroidTone(
  item: Pick<RenderablePolaroid, 'freshnessRank' | 'toneStage'>,
): PolaroidToneState {
  const profile = getFreshnessProfileForRank(item.freshnessRank)
  const profileTone = POLAROID_CONFIG.aging.freshnessProfiles[profile]
  const lifecycleTone = getPolaroidTone(item.toneStage)

  if (item.freshnessRank < POLAROID_CONFIG.aging.topColorCount) {
    return {
      ...profileTone,
      profile,
      isTop3: true,
    }
  }

  return {
    brightness: Math.min(profileTone.brightness, lifecycleTone.brightness),
    saturate: Math.min(profileTone.saturate, lifecycleTone.saturate),
    contrast: Math.min(profileTone.contrast, lifecycleTone.contrast),
    sepia: Math.max(profileTone.sepia, lifecycleTone.sepia),
    grayscale: Math.max(profileTone.grayscale, lifecycleTone.grayscale),
    shadowStrength: Math.min(profileTone.shadowStrength, lifecycleTone.shadowStrength),
    profile,
    isTop3: false,
  }
}

export function formatImageFilter(tone: PolaroidToneState) {
  return [
    `brightness(${tone.brightness.toFixed(3)})`,
    `saturate(${tone.saturate.toFixed(3)})`,
    `contrast(${tone.contrast.toFixed(3)})`,
    `grayscale(${tone.grayscale.toFixed(3)})`,
    `sepia(${tone.sepia.toFixed(3)})`,
  ].join(' ')
}
