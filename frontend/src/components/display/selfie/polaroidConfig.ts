export const POLAROID_CONFIG = {
  spawnIntervalSeconds: {
    min: 2,
    max: 20,
    default: 6,
  },
  visiblePhotos: {
    min: 1,
    max: 10,
    default: 4,
  },
  rotation: {
    min: -8,
    max: 8,
  },
  scale: {
    min: 1,
    max: 1,
  },
  timing: {
    spawnDelayAfterExitStartMs: 132,
    entryRetryDelayMs: 180,
    entryDurationMs: 820,
    developmentDurationMs: 1_050,
    flashDurationMs: 980,
    minTargetLifetimeMs: 1_900,
    maxLifetimeMs: 150_000,
    visibleShare: 0.4,
    exitShare: 0.2,
    preExitLeadShare: 0.3,
    minVisibleDurationMs: 900,
    maxVisibleDurationMs: 56_000,
    minAgingDurationMs: 720,
    minExitDurationMs: 1_200,
    maxExitDurationMs: 4_600,
    minPreExitLeadTimeMs: 180,
    maxPreExitLeadTimeMs: 1_400,
    minRotationWindowMs: 1_500,
    minExitAgingLeadMs: 1_800,
    freezeTimeoutMs: 6_500,
    freezeCheckIntervalMs: 2_000,
  },
  aging: {
    startDelayShare: 0.34,
    deepPhaseStartShare: 0.52,
    finalPhaseStartShare: 0.84,
    freshnessTransitionMs: 920,
    topColorCount: 3,
    endDesaturation: 0.06,
    grayscaleByStage: {
      fresh: 0,
      soft: 0.04,
      deep: 0.09,
      final: 0.14,
    },
    saturateByStage: {
      fresh: 1.04,
      soft: 0.72,
      deep: 0.38,
      final: 0.06,
    },
    brightnessByStage: {
      fresh: 1,
      soft: 0.97,
      deep: 0.92,
      final: 0.86,
    },
    contrastByStage: {
      fresh: 1,
      soft: 0.97,
      deep: 0.93,
      final: 0.89,
    },
    sepiaByStage: {
      fresh: 0,
      soft: 0.004,
      deep: 0.014,
      final: 0.028,
    },
    shadowStrengthByStage: {
      fresh: 1,
      soft: 0.86,
      deep: 0.72,
      final: 0.58,
    },
    freshnessProfiles: {
      'fresh-top': {
        saturate: 1,
        contrast: 1.015,
        brightness: 1.01,
        grayscale: 0,
        sepia: 0,
        shadowStrength: 1.05,
      },
      'aged-soft': {
        saturate: 0.75,
        contrast: 0.96,
        brightness: 0.98,
        grayscale: 0.1,
        sepia: 0.008,
        shadowStrength: 0.9,
      },
      'aged-medium': {
        saturate: 0.45,
        contrast: 0.93,
        brightness: 0.96,
        grayscale: 0.28,
        sepia: 0.014,
        shadowStrength: 0.82,
      },
      'aged-deep': {
        saturate: 0.12,
        contrast: 0.9,
        brightness: 0.94,
        grayscale: 0.62,
        sepia: 0.02,
        shadowStrength: 0.74,
      },
    },
  },
  flash: {
    overlayPeakOpacity: 0.78,
    overlaySecondaryOpacity: 0.34,
    radiusPx: 240,
    secondaryRadiusPx: 360,
  },
  clouds: {
    cloudOpacity: 0.82,
    cloudDriftDistanceX: 44,
    cloudDriftDistanceY: 12,
    cloudAnimationDurationMs: 78_000,
    numberOfCloudLayers: 3,
    layers: [
      {
        id: 'mist-a',
        top: '6%',
        left: '-14%',
        width: '62%',
        height: '40%',
        opacity: 0.1,
        driftX: 44,
        driftY: 12,
        durationMs: 72_000,
        delayMs: -18_000,
        background:
          'radial-gradient(circle at 36% 40%, rgba(93, 116, 150, 0.26), rgba(93, 116, 150, 0.12) 34%, rgba(35, 42, 58, 0.02) 74%, transparent 100%), radial-gradient(circle at 68% 52%, rgba(180, 126, 89, 0.14), transparent 62%)',
      },
      {
        id: 'mist-b',
        top: '30%',
        left: '18%',
        width: '58%',
        height: '36%',
        opacity: 0.075,
        driftX: -36,
        driftY: 14,
        durationMs: 86_000,
        delayMs: -31_000,
        background:
          'radial-gradient(circle at 50% 46%, rgba(121, 145, 168, 0.18), rgba(121, 145, 168, 0.08) 36%, rgba(24, 29, 40, 0.02) 72%, transparent 100%), radial-gradient(circle at 26% 58%, rgba(70, 88, 118, 0.18), transparent 58%)',
      },
      {
        id: 'mist-c',
        top: '54%',
        left: '46%',
        width: '54%',
        height: '34%',
        opacity: 0.06,
        driftX: 28,
        driftY: -10,
        durationMs: 96_000,
        delayMs: -42_000,
        background:
          'radial-gradient(circle at 44% 48%, rgba(78, 98, 126, 0.2), rgba(78, 98, 126, 0.07) 38%, rgba(18, 22, 30, 0.02) 72%, transparent 100%), radial-gradient(circle at 70% 38%, rgba(162, 118, 92, 0.1), transparent 60%)',
      },
    ],
  },
  debug: {
    logInsertTimings: false,
    logCapacityDecisions: false,
    logAgingDecisions: false,
    logSchedulerDecisions: true,
    showCloudLayerBounds: false,
    disableFlash: false,
    disableAgingDuringInsert: false,
    simplifiedEntry: true,
  },
  zonePadding: {
    top: 0.018,
    right: 0.022,
    bottom: 0.04,
    left: 0.022,
  },
  item: {
    minWidthPx: 220,
    maxWidthPx: 362,
    widthFactor: 0.224,
    compactWidthFactor: 0.282,
    heightLimitFactor: 0.395,
    footerHeightRatio: 72 / 296,
    aspectRatio: 296 / 240,
  },
  layout: {
    candidateAttemptsPerZone: 36,
    freeformCandidateCount: 96,
    candidateSelectionPoolSize: 18,
    candidateSelectionScoreWindow: 110,
    minCenterDistanceFactor: 0.98,
    preferredDistanceFactor: 1.42,
    overlapTolerance: 0.14,
    anchorReusePenalty: 64,
    sameBandPenalty: 6,
    sameRegionPenalty: 22,
  },
  stageCapacity: {
    sampleColumns: 28,
    sampleRows: 18,
    exitRetryDelayMs: 420,
    minBuildCount: 4,
    minStableVisibleCount: 6,
    rotationStartCoverage: 0.9,
    loose: {
      buildCoverageTarget: 0.9,
      targetCoverage: 0.9,
      sustainCoverageFloor: 0.82,
      hardCoverage: 0.96,
      softPlacementScore: 820,
      hardPlacementScore: 1_180,
      minVisibleHoldMs: 38_000,
      safetyMaxItems: 14,
    },
    balanced: {
      buildCoverageTarget: 0.9,
      targetCoverage: 0.9,
      sustainCoverageFloor: 0.84,
      hardCoverage: 0.97,
      softPlacementScore: 980,
      hardPlacementScore: 1_360,
      minVisibleHoldMs: 32_000,
      safetyMaxItems: 18,
    },
    dense: {
      buildCoverageTarget: 0.9,
      targetCoverage: 0.9,
      sustainCoverageFloor: 0.86,
      hardCoverage: 0.98,
      softPlacementScore: 1_160,
      hardPlacementScore: 1_560,
      minVisibleHoldMs: 26_000,
      safetyMaxItems: 22,
    },
  },
  layoutZones: [
    { id: 'top-left-edge', x: 0.08, y: 0.06, weight: 1.12, column: 'left', row: 'top-edge' },
    { id: 'top-left', x: 0.14, y: 0.12, weight: 1.08, column: 'left', row: 'top' },
    { id: 'top-mid-left', x: 0.32, y: 0.1, weight: 1, column: 'mid-left', row: 'top' },
    { id: 'top-mid-right', x: 0.56, y: 0.1, weight: 0.98, column: 'mid-right', row: 'top' },
    { id: 'top-right', x: 0.84, y: 0.12, weight: 1.08, column: 'right', row: 'top' },
    { id: 'top-right-edge', x: 0.92, y: 0.08, weight: 1.12, column: 'right', row: 'top-edge' },
    { id: 'upper-left', x: 0.1, y: 0.28, weight: 1.01, column: 'left', row: 'upper' },
    { id: 'upper-center-left', x: 0.26, y: 0.28, weight: 0.98, column: 'mid-left', row: 'upper' },
    { id: 'upper-center', x: 0.5, y: 0.26, weight: 0.95, column: 'mid', row: 'upper' },
    { id: 'upper-center-right', x: 0.74, y: 0.28, weight: 0.98, column: 'mid-right', row: 'upper' },
    { id: 'upper-right', x: 0.9, y: 0.28, weight: 1.01, column: 'right', row: 'upper' },
    { id: 'center-left', x: 0.08, y: 0.5, weight: 1.02, column: 'left', row: 'center' },
    { id: 'center-mid-left', x: 0.3, y: 0.48, weight: 0.94, column: 'mid-left', row: 'center' },
    { id: 'center-mid', x: 0.5, y: 0.5, weight: 0.9, column: 'mid', row: 'center' },
    { id: 'center-mid-right', x: 0.7, y: 0.5, weight: 0.94, column: 'mid-right', row: 'center' },
    { id: 'center-right', x: 0.92, y: 0.5, weight: 1.02, column: 'right', row: 'center' },
    { id: 'lower-left', x: 0.12, y: 0.72, weight: 1.02, column: 'left', row: 'lower' },
    { id: 'lower-center-left', x: 0.32, y: 0.72, weight: 0.96, column: 'mid-left', row: 'lower' },
    { id: 'lower-center-right', x: 0.68, y: 0.72, weight: 0.96, column: 'mid-right', row: 'lower' },
    { id: 'lower-right', x: 0.88, y: 0.72, weight: 1.02, column: 'right', row: 'lower' },
    { id: 'bottom-left', x: 0.18, y: 0.9, weight: 1.06, column: 'mid-left', row: 'bottom' },
    { id: 'bottom-mid-left', x: 0.38, y: 0.9, weight: 0.98, column: 'mid-left', row: 'bottom' },
    { id: 'bottom-mid-right', x: 0.66, y: 0.88, weight: 0.98, column: 'mid-right', row: 'bottom' },
    { id: 'bottom-right', x: 0.88, y: 0.88, weight: 1.06, column: 'right', row: 'bottom' },
  ],
  drift: {
    amplitudeX: 0,
    amplitudeY: 0,
    periodSeconds: 18,
  },
  queue: {
    preventSimultaneousDuplicates: true,
    recentWindowSize: 4,
    imageCooldownMs: 9_000,
    candidateSelectionMaxAttempts: 24,
    fallbackRelaxRecent: true,
    recentHistoryMax: 10,
  },
} as const

