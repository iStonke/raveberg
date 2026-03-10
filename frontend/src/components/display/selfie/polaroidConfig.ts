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
    min: 0.95,
    max: 1.05,
  },
  timing: {
    spawnDelayAfterExitStartMs: 132,
    entryRetryDelayMs: 180,
    entryDurationMs: 820,
    developmentDurationMs: 1_050,
    flashDurationMs: 980,
    minLifetimeMs: 7_500,
    maxLifetimeMs: 150_000,
    visibleShare: 0.42,
    exitShare: 0.13,
    minVisibleDurationMs: 2_800,
    maxVisibleDurationMs: 56_000,
    minExitDurationMs: 1_200,
    maxExitDurationMs: 4_600,
  },
  aging: {
    freshPhaseEnd: 0.12,
    agingPhase1End: 0.35,
    agingPhase2End: 0.65,
    strongAgingPhaseStart: 0.65,
    endDesaturation: 0.06,
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
    disableFlash: false,
    disableAgingDuringInsert: false,
    simplifiedEntry: true,
  },
  zonePadding: {
    top: 0.035,
    right: 0.03,
    bottom: 0.085,
    left: 0.03,
  },
  item: {
    aspectRatio: 1.23,
    defaultWidthFactor: 0.315,
    compactWidthFactor: 0.355,
    minWidthPx: 205,
    maxWidthPx: 405,
  },
  layout: {
    candidateAttemptsPerZone: 6,
    minCenterDistanceFactor: 0.98,
    preferredDistanceFactor: 1.42,
    overlapTolerance: 0.14,
  },
  layoutZones: [
    { id: 'top-left', x: 0.1, y: 0.13, weight: 1.08, column: 'left', row: 'top' },
    { id: 'top-mid-left', x: 0.28, y: 0.14, weight: 0.98, column: 'mid-left', row: 'top' },
    { id: 'top-mid-right', x: 0.56, y: 0.13, weight: 0.95, column: 'mid-right', row: 'top' },
    { id: 'top-right', x: 0.88, y: 0.15, weight: 1.08, column: 'right', row: 'top' },
    { id: 'upper-center-left', x: 0.18, y: 0.32, weight: 0.97, column: 'left', row: 'upper-center' },
    { id: 'upper-center-right', x: 0.82, y: 0.34, weight: 0.97, column: 'right', row: 'upper-center' },
    { id: 'center-left', x: 0.08, y: 0.52, weight: 1.02, column: 'left', row: 'center' },
    { id: 'center-mid-left', x: 0.34, y: 0.5, weight: 0.92, column: 'mid-left', row: 'center' },
    { id: 'center-mid-right', x: 0.62, y: 0.51, weight: 0.92, column: 'mid-right', row: 'center' },
    { id: 'center-right', x: 0.9, y: 0.54, weight: 1.02, column: 'right', row: 'center' },
    { id: 'bottom-left', x: 0.18, y: 0.8, weight: 1.04, column: 'mid-left', row: 'bottom' },
    { id: 'bottom-mid', x: 0.46, y: 0.82, weight: 0.94, column: 'mid', row: 'bottom' },
    { id: 'bottom-mid-right', x: 0.72, y: 0.78, weight: 0.98, column: 'mid-right', row: 'bottom' },
    { id: 'bottom-right', x: 0.9, y: 0.76, weight: 1.04, column: 'right', row: 'bottom' },
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
  totalLifetimeMs: number
}

export interface PolaroidLayoutDensity {
  sizeScale: number
  minCenterDistanceFactor: number
  preferredDistanceFactor: number
  overlapTolerance: number
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
  const totalLifetimeMs = clamp(
    spawnIntervalMs * (visibleCount + 0.45),
    POLAROID_CONFIG.timing.minLifetimeMs,
    POLAROID_CONFIG.timing.maxLifetimeMs,
  )
  const visibleDurationMs = clamp(
    totalLifetimeMs * POLAROID_CONFIG.timing.visibleShare,
    POLAROID_CONFIG.timing.minVisibleDurationMs,
    POLAROID_CONFIG.timing.maxVisibleDurationMs,
  )
  const exitDurationMs = clamp(
    totalLifetimeMs * POLAROID_CONFIG.timing.exitShare,
    POLAROID_CONFIG.timing.minExitDurationMs,
    POLAROID_CONFIG.timing.maxExitDurationMs,
  )
  const agingDurationMs = Math.max(
    totalLifetimeMs - visibleDurationMs - exitDurationMs,
    POLAROID_CONFIG.timing.developmentDurationMs,
  )

  return {
    spawnIntervalMs,
    entryDurationMs: POLAROID_CONFIG.timing.entryDurationMs,
    developmentDurationMs: POLAROID_CONFIG.timing.developmentDurationMs,
    flashDurationMs: POLAROID_CONFIG.timing.flashDurationMs,
    visibleDurationMs,
    agingDurationMs,
    exitDurationMs,
    totalLifetimeMs: visibleDurationMs + agingDurationMs + exitDurationMs,
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
