import type { PolaroidEntryMotion, PolaroidLayout, StageSize } from './polaroidTypes'

type SpawnSide = 'left' | 'right' | 'top'

const THROW_MOTION = {
  offscreenMarginPx: 156,
  horizontalVariancePx: 84,
  verticalVariancePx: 72,
  minDurationMs: 450,
  maxDurationMs: 700,
  minScaleMultiplier: 1,
  maxScaleMultiplier: 1,
  minOpacity: 0.88,
  maxOpacity: 0.95,
}

export function buildPolaroidEntryMotion(
  stageSize: StageSize,
  layout: PolaroidLayout,
  motionSeed: number,
): PolaroidEntryMotion {
  const spawnSide = pickSpawnSide(layout, motionSeed)
  const margin = Math.max(layout.width, layout.height) * 0.72 + THROW_MOTION.offscreenMarginPx
  const horizontalVariance = randomBetween(
    -THROW_MOTION.horizontalVariancePx,
    THROW_MOTION.horizontalVariancePx,
    motionSeed + 0.17,
  )
  const verticalVariance = randomBetween(
    -THROW_MOTION.verticalVariancePx,
    THROW_MOTION.verticalVariancePx,
    motionSeed + 0.29,
  )

  let spawnX = layout.x
  let spawnY = layout.y
  let rotationBias = 0

  if (spawnSide === 'left') {
    spawnX = -layout.width - margin
    spawnY = clamp(layout.y + verticalVariance, -layout.height - margin, stageSize.height + layout.height + margin)
    rotationBias = randomBetween(8, 16, motionSeed + 0.41)
  } else if (spawnSide === 'right') {
    spawnX = stageSize.width + layout.width + margin
    spawnY = clamp(layout.y + verticalVariance, -layout.height - margin, stageSize.height + layout.height + margin)
    rotationBias = randomBetween(-16, -8, motionSeed + 0.41)
  } else {
    spawnX = clamp(layout.x + horizontalVariance, -layout.width - margin, stageSize.width + layout.width + margin)
    spawnY = -layout.height - margin
    rotationBias = randomBetween(-11, 11, motionSeed + 0.41)
  }

  const travelDistance = Math.hypot(layout.x - spawnX, layout.y - spawnY)
  const normalizedTravel = clamp(travelDistance / Math.max(stageSize.width, stageSize.height, 1), 0, 1.18)

  return {
    spawnX,
    spawnY,
    spawnRotationDeg: layout.rotation + rotationBias,
    spawnScaleMultiplier: randomBetween(
      THROW_MOTION.minScaleMultiplier,
      THROW_MOTION.maxScaleMultiplier,
      motionSeed + 0.53,
    ),
    spawnOpacity: randomBetween(THROW_MOTION.minOpacity, THROW_MOTION.maxOpacity, motionSeed + 0.67),
    durationMs: Math.round(
      THROW_MOTION.minDurationMs +
        (THROW_MOTION.maxDurationMs - THROW_MOTION.minDurationMs) * normalizedTravel,
    ),
  }
}

function pickSpawnSide(layout: PolaroidLayout, motionSeed: number): SpawnSide {
  if (layout.normalizedY < 0.26) {
    return layout.normalizedX < 0.28
      ? 'left'
      : layout.normalizedX > 0.72
        ? 'right'
        : 'top'
  }

  if (layout.normalizedX < 0.38) {
    return motionSeed > 0.22 ? 'left' : 'top'
  }

  if (layout.normalizedX > 0.62) {
    return motionSeed > 0.22 ? 'right' : 'top'
  }

  return 'top'
}

function randomBetween(min: number, max: number, seed: number) {
  const value = Math.sin(seed * 12_989.341 + 78.233) * 43_758.5453
  const normalized = value - Math.floor(value)
  return min + (max - min) * normalized
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