export interface PolaroidTimings {
  spawnIntervalMs: number
  entryDurationMs: number
  developmentDurationMs: number
  flashDurationMs: number
  visibleDurationMs: number
  agingDurationMs: number
  exitDurationMs: number
  preExitLeadTimeMs: number
  rotationWindowMs: number
  targetLifetimeMs: number
  totalLifetimeMs: number
  steadyStateRotationEnabled: boolean
}

export interface PolaroidLayoutDensity {
  sizeScale: number
  minCenterDistanceFactor: number
  preferredDistanceFactor: number
  overlapTolerance: number
}

export interface PolaroidAgingThresholds {
  softStartMs: number
  deepStartMs: number
  finalStartMs: number
}

export interface PolaroidStageCapacity {
  densityMode: 'loose' | 'balanced' | 'dense'
  buildCoverageTarget: number
  targetCoverage: number
  sustainCoverageFloor: number
  hardCoverage: number
  softPlacementScore: number
  hardPlacementScore: number
  minVisibleHoldMs: number
  safetyMaxItems: number
  minBuildCount: number
  minStableVisibleCount: number
  rotationStartCoverage: number
}

export function getSpawnIntervalSeconds(value: number) {
  return clamp(
    Number.isFinite(value) ? value : POLAROID_CONFIG.spawnIntervalSeconds.default,
    POLAROID_CONFIG.spawnIntervalSeconds.min,
    POLAROID_CONFIG.spawnIntervalSeconds.max,
  )
}

