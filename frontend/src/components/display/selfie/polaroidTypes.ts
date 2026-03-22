import type { PolaroidTimings } from './polaroidConfig'

export interface StageSize {
  width: number
  height: number
}

export type SlideshowEngineState = 'READY' | 'INSERTING' | 'REMOVING'
export type PolaroidStagePhase = 'build' | 'rotation' | 'steady'

export interface PolaroidLayout {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  scale: number
  anchorId: string
  normalizedX: number
  normalizedY: number
}

export type PolaroidLifecycle =
  | 'pre_enter'
  | 'entering'
  | 'visible_fresh'
  | 'visible_aging'
  | 'fading_out'
  | 'removed'
export type PolaroidToneStage = 'fresh' | 'soft' | 'deep' | 'final'
export type PolaroidFreshnessProfile = 'fresh-top' | 'aged-soft' | 'aged-medium' | 'aged-deep'

export interface PolaroidFlash {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface PolaroidEntryMotion {
  spawnX: number
  spawnY: number
  spawnRotationDeg: number
  spawnScaleMultiplier: number
  spawnOpacity: number
  durationMs: number
}

export interface ActivePolaroid {
  instanceId: string
  uploadId: number
  src: string
  alt: string
  caption: string | null
  enteredAt: number
  entryActivatedAt: number | null
  timings: PolaroidTimings
  order: number
  motionSeed: number
  layout: PolaroidLayout
  entryMotion: PolaroidEntryMotion
  agingElapsedMs: number
  agingResumedAt: number | null
  visibleSince: number | null
  ageStartedAt: number | null
  fadeStartedAt: number | null
  lifecycleStatus: PolaroidLifecycle
  toneStage: PolaroidToneStage
}

export interface RenderablePolaroid extends ActivePolaroid {
  freshnessRank: number
  freshnessProfile: PolaroidFreshnessProfile
  isTopFresh: boolean
}
