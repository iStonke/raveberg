import type { PolaroidTimings } from './polaroidConfig'

export interface StageSize {
  width: number
  height: number
}

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

export type PolaroidLifecycle = 'pre_enter' | 'entering' | 'active' | 'aging' | 'exiting' | 'removed'
export type PolaroidToneStage = 'fresh' | 'soft' | 'deep' | 'final'

export interface PolaroidFlash {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface ActivePolaroid {
  instanceId: string
  uploadId: number
  src: string
  alt: string
  enteredAt: number
  entryActivatedAt: number | null
  timings: PolaroidTimings
  order: number
  motionSeed: number
  layout: PolaroidLayout
  lifecycleStatus: PolaroidLifecycle
  toneStage: PolaroidToneStage
}