export function getSpawnIntervalMs(value: number) {
  return getSpawnIntervalSeconds(value) * 1000
}

export function getVisiblePhotoCount(value: number) {
  return clamp(
    Number.isFinite(value) ? value : POLAROID_CONFIG.visiblePhotos.default,
    POLAROID_CONFIG.visiblePhotos.min,
    POLAROID_CONFIG.visiblePhotos.max,
  )
}

export function getPolaroidTimings(intervalSeconds: number, maxVisiblePhotos: number): PolaroidTimings {
  const spawnIntervalMs = getSpawnIntervalMs(intervalSeconds)
  const visibleCount = getVisiblePhotoCount(maxVisiblePhotos)
  const exitDurationMs = clamp(
    spawnIntervalMs * POLAROID_CONFIG.timing.exitShare,
    POLAROID_CONFIG.timing.minExitDurationMs,
    POLAROID_CONFIG.timing.maxExitDurationMs,
  )
  const maxPreExitLeadMs = Math.max(
    POLAROID_CONFIG.timing.minPreExitLeadTimeMs,
    Math.min(
      POLAROID_CONFIG.timing.maxPreExitLeadTimeMs,
      spawnIntervalMs - POLAROID_CONFIG.timing.spawnDelayAfterExitStartMs - 48,
      Math.round(exitDurationMs * 0.72),
    ),
  )
  const preExitLeadTimeMs = clamp(
    spawnIntervalMs * POLAROID_CONFIG.timing.preExitLeadShare,
    POLAROID_CONFIG.timing.minPreExitLeadTimeMs,
    maxPreExitLeadMs,
  )
  const targetLifetimeMs = clamp(
    spawnIntervalMs * visibleCount,
    POLAROID_CONFIG.timing.minTargetLifetimeMs,
    POLAROID_CONFIG.timing.maxLifetimeMs,
  )
  const rotationWindowMs = Math.max(
    targetLifetimeMs - preExitLeadTimeMs,
    POLAROID_CONFIG.timing.minRotationWindowMs,
  )
  const minVisibleDurationMs = Math.min(
    POLAROID_CONFIG.timing.minVisibleDurationMs,
    Math.max(rotationWindowMs - POLAROID_CONFIG.timing.minAgingDurationMs, 0),
  )
  const maxVisibleDurationMs = Math.max(
    minVisibleDurationMs,
    Math.min(
      POLAROID_CONFIG.timing.maxVisibleDurationMs,
      rotationWindowMs - Math.min(POLAROID_CONFIG.timing.minAgingDurationMs, rotationWindowMs),
    ),
  )
  const visibleDurationMs = clamp(
    rotationWindowMs * POLAROID_CONFIG.timing.visibleShare,
    minVisibleDurationMs,
    maxVisibleDurationMs,
  )
  const agingDurationMs = Math.max(
    rotationWindowMs - visibleDurationMs,
    Math.min(POLAROID_CONFIG.timing.minAgingDurationMs, rotationWindowMs),
  )

  return {
    spawnIntervalMs,
    entryDurationMs: POLAROID_CONFIG.timing.entryDurationMs,
    developmentDurationMs: POLAROID_CONFIG.timing.developmentDurationMs,
    flashDurationMs: POLAROID_CONFIG.timing.flashDurationMs,
    visibleDurationMs,
    agingDurationMs,
    exitDurationMs,
    preExitLeadTimeMs,
    rotationWindowMs,
    targetLifetimeMs,
    totalLifetimeMs: targetLifetimeMs,
    steadyStateRotationEnabled: true,
  }
}

export function getPolaroidAgingThresholds(rotationWindowMs: number): PolaroidAgingThresholds {
  const safeRotationWindowMs = Math.max(rotationWindowMs, 1)
  const softStartMs = safeRotationWindowMs * POLAROID_CONFIG.aging.startDelayShare
  const remainingAgingWindowMs = Math.max(safeRotationWindowMs - softStartMs, 0)

  return {
    softStartMs,
    deepStartMs: softStartMs + remainingAgingWindowMs * POLAROID_CONFIG.aging.deepPhaseStartShare,
    finalStartMs: softStartMs + remainingAgingWindowMs * POLAROID_CONFIG.aging.finalPhaseStartShare,
  }
}

export function getPolaroidStageCapacity(maxVisiblePhotos: number): PolaroidStageCapacity {
  const densityHint = getVisiblePhotoCount(maxVisiblePhotos)

  if (densityHint <= 3) {
    return {
      densityMode: 'loose',
      minBuildCount: POLAROID_CONFIG.stageCapacity.minBuildCount,
      minStableVisibleCount: POLAROID_CONFIG.stageCapacity.minStableVisibleCount,
      rotationStartCoverage: POLAROID_CONFIG.stageCapacity.rotationStartCoverage,
      ...POLAROID_CONFIG.stageCapacity.loose,
    }
  }

  if (densityHint <= 6) {
    return {
      densityMode: 'balanced',
      minBuildCount: POLAROID_CONFIG.stageCapacity.minBuildCount,
      minStableVisibleCount: POLAROID_CONFIG.stageCapacity.minStableVisibleCount,
      rotationStartCoverage: POLAROID_CONFIG.stageCapacity.rotationStartCoverage,
      ...POLAROID_CONFIG.stageCapacity.balanced,
    }
  }

    return {
      densityMode: 'dense',
      minBuildCount: POLAROID_CONFIG.stageCapacity.minBuildCount,
      minStableVisibleCount: POLAROID_CONFIG.stageCapacity.minStableVisibleCount,
      rotationStartCoverage: POLAROID_CONFIG.stageCapacity.rotationStartCoverage,
      ...POLAROID_CONFIG.stageCapacity.dense,
    }
}

export function getPolaroidLayoutDensity(maxVisiblePhotos: number): PolaroidLayoutDensity {
  const visibleCount = getVisiblePhotoCount(maxVisiblePhotos)

  if (visibleCount <= 3) {
    return {
      sizeScale: 1.05,
      minCenterDistanceFactor: 1.08,
      preferredDistanceFactor: 1.54,
      overlapTolerance: 0.1,
    }
  }

  if (visibleCount <= 6) {
    return {
      sizeScale: 1,
      minCenterDistanceFactor: 0.98,
      preferredDistanceFactor: 1.42,
      overlapTolerance: 0.14,
    }
  }

  return {
    sizeScale: 0.92,
    minCenterDistanceFactor: 0.86,
    preferredDistanceFactor: 1.18,
    overlapTolerance: 0.2,
  }
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
