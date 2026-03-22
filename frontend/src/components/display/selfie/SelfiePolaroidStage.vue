<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { ModerationMode, UploadItem } from '../../../services/api'
import {
  POLAROID_CONFIG,
  clamp,
  getPolaroidAgingThresholds,
  getPolaroidStageCapacity,
  getPolaroidTimings,
  getVisiblePhotoCount,
} from './polaroidConfig'
import {
  assessPolaroidPlacement,
  buildPolaroidLayout,
  getPolaroidDimensions,
  getLayoutFootprint,
  measureLayoutCoverage,
  rebasePolaroidLayout,
} from './polaroidLayout'
import { getFreshnessProfileForRank } from './polaroidAging'
import {
  getImageIdentity,
  getRecentWindowSize,
  isImageInCooldown,
  pickNextImage,
  updateRecentHistory,
  type PolaroidQueueState,
} from './polaroidPool'
import { buildPolaroidEntryMotion } from './polaroidMotion'
import type {
  ActivePolaroid,
  PolaroidFlash,
  PolaroidStagePhase,
  RenderablePolaroid,
  SlideshowEngineState,
  StageSize,
} from './polaroidTypes'
import SelfiePolaroidItem from './SelfiePolaroidItem.vue'

interface PendingSpawn {
  item: ActivePolaroid
  preparedAt: number
  spawnAt: number
  delayMs: number
}

interface InsertMetric {
  preparedAt: number
  mountedAt?: number
  activatedAt?: number
  reason?: 'stage_not_full' | 'post_remove' | 'force_progress' | 'replace_during_fade'
  source?: 'unseen' | 'recycle'
  coverageBefore?: number
}

interface TickSelection {
  upload: (UploadItem & { display_url: string }) | null
  nextCursor: number
  nextPriorityQueue: number[]
  queueState: PolaroidQueueState
}

interface TickDecision {
  type: 'insert' | 'remove' | 'wait'
  engineState: SlideshowEngineState
  reason: string
  delayMs: number
  selection: TickSelection
  placement?: ReturnType<typeof assessPlacementForNextItem>
  exitCandidate?: ActivePolaroid | null
  placementSuccess?: boolean
}

interface FreshnessEntry {
  item: ActivePolaroid
  freshnessRank: number
  freshnessProfile: RenderablePolaroid['freshnessProfile']
  isTopFresh: boolean
}

type SlideshowImageState =
  | 'visible'
  | 'aging'
  | 'entering'
  | 'fading'
  | 'queued'
  | 'unseen'
  | 'recycle'
  | 'blocked'
  | 'failedPlacement'
  | 'cooldown'

interface UploadAccountingEntry {
  imageId: number
  uploadId: number
  currentState: SlideshowImageState
  hasBeenShown: boolean
  isVisible: boolean
  isEntering: boolean
  isFading: boolean
  isQueued: boolean
  isInRecyclePool: boolean
  lastShownAt: number | null
  placementAttempts: number
  blockedReason: string | null
}

interface UploadAccountingSummary {
  totalUploads: number
  visible: number
  aging: number
  entering: number
  fading: number
  queued: number
  unseen: number
  recyclePool: number
  blocked: number
  failedPlacement: number
  cooldown: number
  sum: number
  mismatch: boolean
}

const props = defineProps<{
  uploads: UploadItem[]
  loading: boolean
  paused: boolean
  intervalSeconds: number
  maxVisiblePhotos: number
  vintageLookEnabled: boolean
  moderationMode: ModerationMode
  manualAdvanceToken: number
}>()

const stageRef = ref<HTMLElement | null>(null)
const stageSize = ref<StageSize>({ width: 1280, height: 720 })
const visibleItems = ref<ActivePolaroid[]>([])
const pendingSpawn = ref<PendingSpawn | null>(null)
const flashes = ref<PolaroidFlash[]>([])
const brokenUploadIds = ref<Set<number>>(new Set())
const rotationStartedAt = ref<number | null>(null)
const lastStageMutationAt = ref(0)
const awaitingReplacementAfterRemoval = ref(false)
const removedImagesCount = ref(0)
const lastInsertTimestamp = ref<number | null>(null)
const lastRemoveTimestamp = ref<number | null>(null)
const debugEnabled = ref(false)
const lastProgressReason = ref('init')
const lastBuildProgressReason = ref('init')
const lastBuildProgressAt = ref(0)
const lastFailedInsertReason = ref<string | null>(null)
const buildPlacementAttemptsSinceLastInsert = ref(0)
const buildCompletionReason = ref<string | null>(null)
const lastViableSlotTimestamp = ref<number | null>(null)
const lastVisibleInsertAt = ref<number | null>(null)
const removalWaitStartedAt = ref<number | null>(null)
const effectiveInsertIntervalsMs = ref<number[]>([])

const itemTimers = new Map<string, number[]>()
const flashTimers = new Map<string, number>()
const insertMetrics = new Map<string, InsertMetric>()

let resizeObserver: ResizeObserver | null = null
let schedulerTimer: number | null = null
let pendingSpawnTimer: number | null = null
let activationRafA: number | null = null
let activationRafB: number | null = null
let freezeFailsafeTimer: number | null = null
let debugHeartbeatTimer: number | null = null
let activeEntryInstanceId: string | null = null
let nextTickAt: number | null = null
let nextCursor = 0
let instanceCounter = 0
let orderCounter = 0
let flashCounter = 0
let knownPoolIds = new Set<number>()
let priorityQueue: number[] = []
let recentHistory: number[] = []
const queuedAtByIdentity = new Map<number, number>()
const removedAtByIdentity = new Map<number, number>()
const shownAtByIdentity = new Map<number, number>()
const placementAttemptsByIdentity = new Map<number, number>()
const failedPlacementReasonByIdentity = new Map<number, string>()
let lastAgingLogSignature: string | null = null
const DEBUG_HEARTBEAT_MS = 2_500
const BUILD_STALL_TIMEOUT_MS = 4_000
const BUILD_ABORT_RETRY_THRESHOLD = 6
const MIN_ROTATION_COVERAGE_FLOOR = 0.82
const EXIT_PIPELINE_WATCHDOG_MS = 3_000
const BUILD_EARLY_ROTATION_COVERAGE_FLOOR = 0.8
const PENDING_SPAWN_WATCHDOG_GRACE_MS = 250

const availableUploads = computed(() =>
  props.uploads.filter(
    (upload): upload is UploadItem & { display_url: string } =>
      Boolean(upload.display_url) && !brokenUploadIds.value.has(upload.id),
  ),
)

const targetVisibleCount = computed(() => getVisiblePhotoCount(props.maxVisiblePhotos))
const effectiveVisibleCount = computed(() => {
  if (!POLAROID_CONFIG.queue.preventSimultaneousDuplicates) {
    return targetVisibleCount.value
  }

  const uniquePoolSize = availableUploads.value.length
  if (!uniquePoolSize) {
    return targetVisibleCount.value
  }

  return Math.min(targetVisibleCount.value, uniquePoolSize)
})
const timings = computed(() => getPolaroidTimings(props.intervalSeconds, effectiveVisibleCount.value))
const stageCapacity = computed(() => getPolaroidStageCapacity(props.maxVisiblePhotos))
const freshnessEntries = computed(() => buildFreshnessEntries(visibleItems.value))
const freshnessEntryByInstanceId = computed(() => {
  const entries = new Map<string, FreshnessEntry>()
  for (const entry of freshnessEntries.value) {
    entries.set(entry.item.instanceId, entry)
  }
  return entries
})
const stackItems = computed<RenderablePolaroid[]>(() =>
  visibleItems.value.map((item) => {
    const freshness = freshnessEntryByInstanceId.value.get(item.instanceId)
    return {
      ...item,
      freshnessRank: freshness?.freshnessRank ?? Number.MAX_SAFE_INTEGER,
      freshnessProfile: freshness?.freshnessProfile ?? 'aged-deep',
      isTopFresh: freshness?.isTopFresh ?? false,
    }
  }),
)
const enteringCount = computed(
  () =>
    visibleItems.value.filter((item) => item.lifecycleStatus === 'pre_enter' || item.lifecycleStatus === 'entering')
      .length + (pendingSpawn.value ? 1 : 0),
)
const fadingCount = computed(
  () => visibleItems.value.filter((item) => item.lifecycleStatus === 'fading_out').length,
)
const agingCount = computed(
  () => visibleItems.value.filter((item) => item.lifecycleStatus === 'visible_aging').length,
)
const stackLoad = computed(() => visibleItems.value.length + (pendingSpawn.value ? 1 : 0))
const coverageRatio = computed(() => getCurrentCoverage())
const currentEngineState = computed<SlideshowEngineState>(() => {
  const activeEntryItem =
    activeEntryInstanceId == null
      ? null
      : visibleItems.value.find(
          (item) =>
            item.instanceId === activeEntryInstanceId &&
            (item.lifecycleStatus === 'pre_enter' || item.lifecycleStatus === 'entering'),
        ) ?? null

  if (pendingSpawn.value != null || activeEntryItem != null || enteringCount.value > 0) {
    return 'INSERTING'
  }

  if (getActiveExitFlowItem() != null || agingCount.value > 0 || fadingCount.value > 0) {
    return 'REMOVING'
  }

  return 'READY'
})
const currentPhase = computed<PolaroidStagePhase>(() => {
  if (hasUnshownImages() || getQueuedIdentities().size > 0 || pendingSpawn.value != null) {
    return 'build'
  }

  return visibleItems.value.length > 0 ? 'rotation' : 'steady'
})
const debugOverlayState = computed(() => {
  if (!debugEnabled.value) {
    return null
  }

  const coverage = getCurrentCoverage()
  const accounting = buildAccountingSnapshot()
  const exitPipeline = getExitPipelineSnapshot()

  return {
    currentEngineState: currentEngineState.value,
    coveragePercent: formatPercent(coverage),
    effectiveMinVisibleHoldMs: Math.round(getEffectiveMinVisibleHoldMs()),
    insertCadenceOverdue: isInsertCadenceOverdue(),
    configuredInsertInterval: Math.round(timings.value.spawnIntervalMs / 1000),
    actualTimeSinceLastVisibleInsert: Math.round(getActualTimeSinceLastVisibleInsertMs() / 1000),
    averageEffectiveInsertInterval: Math.round(getAverageEffectiveInsertIntervalMs() / 1000),
    agingDurationCurrent: Math.round(timings.value.agingDurationMs / 1000),
    fadeDurationCurrent: Math.round(timings.value.exitDurationMs / 1000),
    timeSpentWaitingForRemoval: Math.round(getTimeSpentWaitingForRemovalMs() / 1000),
    totalUploads: accounting.summary.totalUploads,
    visibleCount: accounting.summary.visible,
    agingCount: accounting.summary.aging,
    unseenCount: accounting.summary.unseen,
    queuedCount: accounting.summary.queued,
    recycleCount: accounting.summary.recyclePool,
    blockedCount: accounting.summary.blocked + accounting.summary.failedPlacement + accounting.summary.cooldown,
    fadingCount: accounting.summary.fading,
    enteringCount: accounting.summary.entering,
    sum: accounting.summary.sum,
    mismatch: accounting.summary.mismatch,
    minRotationCoverage: Number((getMinRotationCoverage() * 100).toFixed(1)),
    rotationAllowed: isRotationAllowed(),
    buildAllowed: currentPhase.value === 'build',
    exitPipelineState: exitPipeline.state,
    selectedAgingImageId: exitPipeline.imageId,
    nextCandidateId: selectNextUpload().upload?.id ?? null,
    targetCoverage: Number((stageCapacity.value.targetCoverage * 100).toFixed(1)),
    effectiveBuildCompleteReason: getEffectiveBuildCompleteReason(),
    stalledRetryThreshold: BUILD_ABORT_RETRY_THRESHOLD,
    lastViableSlotTimestamp: lastViableSlotTimestamp.value == null ? null : Math.round(lastViableSlotTimestamp.value),
    buildProgressAge: Math.round(getBuildProgressAgeMs() / 1000),
    queuedOldestAge: Math.round(getQueuedOldestAgeMs() / 1000),
    placementAttemptsSinceLastInsert: buildPlacementAttemptsSinceLastInsert.value,
    lastProgressReason: lastProgressReason.value,
    lastFailedInsertReason: lastFailedInsertReason.value ?? 'none',
    lastTransition: lastProgressReason.value,
    phase: currentPhase.value,
  }
})

function getFreshnessTimestamp(item: ActivePolaroid) {
  return item.visibleSince ?? item.entryActivatedAt ?? item.enteredAt
}

function buildFreshnessEntries(items: ActivePolaroid[]) {
  return [...items]
    .sort((left, right) => {
      const timeDelta = getFreshnessTimestamp(right) - getFreshnessTimestamp(left)
      if (timeDelta !== 0) {
        return timeDelta
      }
      return right.order - left.order
    })
    .map((item, freshnessRank) => ({
      item,
      freshnessRank,
      freshnessProfile: getFreshnessProfileForRank(freshnessRank),
      isTopFresh: freshnessRank < POLAROID_CONFIG.aging.topColorCount,
    }))
}

function getFreshnessEntry(item: ActivePolaroid) {
  return freshnessEntryByInstanceId.value.get(item.instanceId) ?? {
    item,
    freshnessRank: Number.MAX_SAFE_INTEGER,
    freshnessProfile: 'aged-deep' as const,
    isTopFresh: false,
  }
}

function getDisplayableUploads() {
  return props.uploads.filter((upload): upload is UploadItem & { display_url: string } => Boolean(upload.display_url))
}

function getQueuedIdentities() {
  const queuedIdentities = new Set(priorityQueue)
  if (pendingSpawn.value) {
    queuedIdentities.add(pendingSpawn.value.item.uploadId)
  }
  return queuedIdentities
}

function getQueuedOldestAgeMs(now = nowMs()) {
  const queueAges = [...priorityQueue]
    .map((identity) => queuedAtByIdentity.get(identity))
    .filter((queuedAt): queuedAt is number => queuedAt != null)
    .map((queuedAt) => now - queuedAt)

  if (pendingSpawn.value) {
    queueAges.push(now - pendingSpawn.value.preparedAt)
  }

  if (!queueAges.length) {
    return 0
  }

  return Math.max(...queueAges)
}

function getBuildProgressAgeMs(now = nowMs()) {
  return Math.max(0, now - lastBuildProgressAt.value)
}

function getEffectiveMinVisibleHoldMs() {
  const cadenceHoldMs = Math.max(
    timings.value.spawnIntervalMs * 2,
    timings.value.agingDurationMs + timings.value.exitDurationMs + POLAROID_CONFIG.timing.spawnDelayAfterExitStartMs,
  )

  return Math.min(
    stageCapacity.value.minVisibleHoldMs,
    Math.max(cadenceHoldMs, POLAROID_CONFIG.timing.minVisibleDurationMs),
  )
}

function getActiveRemovalTimings(baseTimings: ActivePolaroid['timings']) {
  const maxCadenceAgingMs = Math.max(
    POLAROID_CONFIG.timing.minAgingDurationMs,
    Math.min(
      Math.round(baseTimings.spawnIntervalMs * 0.22),
      baseTimings.spawnIntervalMs - baseTimings.exitDurationMs - POLAROID_CONFIG.timing.spawnDelayAfterExitStartMs - 96,
    ),
  )
  const agingDurationMs = Math.min(baseTimings.agingDurationMs, maxCadenceAgingMs)

  return {
    ...baseTimings,
    agingDurationMs,
  }
}

function getNextVisibleInsertDueAt(now = nowMs()) {
  if (lastVisibleInsertAt.value == null) {
    return now
  }

  return lastVisibleInsertAt.value + timings.value.spawnIntervalMs
}

function getRemainingVisibleInsertCadenceMs(now = nowMs()) {
  return Math.max(0, getNextVisibleInsertDueAt(now) - now)
}

function isInsertCadenceOverdue(now = nowMs()) {
  return getActualTimeSinceLastVisibleInsertMs(now) >= Math.round(timings.value.spawnIntervalMs * 1.35)
}

function getActualTimeSinceLastVisibleInsertMs(now = nowMs()) {
  if (lastVisibleInsertAt.value == null) {
    return 0
  }

  return Math.max(0, now - lastVisibleInsertAt.value)
}

function getAverageEffectiveInsertIntervalMs() {
  if (!effectiveInsertIntervalsMs.value.length) {
    return 0
  }

  return Math.round(
    effectiveInsertIntervalsMs.value.reduce((total, intervalMs) => total + intervalMs, 0) /
      effectiveInsertIntervalsMs.value.length,
  )
}

function getTimeSpentWaitingForRemovalMs(now = nowMs()) {
  if (removalWaitStartedAt.value == null) {
    return 0
  }

  return Math.max(0, now - removalWaitStartedAt.value)
}

function recordVisibleInsertCadence(insertedAt: number) {
  if (lastVisibleInsertAt.value != null) {
    const nextIntervals = [...effectiveInsertIntervalsMs.value, Math.round(insertedAt - lastVisibleInsertAt.value)]
    effectiveInsertIntervalsMs.value = nextIntervals.slice(-12)
  }
  lastVisibleInsertAt.value = insertedAt
}

function getMinRotationCoverage() {
  return Math.max(stageCapacity.value.sustainCoverageFloor, MIN_ROTATION_COVERAGE_FLOOR)
}

function getEarlyRotationUnlockCoverage() {
  return Math.max(BUILD_EARLY_ROTATION_COVERAGE_FLOOR, stageCapacity.value.targetCoverage - 0.06)
}

function getMinVisibleBeforeRotation() {
  if (!availableUploads.value.length) {
    return 0
  }

  return Math.min(
    Math.max(stageCapacity.value.minStableVisibleCount, 8),
    availableUploads.value.length,
    stageCapacity.value.safetyMaxItems,
  )
}

function isRotationAllowedByDensity() {
  return getCurrentCoverage() >= getMinRotationCoverage() && visibleItems.value.length >= getMinVisibleBeforeRotation()
}

function isBuildStallRotationUnlocked(now = nowMs()) {
  return buildCompletionReason.value != null && buildAccountingSnapshot(now).summary.queued > 0
}

function isRotationAllowed(now = nowMs()) {
  return isRotationAllowedByDensity() || isBuildStallRotationUnlocked(now)
}

function getEffectiveBuildCompleteReason(now = nowMs()) {
  return isBuildStallRotationUnlocked(now) ? buildCompletionReason.value : null
}

function syncBuildCompletionReason(now = nowMs()) {
  if (buildCompletionReason.value != null && buildAccountingSnapshot(now).summary.queued === 0 && pendingSpawn.value == null) {
    buildCompletionReason.value = null
  }
}

function shouldForceBuildPhase(now = nowMs()) {
  const accounting = buildAccountingSnapshot(now)
  return getCurrentCoverage() < getMinRotationCoverage() && accounting.summary.queued > 0 && !isBuildStallRotationUnlocked(now)
}

function getExitPipelineSnapshot(now = nowMs()) {
  const activeExitFlow = getActiveExitFlowItem()
  if (!activeExitFlow) {
    return {
      state: 'idle',
      imageId: null,
      agingStartedAt: null,
      agingDeadline: null,
      fadeDeadline: null,
    }
  }

  if (activeExitFlow.lifecycleStatus === 'visible_aging') {
    const agingStartedAt = activeExitFlow.ageStartedAt ?? getFreshnessTimestamp(activeExitFlow)
    return {
      state: 'visible_aging',
      imageId: activeExitFlow.uploadId,
      agingStartedAt: Math.round(agingStartedAt),
      agingDeadline: Math.round(agingStartedAt + activeExitFlow.timings.agingDurationMs),
      fadeDeadline: null,
    }
  }

  if (activeExitFlow.lifecycleStatus === 'fading_out') {
    const fadeStartedAt = activeExitFlow.fadeStartedAt ?? now
    return {
      state: 'fading_out',
      imageId: activeExitFlow.uploadId,
      agingStartedAt: activeExitFlow.ageStartedAt == null ? null : Math.round(activeExitFlow.ageStartedAt),
      agingDeadline:
        activeExitFlow.ageStartedAt == null
          ? null
          : Math.round(activeExitFlow.ageStartedAt + activeExitFlow.timings.agingDurationMs),
      fadeDeadline: Math.round(fadeStartedAt + activeExitFlow.timings.exitDurationMs),
    }
  }

  return {
    state: activeExitFlow.lifecycleStatus,
    imageId: activeExitFlow.uploadId,
    agingStartedAt: null,
    agingDeadline: null,
    fadeDeadline: null,
  }
}

function recordBuildProgress(reason: string, now = nowMs()) {
  lastBuildProgressAt.value = now
  lastBuildProgressReason.value = reason
  buildPlacementAttemptsSinceLastInsert.value = 0
  lastFailedInsertReason.value = null
}

function unlockRotationFromBuildStall(reason: string, now = nowMs()) {
  if (buildCompletionReason.value == null) {
    buildCompletionReason.value = reason
  }

  const payload = {
    effectiveBuildCompleteReason: buildCompletionReason.value,
    targetCoverage: Number((stageCapacity.value.targetCoverage * 100).toFixed(1)),
    minRotationCoverage: Number((getMinRotationCoverage() * 100).toFixed(1)),
    earlyUnlockCoverage: Number((getEarlyRotationUnlockCoverage() * 100).toFixed(1)),
    stalledRetryThreshold: BUILD_ABORT_RETRY_THRESHOLD,
    lastViableSlotTimestamp: lastViableSlotTimestamp.value == null ? null : Math.round(lastViableSlotTimestamp.value),
    queuedCount: buildAccountingSnapshot(now).summary.queued,
  }

  logSlideshowDebug('BUILD_STALLED_NO_SLOT', payload)
  logSlideshowDebug('BUILD_COMPLETED_EARLY', payload)
  logSlideshowDebug('ROTATION_UNLOCKED_FROM_STALL', payload)
}

function canUnlockRotationFromBuildStall(
  now: number,
  selection: TickSelection,
  placement?: ReturnType<typeof assessPlacementForNextItem>,
) {
  const accounting = buildAccountingSnapshot(now)
  const queuedCount = accounting.summary.queued
  const noActivePipeline =
    enteringCount.value === 0 &&
    fadingCount.value === 0 &&
    pendingSpawn.value == null &&
    getActiveExitFlowItem() == null
  const noViableQueuedSlot =
    queuedCount > 0 &&
    (!selection.upload || (placement != null && !canInsertDuringBuild(placement)))
  const enoughCoverageForEarlyRotation = getCurrentCoverage() >= getEarlyRotationUnlockCoverage()
  const enoughVisibleForEarlyRotation =
    visibleItems.value.length >= Math.max(stageCapacity.value.minBuildCount, getMinVisibleBeforeRotation() - 2)
  const timedOut = getBuildProgressAgeMs(now) >= BUILD_STALL_TIMEOUT_MS
  const retryThresholdReached = buildPlacementAttemptsSinceLastInsert.value >= BUILD_ABORT_RETRY_THRESHOLD

  return (
    queuedCount > 0 &&
    noActivePipeline &&
    noViableQueuedSlot &&
    enoughCoverageForEarlyRotation &&
    enoughVisibleForEarlyRotation &&
    (retryThresholdReached || timedOut)
  )
}

function logRotationBlockedLowCoverage(reason: string, now = nowMs()) {
  const payload = {
    reason,
    minRotationCoverage: Number(getMinRotationCoverage().toFixed(3)),
    targetCoverage: Number(stageCapacity.value.targetCoverage.toFixed(3)),
    coverage: Number(getCurrentCoverage().toFixed(3)),
    minVisibleBeforeRotation: getMinVisibleBeforeRotation(),
    visibleCount: visibleItems.value.length,
    rotationAllowed: false,
    buildAllowed: true,
    queuedCount: buildAccountingSnapshot(now).summary.queued,
  }

  if (
    currentPhase.value !== 'build' ||
    buildPlacementAttemptsSinceLastInsert.value > 0 ||
    getBuildProgressAgeMs(now) >= BUILD_STALL_TIMEOUT_MS
  ) {
    console.error('[SLIDESHOW][ROTATION_BLOCKED_LOW_COVERAGE]', payload)
  }
  logSlideshowDebug('ROTATION_BLOCKED_LOW_COVERAGE', payload)
}

function enforceLowCoverageBuildConsistency(now = nowMs()) {
  const accounting = buildAccountingSnapshot(now)
  const activeExitFlow = getActiveExitFlowItem()
  const invalidLowCoverageRotation =
    getCurrentCoverage() < getMinRotationCoverage() &&
    !isBuildStallRotationUnlocked(now) &&
    accounting.summary.queued > 0 &&
    (rotationStartedAt.value != null || activeExitFlow != null || agingCount.value > 0 || fadingCount.value > 0)

  if (!invalidLowCoverageRotation) {
    return false
  }

  const payload = {
    coverage: Number((getCurrentCoverage() * 100).toFixed(1)),
    minRotationCoverage: Number((getMinRotationCoverage() * 100).toFixed(1)),
    queuedCount: accounting.summary.queued,
    agingCount: accounting.summary.aging,
    fadingCount: accounting.summary.fading,
    enteringCount: accounting.summary.entering,
  }
  console.error('[SLIDESHOW][INVALID_LOW_COVERAGE_ROTATION]', payload)
  logSlideshowDebug('ROTATION_BLOCKED_LOW_COVERAGE', payload)

  rotationStartedAt.value = null
  visibleItems.value = visibleItems.value.map((item) => {
    if (item.lifecycleStatus !== 'visible_aging' && item.lifecycleStatus !== 'fading_out') {
      return item
    }
    clearItemTimers(item.instanceId)
    return {
      ...item,
      lifecycleStatus: 'visible_fresh',
      toneStage: 'fresh',
      ageStartedAt: null,
      fadeStartedAt: null,
      agingElapsedMs: 0,
      agingResumedAt: null,
    }
  })
  recordBuildProgress('rotation-blocked-low-coverage', now)
  markStageMutation('rotation-blocked-low-coverage')
  return true
}

function advanceExitPipeline(now = nowMs(), forced = false) {
  const activeExitFlow = getActiveExitFlowItem()
  if (!activeExitFlow) {
    return false
  }

  const snapshot = getExitPipelineSnapshot(now)
  if (activeExitFlow.lifecycleStatus === 'visible_aging' && snapshot.agingDeadline != null) {
    const deadlineReached = now >= snapshot.agingDeadline
    const stalledPastDeadline = now >= snapshot.agingDeadline + EXIT_PIPELINE_WATCHDOG_MS
    if (!deadlineReached) {
      return false
    }
    if (forced && stalledPastDeadline) {
      logSlideshowDebug('AGING_PIPELINE_STALLED', {
        selectedAgingImageId: snapshot.imageId,
        agingStartedAt: snapshot.agingStartedAt,
        agingDeadline: snapshot.agingDeadline,
        exitPipelineState: snapshot.state,
      })
      logSlideshowDebug('FORCE_ADVANCE_TO_FADING', {
        selectedAgingImageId: snapshot.imageId,
        agingStartedAt: snapshot.agingStartedAt,
        agingDeadline: snapshot.agingDeadline,
      })
    }
    startFadeOut(activeExitFlow.instanceId)
    scheduleRetry(now, getNextLifecycleProgressDelayMs(now))
    return true
  }

  if (activeExitFlow.lifecycleStatus === 'fading_out' && snapshot.fadeDeadline != null) {
    const deadlineReached = now >= snapshot.fadeDeadline
    const stalledPastDeadline = now >= snapshot.fadeDeadline + EXIT_PIPELINE_WATCHDOG_MS
    if (!deadlineReached) {
      return false
    }
    if (forced && stalledPastDeadline) {
      logSlideshowDebug('AGING_PIPELINE_STALLED', {
        selectedAgingImageId: snapshot.imageId,
        agingStartedAt: snapshot.agingStartedAt,
        fadeDeadline: snapshot.fadeDeadline,
        exitPipelineState: snapshot.state,
      })
    }
    removeFadedItem(activeExitFlow.instanceId)
    return true
  }

  return false
}

function incrementPlacementAttempt(uploadId: number, reason: string) {
  placementAttemptsByIdentity.set(uploadId, (placementAttemptsByIdentity.get(uploadId) ?? 0) + 1)
  failedPlacementReasonByIdentity.set(uploadId, reason)
}

function clearPlacementFailure(uploadId: number) {
  failedPlacementReasonByIdentity.delete(uploadId)
}

function buildAccountingSnapshot(now = nowMs()) {
  const displayableUploads = getDisplayableUploads()
  const availableIds = new Set(availableUploads.value.map((upload) => upload.id))
  const queuedIds = new Set(priorityQueue.filter((identity) => availableIds.has(identity)))
  if (pendingSpawn.value) {
    queuedIds.add(pendingSpawn.value.item.uploadId)
  }

  const visibleById = new Map(visibleItems.value.map((item) => [item.uploadId, item]))
  const recentBlockedIds = new Set(
    recentHistory.slice(0, getRecentWindowSize(Math.max(displayableUploads.length, 1), effectiveVisibleCount.value)),
  )

  const entries: UploadAccountingEntry[] = props.uploads.map((upload) => {
    const uploadId = upload.id
    const hasBeenShown = shownAtByIdentity.has(uploadId)
    const lastShownAt = shownAtByIdentity.get(uploadId) ?? null
    const activeItem = visibleById.get(uploadId)
    const missingDisplayUrl = !upload.display_url
    const broken = brokenUploadIds.value.has(uploadId)
    const pendingQueued = pendingSpawn.value?.item.uploadId === uploadId
    const queued = pendingQueued || queuedIds.has(uploadId)
    const failedPlacementReason = failedPlacementReasonByIdentity.get(uploadId) ?? null
    const inCooldown = isImageInCooldown(uploadId, removedAtByIdentity, now)
    const recentBlocked = recentBlockedIds.has(uploadId)

    let currentState: SlideshowImageState
    let blockedReason: string | null = null

    if (missingDisplayUrl) {
      currentState = 'blocked'
      blockedReason = 'missing_display_url'
    } else if (broken) {
      currentState = 'blocked'
      blockedReason = 'image_error'
    } else if (activeItem) {
      if (activeItem.lifecycleStatus === 'pre_enter' || activeItem.lifecycleStatus === 'entering') {
        currentState = 'entering'
      } else if (activeItem.lifecycleStatus === 'visible_aging') {
        currentState = 'aging'
      } else if (activeItem.lifecycleStatus === 'fading_out') {
        currentState = 'fading'
      } else {
        currentState = 'visible'
      }
    } else if (queued) {
      currentState = 'queued'
      blockedReason = pendingQueued ? 'pending_spawn' : failedPlacementReason ?? 'priority_queue'
    } else if (failedPlacementReason) {
      currentState = 'failedPlacement'
      blockedReason = failedPlacementReason
    } else if (inCooldown) {
      currentState = 'cooldown'
      blockedReason = 'recently_removed_cooldown'
    } else if (recentBlocked) {
      currentState = 'blocked'
      blockedReason = 'recent_history_hold'
    } else if (hasBeenShown) {
      currentState = 'recycle'
    } else {
      currentState = 'unseen'
    }

    return {
      imageId: uploadId,
      uploadId,
      currentState,
      hasBeenShown,
      isVisible:
        currentState === 'visible' ||
        currentState === 'aging' ||
        currentState === 'entering' ||
        currentState === 'fading',
      isEntering: currentState === 'entering',
      isFading: currentState === 'fading',
      isQueued: currentState === 'queued',
      isInRecyclePool: currentState === 'recycle',
      lastShownAt: lastShownAt == null ? null : Math.round(lastShownAt),
      placementAttempts: placementAttemptsByIdentity.get(uploadId) ?? 0,
      blockedReason,
    }
  })

  const summary = entries.reduce<UploadAccountingSummary>(
    (totals, entry) => {
      switch (entry.currentState) {
        case 'visible':
          totals.visible += 1
          break
        case 'aging':
          totals.aging += 1
          break
        case 'entering':
          totals.entering += 1
          break
        case 'fading':
          totals.fading += 1
          break
        case 'queued':
          totals.queued += 1
          break
        case 'unseen':
          totals.unseen += 1
          break
        case 'recycle':
          totals.recyclePool += 1
          break
        case 'blocked':
          totals.blocked += 1
          break
        case 'failedPlacement':
          totals.failedPlacement += 1
          break
        case 'cooldown':
          totals.cooldown += 1
          break
      }

      totals.sum += 1
      return totals
    },
    {
      totalUploads: props.uploads.length,
      visible: 0,
      aging: 0,
      entering: 0,
      fading: 0,
      queued: 0,
      unseen: 0,
      recyclePool: 0,
      blocked: 0,
      failedPlacement: 0,
      cooldown: 0,
      sum: 0,
      mismatch: false,
    },
  )

  summary.mismatch = summary.sum !== summary.totalUploads

  return {
    summary,
    images: entries,
    nonVisibleImages: entries
      .filter((entry) => !entry.isVisible)
      .map((entry) => ({
        imageId: entry.imageId,
        currentState: entry.currentState,
        reason: entry.blockedReason,
      })),
  }
}

onMounted(() => {
  lastStageMutationAt.value = nowMs()
  lastBuildProgressAt.value = lastStageMutationAt.value
  syncDebugEnabled()
  syncStageSize()
  resizeObserver = new ResizeObserver(() => {
    syncStageSize()
  })
  if (stageRef.value) {
    resizeObserver.observe(stageRef.value)
  }
  armFreezeFailsafe()
  armDebugHeartbeat()
  logInit()
  runAccountingCheck('init')
})

onBeforeUnmount(() => {
  clearSchedulerTimer()
  clearFreezeFailsafe()
  clearDebugHeartbeat()
  cancelPendingSpawn()
  cancelActivationFrames()
  clearAllItemTimers()
  clearAllFlashTimers()
  resizeObserver?.disconnect()
})

watch(
  availableUploads,
  (nextUploads) => {
    syncUploads(nextUploads)
  },
  { immediate: true },
)

watch(
  () => props.intervalSeconds,
  () => {
    refreshActiveTimings()
    rebaseScheduler(false)
  },
)

watch(
  () => props.maxVisiblePhotos,
  () => {
    syncStageSize()
    refreshActiveTimings()
    reconcileVisibleCount()
    rebaseScheduler(false)
  },
)

watch(
  () => props.manualAdvanceToken,
  (nextToken, previousToken) => {
    if (nextToken === previousToken) {
      return
    }
    runSchedulerTick(true)
  },
)

watch(
  () => props.paused,
  (paused) => {
    if (paused) {
      clearSchedulerTimer()
      cancelPendingSpawn()
      clearFreezeFailsafe()
      clearDebugHeartbeat()
      return
    }
    syncDebugEnabled()
    armFreezeFailsafe()
    armDebugHeartbeat()
    ensureScheduler(stackLoad.value === 0)
  },
)

function runSchedulerTick(force: boolean) {
  clearSchedulerTimer()
  if (props.paused || !availableUploads.value.length) {
    nextTickAt = null
    return
  }

  const now = nowMs()
  if (recoverStaleInsertState(now)) {
    return
  }
  const engineState = currentEngineState.value
  if (advanceExitPipeline(now, force)) {
    return
  }

  if (engineState === 'INSERTING' || engineState === 'REMOVING') {
    const inFlightDecision: TickDecision = {
      type: 'wait',
      engineState,
      reason: engineState === 'INSERTING' ? 'wait - insert animation in progress' : 'wait - remove animation in progress',
      delayMs: getNextLifecycleProgressDelayMs(now),
      selection: selectNextUpload(now),
    }
    logSchedulerDecision(inFlightDecision)
    scheduleRetry(now, inFlightDecision.delayMs)
    return
  }

  const selection = selectNextUpload(now)
  const decision = determineTickDecision(now, force, selection)
  logSchedulerDecision(decision)

  if (decision.type === 'insert' && decision.selection.upload && decision.placement) {
    removalWaitStartedAt.value = null
    incrementPlacementAttempt(decision.selection.upload.id, 'placement_accepted')
    clearPlacementFailure(decision.selection.upload.id)
    commitSelection(decision.selection)
    prepareSpawn(decision.selection.upload, 0, now, decision.placement.layout, {
      reason: lastProgressReason.value === 'fade-complete' ? 'post_remove' : 'force_progress',
      source: shownAtByIdentity.has(decision.selection.upload.id) ? 'recycle' : 'unseen',
      coverageBefore: getCurrentCoverage(),
    })
    advanceSchedulerTick(now, force)
    return
  }

  if (decision.type === 'remove' && decision.exitCandidate) {
    removalWaitStartedAt.value = null
    if (decision.selection.upload) {
      prioritizeUpload(decision.selection.upload.id)
      incrementPlacementAttempt(decision.selection.upload.id, 'no_viable_slot_remove_oldest')
      lastFailedInsertReason.value = 'no_viable_slot_remove_oldest'
      logSlideshowDebug('NO_SLOT', {
        imageId: decision.selection.upload.id,
        currentEngineState: currentEngineState.value,
        placementSuccess: false,
        removeTargetId: decision.exitCandidate.uploadId,
        visibleCount: visibleItems.value.length,
        unseenCount: decision.selection.queueState.unseenCount,
        recycleCount: decision.selection.queueState.recycleCount,
        coverage: Number((getCurrentCoverage() * 100).toFixed(1)),
      })
    }
    startAgingCycle(decision.exitCandidate.instanceId)
    scheduleRetry(now, decision.delayMs)
    return
  }

  if (decision.selection.upload && decision.reason.includes('remove not yet eligible')) {
    if (removalWaitStartedAt.value == null) {
      removalWaitStartedAt.value = now
    }
    prioritizeUpload(decision.selection.upload.id)
    lastFailedInsertReason.value = decision.reason
  } else if (
    decision.selection.upload &&
    (decision.reason.includes('insert cadence not reached') || decision.reason.includes('pre-exit window not reached'))
  ) {
    removalWaitStartedAt.value = null
    prioritizeUpload(decision.selection.upload.id)
    lastFailedInsertReason.value = decision.reason
  } else if (decision.selection.upload) {
    removalWaitStartedAt.value = null
    deferSelection(decision.selection)
  } else {
    removalWaitStartedAt.value = null
  }

  scheduleRetry(now, decision.delayMs)
}

function determineTickDecision(now: number, force: boolean, selection: TickSelection): TickDecision {
  const engineState = currentEngineState.value
  if (engineState !== 'READY' && !force) {
    return {
      type: 'wait',
      engineState,
      reason: engineState === 'INSERTING' ? 'wait - insert animation in progress' : 'wait - remove animation in progress',
      delayMs: getNextLifecycleProgressDelayMs(now),
      selection,
    }
  }

  logSlideshowDebug('READY', {
    currentEngineState: engineState,
    totalUploads: availableUploads.value.length,
    visibleCount: visibleItems.value.length,
    unseenCount: selection.queueState.unseenCount,
    recycleCount: selection.queueState.recycleCount,
    removingCount: fadingCount.value + agingCount.value,
    enteringCount: enteringCount.value,
    nextCandidateId: selection.upload?.id ?? null,
    lastTransition: lastProgressReason.value,
  })

  if (!selection.upload) {
    return {
      type: 'wait',
      engineState: 'READY',
      reason: 'wait - no insert candidate available',
      delayMs: Math.max(POLAROID_CONFIG.timing.entryRetryDelayMs, getNextExitEligibilityDelayMs(now)),
      selection,
    }
  }

  logSlideshowDebug('TRY_INSERT', {
    currentEngineState: engineState,
    imageId: selection.upload.id,
    visibleCount: visibleItems.value.length,
    unseenCount: selection.queueState.unseenCount,
    recycleCount: selection.queueState.recycleCount,
    coverage: Number((getCurrentCoverage() * 100).toFixed(1)),
  })

  const placement = assessPlacementForNextItem(selection.upload)
  const placementSuccess = canInsertPlacement(placement)
  const cadenceRemainingMs = getRemainingVisibleInsertCadenceMs(now)
  if (placementSuccess) {
    if (!force && cadenceRemainingMs > 0) {
      return {
        type: 'wait',
        engineState: 'READY',
        reason: 'wait - insert cadence not reached',
        delayMs: cadenceRemainingMs,
        selection,
        placement,
        placementSuccess: true,
      }
    }

    lastViableSlotTimestamp.value = now
    return {
      type: 'insert',
      engineState: 'READY',
      reason: shownAtByIdentity.has(selection.upload.id) ? 'insert recycle candidate' : 'insert unseen candidate',
      delayMs: timings.value.spawnIntervalMs,
      selection,
      placement,
      placementSuccess: true,
    }
  }

  if (!force && !isInsertCadenceOverdue(now) && cadenceRemainingMs > timings.value.preExitLeadTimeMs) {
    return {
      type: 'wait',
      engineState: 'READY',
      reason: 'wait - pre-exit window not reached',
      delayMs: Math.max(
        cadenceRemainingMs - timings.value.preExitLeadTimeMs,
        POLAROID_CONFIG.timing.entryRetryDelayMs,
      ),
      selection,
      placement,
      placementSuccess: false,
    }
  }

  const exitCandidate = pickExitCandidate(force || isInsertCadenceOverdue(now))
  if (exitCandidate) {
    return {
      type: 'remove',
      engineState: 'READY',
      reason: isInsertCadenceOverdue(now)
        ? 'no slot - force remove oldest eligible visible image (interval overdue)'
        : 'no slot - remove oldest eligible visible image',
      delayMs: getNextLifecycleProgressDelayMs(now),
      selection,
      placement,
      exitCandidate,
      placementSuccess: false,
    }
  }

  return {
    type: 'wait',
    engineState: 'READY',
    reason: 'wait - remove not yet eligible',
    delayMs: Math.max(getNextExitEligibilityDelayMs(now), POLAROID_CONFIG.timing.entryRetryDelayMs),
    selection,
    placement,
    placementSuccess: false,
  }
}

function prepareSpawn(
  upload: UploadItem & { display_url: string },
  spawnDelay: number,
  preparedAt: number,
  layoutOverride?: ActivePolaroid['layout'],
  debugContext?: {
    reason: 'stage_not_full' | 'post_remove' | 'force_progress' | 'replace_during_fade'
    source: 'unseen' | 'recycle'
    coverageBefore: number
  },
) {
  clearPlacementFailure(upload.id)
  const item = createActiveItem(upload, preparedAt, layoutOverride)
  const normalizedDelayMs = Math.max(0, Math.round(spawnDelay))
  pendingSpawn.value = {
    item,
    preparedAt,
    spawnAt: preparedAt + normalizedDelayMs,
    delayMs: normalizedDelayMs,
  }
  insertMetrics.set(item.instanceId, {
    preparedAt,
    reason: debugContext?.reason,
    source: debugContext?.source,
    coverageBefore: debugContext?.coverageBefore,
  })
  logInsert('prepared', item.instanceId, {
    spawnDelay: normalizedDelayMs,
    phase: currentPhase.value,
  })

  pendingSpawnTimer = window.setTimeout(() => {
    pendingSpawnTimer = null
    mountPendingSpawn(item.instanceId)
  }, normalizedDelayMs)
  runAccountingCheck('prepare-spawn')
}

function mountPendingSpawn(instanceId: string) {
  const candidate = pendingSpawn.value
  if (!candidate || candidate.item.instanceId !== instanceId) {
    return
  }

  const mountedAt = nowMs()
  visibleItems.value = [...visibleItems.value, candidate.item]
  pendingSpawn.value = null
  markStageMutation('mount')

  const metric = insertMetrics.get(instanceId)
  if (metric) {
    metric.mountedAt = mountedAt
  }
  lastInsertTimestamp.value = mountedAt
  syncBuildCompletionReason(mountedAt)
  recordBuildProgress('insert-mounted', mountedAt)
  logInsert('mounted', instanceId, {
    prepareToMountMs: metric ? Math.round(mountedAt - metric.preparedAt) : undefined,
  })
  logInsertEvent(candidate.item, metric)
  logFreshnessHierarchy('insert-mounted')

  armEntryActivation(instanceId)
  ensureScheduler(false)
}

function armEntryActivation(instanceId: string) {
  cancelActivationFrames()
  activationRafA = window.requestAnimationFrame(() => {
    activationRafA = null
    activationRafB = window.requestAnimationFrame(() => {
      activationRafB = null
      activateEntry(instanceId)
    })
  })
}

function activateEntry(instanceId: string) {
  const activatedAt = nowMs()
  const activatedItem = updateVisibleItem(instanceId, (item) => ({
    ...item,
    entryActivatedAt: activatedAt,
    visibleSince: activatedAt,
    lifecycleStatus: 'entering',
  }))

  if (!activatedItem) {
    return
  }

  activeEntryInstanceId = instanceId
  const shownIdentity = getImageIdentity(activatedItem)
  shownAtByIdentity.set(shownIdentity, activatedAt)
  pushRecentHistory(shownIdentity)
  if (!POLAROID_CONFIG.debug.disableFlash) {
    createFlash(activatedItem)
  }

  const metric = insertMetrics.get(instanceId)
  if (metric) {
    metric.activatedAt = activatedAt
  }
  logInsert('activated', instanceId, {
    prepareToEntryMs: metric ? Math.round(activatedAt - metric.preparedAt) : undefined,
    mountToEntryMs: metric?.mountedAt ? Math.round(activatedAt - metric.mountedAt) : undefined,
  })

  recordVisibleInsertCadence(activatedAt)
  markStageMutation('activate')
  scheduleLifecycle(activatedItem)
}

function scheduleLifecycle(item: ActivePolaroid) {
  clearItemTimers(item.instanceId)
  const now = nowMs()

  if (item.lifecycleStatus === 'pre_enter' || item.lifecycleStatus === 'entering') {
    const remainingEntryMs = Math.max(0, item.entryMotion.durationMs - (now - item.enteredAt))
    if (remainingEntryMs <= 0) {
      completeEntry(item.instanceId)
      return
    }

    addItemTimer(
      item.instanceId,
      window.setTimeout(() => {
        completeEntry(item.instanceId)
      }, remainingEntryMs),
    )
    return
  }

  if (item.lifecycleStatus === 'visible_aging') {
    const ageStartedAt = item.ageStartedAt ?? now
    const agingElapsedMs = Math.max(0, now - ageStartedAt)
    const agingWindowMs = Math.max(item.timings.agingDurationMs, 1)
    applyAgingToneSnapshot(item.instanceId, agingElapsedMs, agingWindowMs)

    if (agingElapsedMs >= agingWindowMs) {
      startFadeOut(item.instanceId)
      return
    }

    const thresholds = getPolaroidAgingThresholds(agingWindowMs)
    scheduleToneStageUpdate(item.instanceId, ageStartedAt, agingElapsedMs, thresholds.deepStartMs, 'deep')
    scheduleToneStageUpdate(item.instanceId, ageStartedAt, agingElapsedMs, thresholds.finalStartMs, 'final')
    addItemTimer(
      item.instanceId,
      window.setTimeout(() => {
        startFadeOut(item.instanceId)
      }, Math.max(0, agingWindowMs - agingElapsedMs)),
    )
    return
  }

  if (item.lifecycleStatus === 'fading_out') {
    const fadeStartedAt = item.fadeStartedAt ?? now
    const remainingFadeMs = Math.max(0, item.timings.exitDurationMs - (now - fadeStartedAt))
    if (remainingFadeMs <= 0) {
      removeFadedItem(item.instanceId)
      return
    }

    addItemTimer(
      item.instanceId,
      window.setTimeout(() => {
        removeFadedItem(item.instanceId)
      }, remainingFadeMs),
    )
  }
}

function completeEntry(instanceId: string) {
  const now = nowMs()
  const completedItem = updateVisibleItem(instanceId, (item) => ({
    ...item,
    lifecycleStatus: 'visible_fresh',
    toneStage: 'fresh',
    visibleSince: item.visibleSince ?? item.entryActivatedAt ?? now,
    ageStartedAt: null,
    fadeStartedAt: null,
  }))

  if (!completedItem) {
    return
  }

  if (activeEntryInstanceId === instanceId) {
    activeEntryInstanceId = null
  }

  logInsert('entry-complete', instanceId, {
    activeEntering: activeEntryInstanceId ? 1 : 0,
  })
  logFreshnessHierarchy('entry-complete')
  markStageMutation('entry-complete')
  ensureScheduler(false)
}

function startAgingCycle(instanceId: string) {
  const now = nowMs()
  const current = visibleItems.value.find((item) => item.instanceId === instanceId)
  const removalTimings = current ? getActiveRemovalTimings(current.timings) : timings.value
  const agingItem = updateVisibleItem(instanceId, (item) => ({
    ...item,
    timings: removalTimings,
    lifecycleStatus: 'visible_aging',
    toneStage: 'soft',
    ageStartedAt: now,
    fadeStartedAt: null,
    agingElapsedMs: 0,
    agingResumedAt: null,
  }))

  if (!agingItem) {
    return false
  }

  logAgingDecision(true)
  logAgingStart(agingItem, now)
  logFreshnessHierarchy('aging-start')
  markStageMutation('aging-start')
  scheduleLifecycle(agingItem)
  return true
}

function startFadeOut(instanceId: string) {
  const now = nowMs()
  const current = visibleItems.value.find((item) => item.instanceId === instanceId)
  const fadingItem = updateVisibleItem(instanceId, (item) => ({
    ...item,
    lifecycleStatus: 'fading_out',
    toneStage: 'final',
    fadeStartedAt: now,
  }))

  if (!fadingItem) {
    return false
  }

  if (current) {
    logRemoveStart(current, now, 'stage_full_rotation')
  }
  markStageMutation('fade-start')
  if (current) {
    prepareReplacementDuringFade(current, now)
  }
  scheduleLifecycle(fadingItem)
  return true
}

function removeFadedItem(instanceId: string) {
  const current = visibleItems.value.find((item) => item.instanceId === instanceId)
  if (!current) {
    return false
  }

  const freshness = getFreshnessEntry(current)
  const coverageBefore = getCurrentCoverage()
  const removedAt = nowMs()
  clearItemTimers(instanceId)
  if (activeEntryInstanceId === instanceId) {
    activeEntryInstanceId = null
  }

  visibleItems.value = visibleItems.value.filter((item) => item.instanceId !== instanceId)
  removedAtByIdentity.set(getImageIdentity(current), removedAt)
  insertMetrics.delete(instanceId)
  awaitingReplacementAfterRemoval.value = false
  removedImagesCount.value += 1
  lastRemoveTimestamp.value = removedAt
  logRemoveDone(current, freshness, coverageBefore, getCurrentCoverage(), removedAt, 'stage_full_rotation')
  logFreshnessHierarchy('remove-done')
  markStageMutation('fade-complete')
  logSlideshowDebug('REMOVE_COMPLETE_INSERT_NEXT', {
    removedImageId: current.uploadId,
    nextCandidateId: selectNextUpload(removedAt).upload?.id ?? null,
    currentEngineState: currentEngineState.value,
  })
  rebaseScheduler(true)
  return true
}

function prepareReplacementDuringFade(exitingItem: ActivePolaroid, now: number) {
  if (pendingSpawn.value != null || activeEntryInstanceId != null || enteringCount.value > 0) {
    return false
  }

  const selection = selectNextUpload(now)
  if (!selection.upload) {
    return false
  }

  commitSelection(selection)
  const spawnDelayMs = Math.max(
    POLAROID_CONFIG.timing.spawnDelayAfterExitStartMs,
    getRemainingVisibleInsertCadenceMs(now),
  )
  prepareSpawn(
    selection.upload,
    spawnDelayMs,
    now,
    exitingItem.layout,
    {
      reason: 'replace_during_fade',
      source: shownAtByIdentity.has(selection.upload.id) ? 'recycle' : 'unseen',
      coverageBefore: getCurrentCoverage(),
    },
  )
  logSlideshowDebug('INSERT_DURING_FADE_PREPARED', {
    selectedInsertImageId: selection.upload.id,
    removeTargetId: exitingItem.uploadId,
    spawnDelayMs,
    source: shownAtByIdentity.has(selection.upload.id) ? 'recycle' : 'unseen',
  })
  return true
}

function scheduleToneStageUpdate(
  instanceId: string,
  ageStartedAt: number,
  agingElapsedMs: number,
  targetMs: number,
  toneStage: ActivePolaroid['toneStage'],
) {
  const remainingMs = Math.max(0, targetMs - agingElapsedMs)
  if (remainingMs <= 0) {
    updateVisibleItem(instanceId, (item) =>
      item.lifecycleStatus === 'visible_aging' && item.toneStage !== toneStage
        ? { ...item, toneStage }
        : item,
    )
    return
  }

  addItemTimer(
    instanceId,
    window.setTimeout(() => {
      const item = visibleItems.value.find((entry) => entry.instanceId === instanceId)
      if (!item || item.lifecycleStatus !== 'visible_aging' || item.ageStartedAt !== ageStartedAt) {
        return
      }
      updateVisibleItem(instanceId, (current) => ({
        ...current,
        toneStage,
      }))
      markStageMutation(`aging-tone-${toneStage}`)
    }, remainingMs),
  )
}

function applyAgingToneSnapshot(instanceId: string, agingElapsedMs: number, agingWindowMs: number) {
  const computedToneStage = getToneStageForElapsed(agingElapsedMs, agingWindowMs)
  const toneStage = computedToneStage === 'fresh' ? 'soft' : computedToneStage

  updateVisibleItem(instanceId, (item) =>
    item.lifecycleStatus === 'visible_aging' && item.toneStage !== toneStage
      ? { ...item, toneStage }
      : item,
  )
}

function getToneStageForElapsed(elapsedMs: number, agingWindowMs: number) {
  const agingThresholds = getPolaroidAgingThresholds(agingWindowMs)

  if (elapsedMs >= agingThresholds.finalStartMs) {
    return 'final'
  }
  if (elapsedMs >= agingThresholds.deepStartMs) {
    return 'deep'
  }
  if (elapsedMs >= agingThresholds.softStartMs) {
    return 'soft'
  }
  return 'fresh'
}

function syncUploads(nextUploads: Array<UploadItem & { display_url: string }>) {
  const previousVisibleCount = visibleItems.value.length
  const now = nowMs()
  const nextIds = new Set(nextUploads.map((upload) => upload.id))
  const nextById = new Map(nextUploads.map((upload) => [upload.id, upload]))

  visibleItems.value = syncItemSources(visibleItems.value, nextById)

  if (pendingSpawn.value) {
    const pendingUpload = nextById.get(pendingSpawn.value.item.uploadId)
    if (!pendingUpload) {
      cancelPendingSpawn()
    } else {
      pendingSpawn.value = {
        ...pendingSpawn.value,
        item: {
          ...pendingSpawn.value.item,
          src: pendingUpload.display_url,
          alt: pendingUpload.filename_original,
          timings: timings.value,
        },
      }
    }
  }

  const newIds = nextUploads.map((upload) => upload.id).filter((uploadId) => !knownPoolIds.has(uploadId))
  if (newIds.length) {
    priorityQueue = dedupeQueue([...newIds, ...priorityQueue])
    for (const uploadId of newIds) {
      if (!queuedAtByIdentity.has(uploadId)) {
        queuedAtByIdentity.set(uploadId, now)
      }
    }
  }

  knownPoolIds = nextIds
  priorityQueue = priorityQueue.filter((identity) => nextIds.has(identity))
  recentHistory = recentHistory.filter((identity) => nextIds.has(identity))
  for (const identity of [...removedAtByIdentity.keys()]) {
    if (!nextIds.has(identity)) {
      removedAtByIdentity.delete(identity)
    }
  }
  for (const identity of [...shownAtByIdentity.keys()]) {
    if (!nextIds.has(identity)) {
      shownAtByIdentity.delete(identity)
    }
  }
  for (const identity of [...queuedAtByIdentity.keys()]) {
    if (!nextIds.has(identity) || !priorityQueue.includes(identity)) {
      queuedAtByIdentity.delete(identity)
    }
  }
  for (const identity of [...placementAttemptsByIdentity.keys()]) {
    if (!nextIds.has(identity)) {
      placementAttemptsByIdentity.delete(identity)
    }
  }
  for (const identity of [...failedPlacementReasonByIdentity.keys()]) {
    if (!nextIds.has(identity)) {
      failedPlacementReasonByIdentity.delete(identity)
    }
  }

  if (rotationStartedAt.value != null && visibleItems.value.length < previousVisibleCount) {
    awaitingReplacementAfterRemoval.value = true
  }

  if (newIds.length) {
    recordBuildProgress('uploads-queued', now)
  }
  syncBuildCompletionReason(now)

  refreshActiveTimings()
  reconcileVisibleCount()
  markStageMutation('uploads-sync')
  ensureScheduler(stackLoad.value === 0)
}

function createActiveItem(
  upload: UploadItem & { display_url: string },
  preparedAt: number,
  layoutOverride?: ActivePolaroid['layout'],
): ActivePolaroid {
  instanceCounter += 1
  orderCounter += 1
  const motionSeed = ((upload.id * 37 + instanceCounter * 17) % 997) / 997
  const layout =
    layoutOverride ??
    buildPolaroidLayout(
      stageSize.value,
      getOccupiedLayouts(),
      targetVisibleCount.value,
      (upload.id * 0.137 + instanceCounter * 0.271) % 1,
    )

  const item: ActivePolaroid = {
    instanceId: `polaroid-${upload.id}-${instanceCounter}`,
    uploadId: upload.id,
    src: upload.display_url,
    alt: upload.filename_original,
    caption: upload.comment,
    enteredAt: preparedAt,
    entryActivatedAt: null,
    timings: timings.value,
    order: orderCounter,
    motionSeed,
    layout,
    entryMotion: buildPolaroidEntryMotion(stageSize.value, layout, motionSeed),
    agingElapsedMs: 0,
    agingResumedAt: null,
    visibleSince: null,
    ageStartedAt: null,
    fadeStartedAt: null,
    lifecycleStatus: 'pre_enter',
    toneStage: 'fresh',
  }

  validatePolaroidGeometry(item, 'create')
  return item
}

function validatePolaroidGeometry(item: ActivePolaroid, context: string) {
  const expected = getPolaroidDimensions(stageSize.value, effectiveVisibleCount.value)
  const widthMismatch = Math.abs(item.layout.width - expected.width) > 0.5
  const heightMismatch = Math.abs(item.layout.height - expected.height) > 0.5
  const scaleMismatch = Math.abs(item.layout.scale - 1) > 0.0001

  if (!widthMismatch && !heightMismatch && !scaleMismatch) {
    return
  }

  console.warn('[polaroid-size] geometry mismatch', {
    context,
    instanceId: item.instanceId,
    uploadId: item.uploadId,
    width: item.layout.width,
    expectedWidth: expected.width,
    height: item.layout.height,
    expectedHeight: expected.height,
    scale: item.layout.scale,
  })
}

function createFlash(item: ActivePolaroid) {
  flashCounter += 1
  const flash: PolaroidFlash = {
    id: `flash-${flashCounter}`,
    x: item.layout.x,
    y: item.layout.y,
    width: item.layout.width,
    height: item.layout.height,
  }

  flashes.value = [...flashes.value, flash]
  const timer = window.setTimeout(() => {
    flashes.value = flashes.value.filter((entry) => entry.id !== flash.id)
    const flashTimer = flashTimers.get(flash.id)
    if (flashTimer != null) {
      window.clearTimeout(flashTimer)
      flashTimers.delete(flash.id)
    }
  }, item.timings.flashDurationMs)
  flashTimers.set(flash.id, timer)
}

function syncItemSources(
  items: ActivePolaroid[],
  nextById: Map<number, UploadItem & { display_url: string }>,
) {
  return items.flatMap((item) => {
    const upload = nextById.get(item.uploadId)
    if (!upload) {
      clearItemTimers(item.instanceId)
      insertMetrics.delete(item.instanceId)
      return []
    }
    if (upload.display_url === item.src && upload.filename_original === item.alt) {
      return [item]
    }
    return [
      {
        ...item,
        src: upload.display_url,
        alt: upload.filename_original,
      },
    ]
  })
}

function selectNextUpload(now = nowMs()): TickSelection {
  return pickNextImage({
    pool: availableUploads.value,
    priorityQueue,
    nextCursor,
    blockedIdentities: getOccupiedIdentities(),
    recentHistory,
    removedAtByIdentity,
    shownAtByIdentity,
    now,
    maxVisiblePhotos: effectiveVisibleCount.value,
  })
}

function commitSelection(selection: TickSelection) {
  if (selection.upload) {
    queuedAtByIdentity.delete(selection.upload.id)
  }
  priorityQueue = selection.nextPriorityQueue
  nextCursor = selection.nextCursor
  runAccountingCheck('selection-commit')
}

function deferSelection(selection: TickSelection) {
  if (!selection.upload) {
    return
  }

  const selectedId = selection.upload.id
  if (priorityQueue.includes(selectedId)) {
    priorityQueue = [...priorityQueue.filter((identity) => identity !== selectedId), selectedId]
    runAccountingCheck('selection-defer-priority')
    return
  }

  nextCursor = selection.nextCursor
  runAccountingCheck('selection-defer-cursor')
}

function prioritizeUpload(uploadId: number) {
  priorityQueue = dedupeQueue([uploadId, ...priorityQueue])
  if (!queuedAtByIdentity.has(uploadId)) {
    queuedAtByIdentity.set(uploadId, nowMs())
  }
  runAccountingCheck('selection-prioritize')
}

function handleImageError(instanceId: string) {
  const brokenItem =
    visibleItems.value.find((item) => item.instanceId === instanceId) ??
    (pendingSpawn.value?.item.instanceId === instanceId ? pendingSpawn.value.item : null)

  if (!brokenItem) {
    return
  }

  brokenUploadIds.value = new Set([...brokenUploadIds.value, brokenItem.uploadId])
  clearItemTimers(instanceId)
  insertMetrics.delete(instanceId)

  if (activeEntryInstanceId === instanceId) {
    activeEntryInstanceId = null
  }

  const wasVisible = visibleItems.value.some((item) => item.instanceId === instanceId)
  visibleItems.value = visibleItems.value.filter((item) => item.instanceId !== instanceId)

  if (pendingSpawn.value?.item.instanceId === instanceId) {
    cancelPendingSpawn()
  }

  if (rotationStartedAt.value != null && wasVisible) {
    awaitingReplacementAfterRemoval.value = true
  }

  markStageMutation('image-error')
  rebaseScheduler(true)
}

function syncStageSize() {
  const bounds = stageRef.value?.getBoundingClientRect()
  const nextSize = {
    width: Math.max(Math.round(bounds?.width ?? window.innerWidth), 320),
    height: Math.max(Math.round(bounds?.height ?? window.innerHeight), 320),
  }

  if (nextSize.width === stageSize.value.width && nextSize.height === stageSize.value.height) {
    return
  }

  stageSize.value = nextSize
  visibleItems.value = visibleItems.value.map((item) => {
    const layout = rebasePolaroidLayout(item.layout, nextSize, effectiveVisibleCount.value)
    const nextItem = {
      ...item,
      layout,
      entryMotion: buildPolaroidEntryMotion(nextSize, layout, item.motionSeed),
    }
    validatePolaroidGeometry(nextItem, 'resize-visible')
    return nextItem
  })
  if (pendingSpawn.value) {
    const layout = rebasePolaroidLayout(pendingSpawn.value.item.layout, nextSize, effectiveVisibleCount.value)
    const nextItem = {
      ...pendingSpawn.value.item,
      layout,
      entryMotion: buildPolaroidEntryMotion(nextSize, layout, pendingSpawn.value.item.motionSeed),
    }
    validatePolaroidGeometry(nextItem, 'resize-pending')
    pendingSpawn.value = {
      ...pendingSpawn.value,
      item: nextItem,
    }
  }

  refreshVisibleLifecycleSchedules()
  markStageMutation('resize')
}

function refreshActiveTimings() {
  visibleItems.value = visibleItems.value.map((item) => ({
    ...item,
    timings: timings.value,
  }))
  refreshVisibleLifecycleSchedules()

  if (pendingSpawn.value) {
    const rebasedLayout = rebasePolaroidLayout(
      pendingSpawn.value.item.layout,
      stageSize.value,
      effectiveVisibleCount.value,
    )
    pendingSpawn.value = {
      ...pendingSpawn.value,
      item: {
        ...pendingSpawn.value.item,
        timings: timings.value,
        layout: rebasedLayout,
        entryMotion: buildPolaroidEntryMotion(stageSize.value, rebasedLayout, pendingSpawn.value.item.motionSeed),
      },
    }
  }
}

function refreshVisibleLifecycleSchedules() {
  for (const item of visibleItems.value) {
    scheduleLifecycle(item)
  }
}

function reconcileVisibleCount() {
  if (pendingSpawn.value && stackLoad.value >= stageCapacity.value.safetyMaxItems) {
    cancelPendingSpawn()
  }

  while (visibleItems.value.length > stageCapacity.value.safetyMaxItems) {
    const overflowCandidate = visibleItems.value
      .filter((item) => item.lifecycleStatus === 'visible_fresh')
      .sort((left, right) => {
        const leftFreshness = getFreshnessEntry(left)
        const rightFreshness = getFreshnessEntry(right)

        if (leftFreshness.isTopFresh !== rightFreshness.isTopFresh) {
          return Number(leftFreshness.isTopFresh) - Number(rightFreshness.isTopFresh)
        }
        if (leftFreshness.freshnessRank !== rightFreshness.freshnessRank) {
          return rightFreshness.freshnessRank - leftFreshness.freshnessRank
        }
        return left.enteredAt - right.enteredAt
      })[0]

    if (!overflowCandidate) {
      break
    }

    const freshness = getFreshnessEntry(overflowCandidate)
    const coverageBefore = getCurrentCoverage()
    const removedAt = nowMs()
    clearItemTimers(overflowCandidate.instanceId)
    visibleItems.value = visibleItems.value.filter((item) => item.instanceId !== overflowCandidate.instanceId)
    removedAtByIdentity.set(getImageIdentity(overflowCandidate), removedAt)
    removedImagesCount.value += 1
    lastRemoveTimestamp.value = removedAt
    logRemoveStart(overflowCandidate, removedAt, 'overflow_control')
    logRemoveDone(overflowCandidate, freshness, coverageBefore, getCurrentCoverage(), removedAt, 'overflow_control')
    logFreshnessHierarchy('overflow-remove')
  }
}

function ensureScheduler(immediateWhenEmpty: boolean) {
  if (props.paused || !availableUploads.value.length) {
    clearSchedulerTimer()
    nextTickAt = null
    return
  }

  if (nextTickAt == null) {
    nextTickAt = nowMs() + getInitialTickDelay(immediateWhenEmpty)
  }
  scheduleSchedulerAction()
}

function rebaseScheduler(forceImmediateTick: boolean) {
  clearSchedulerTimer()
  if (props.paused || !availableUploads.value.length) {
    nextTickAt = null
    return
  }

  const now = nowMs()
  const remainingMs = nextTickAt == null ? getInitialTickDelay(stackLoad.value === 0) : Math.max(0, nextTickAt - now)
  nextTickAt = forceImmediateTick
    ? now
    : now + (stackLoad.value === 0 ? getInitialTickDelay(false) : Math.min(remainingMs, getInitialTickDelay(false)))
  scheduleSchedulerAction()
}

function scheduleRetry(now: number, delayMs?: number) {
  const retryDelayMs = delayMs ?? POLAROID_CONFIG.stageCapacity.exitRetryDelayMs
  nextTickAt = now + Math.max(retryDelayMs, POLAROID_CONFIG.timing.entryRetryDelayMs)
  scheduleSchedulerAction()
}

function scheduleSchedulerAction() {
  clearSchedulerTimer()
  if (props.paused || !availableUploads.value.length) {
    return
  }

  const now = nowMs()
  if (nextTickAt == null) {
    nextTickAt = now + getInitialTickDelay(stackLoad.value === 0)
  }
  if (nextTickAt != null && nextTickAt <= now) {
    runSchedulerTick(false)
    return
  }

  schedulerTimer = window.setTimeout(() => {
    schedulerTimer = null
    runSchedulerTick(false)
  }, Math.max(0, Math.round((nextTickAt ?? now) - now)))
}

function getInitialTickDelay(immediateWhenEmpty: boolean) {
  if (stackLoad.value === 0) {
    return immediateWhenEmpty ? 0 : POLAROID_CONFIG.timing.entryRetryDelayMs
  }

  if (currentEngineState.value !== 'READY') {
    return getNextLifecycleProgressDelayMs()
  }
  return timings.value.spawnIntervalMs
}

function advanceSchedulerTick(now: number, force: boolean) {
  const baseTickAt = force ? now : nextTickAt ?? now
  let candidateTickAt = baseTickAt + timings.value.spawnIntervalMs
  while (candidateTickAt <= now) {
    candidateTickAt += timings.value.spawnIntervalMs
  }
  nextTickAt = candidateTickAt
  scheduleSchedulerAction()
}

function armFreezeFailsafe() {
  clearFreezeFailsafe()
  freezeFailsafeTimer = window.setTimeout(() => {
    freezeFailsafeTimer = null
    checkFreezeFailsafe()
    armFreezeFailsafe()
  }, POLAROID_CONFIG.timing.freezeCheckIntervalMs)
}

function clearFreezeFailsafe() {
  if (freezeFailsafeTimer != null) {
    window.clearTimeout(freezeFailsafeTimer)
    freezeFailsafeTimer = null
  }
}

function checkFreezeFailsafe() {
  if (props.paused || !availableUploads.value.length) {
    return
  }

  const now = nowMs()
  if (recoverStaleInsertState(now)) {
    return
  }
  if (advanceExitPipeline(now, true)) {
    return
  }
  const accounting = buildAccountingSnapshot(now)
  const stalledForMs = now - lastStageMutationAt.value
  const noProgressRunning =
    pendingSpawn.value == null &&
    activeEntryInstanceId == null &&
    getActiveExitFlowItem() == null &&
    enteringCount.value === 0

  if (
    stalledForMs < POLAROID_CONFIG.timing.freezeTimeoutMs ||
    !noProgressRunning ||
    (!hasUnshownImages() && shownAtByIdentity.size === 0)
  ) {
    return
  }

  logSlideshowDebug('FREEZE_DETECTED', {
    timeSinceLastProgress: Math.round(stalledForMs),
    visibleCount: accounting.summary.visible + accounting.summary.aging,
    unseenCount: accounting.summary.unseen,
    fadingCount: accounting.summary.fading,
    enteringCount: accounting.summary.entering,
    stageCoverage: Number((getCurrentCoverage() * 100).toFixed(1)),
    ...getProgressTimestamps(),
  })
  logSlideshowDebug('FREEZE_RECOVERY_TRIGGERED', {
    decision: 'freeze_recovery',
    currentEngineState: currentEngineState.value,
    timeSinceLastProgress: Math.round(stalledForMs),
    visibleCount: accounting.summary.visible + accounting.summary.aging,
    unseenCount: accounting.summary.unseen,
    fadingCount: accounting.summary.fading,
  })
  rebaseScheduler(true)
}

function maybeActivateRotation(now: number, reason: string) {
  if (rotationStartedAt.value != null) {
    return false
  }

  if (!isRotationAllowed(now)) {
    logRotationBlockedLowCoverage(reason, now)
    return false
  }

  if (getCurrentCoverage() < stageCapacity.value.rotationStartCoverage) {
    return false
  }

  return activateRotation(now, reason)
}

function activateRotation(now: number, reason: string) {
  if (rotationStartedAt.value != null) {
    return false
  }

  if (!isRotationAllowed(now)) {
    logRotationBlockedLowCoverage(reason, now)
    return false
  }

  rotationStartedAt.value = now
  const accounting = buildAccountingSnapshot(now)
  if (reason.includes('build-')) {
    logSlideshowDebug('ROTATION_STARTED_FROM_STALL', {
      reason,
      queuedCount: accounting.summary.queued,
      effectiveBuildCompleteReason: getEffectiveBuildCompleteReason(now),
      buildProgressAgeMs: Math.round(getBuildProgressAgeMs(now)),
      queuedOldestAgeMs: Math.round(getQueuedOldestAgeMs(now)),
      placementAttemptsSinceLastInsert: buildPlacementAttemptsSinceLastInsert.value,
      lastFailedInsertReason: lastFailedInsertReason.value,
    })
  }
  logSlideshowDebug('DECISION', {
    decision: 'start_rotation',
    reason,
    coverage: Number((getCurrentCoverage() * 100).toFixed(1)),
    minRotationCoverage: Number((getMinRotationCoverage() * 100).toFixed(1)),
    rotationAllowed: isRotationAllowed(now),
    visibleCount: accounting.summary.visible + accounting.summary.aging,
    availableCount: accounting.summary.totalUploads,
    unseenCount: accounting.summary.unseen,
    fadingCount: accounting.summary.fading,
  })
  recordBuildProgress(`rotation-start:${reason}`, now)
  markStageMutation('rotation-start')
  logAgingDecision(true)
  return true
}

function hasUnshownImages() {
  return availableUploads.value.some((upload) => !shownAtByIdentity.has(upload.id))
}

function shouldFallbackToRotation(
  selection: TickSelection,
  placement?: ReturnType<typeof assessPlacementForNextItem>,
) {
  if (rotationStartedAt.value != null) {
    return false
  }

  const coverage = getCurrentCoverage()
  const stableTargetCount = getStableVisibleTargetCount()
  const buildBlocked = !selection.upload || (placement != null && !canInsertDuringBuild(placement))

  return (
    isRotationAllowed() &&
    buildBlocked &&
    coverage >= stageCapacity.value.sustainCoverageFloor &&
    visibleItems.value.length >= Math.max(stageCapacity.value.minBuildCount, stableTargetCount - 1)
  )
}

function getBuildAbortReason(
  now: number,
  selection: TickSelection,
  placement?: ReturnType<typeof assessPlacementForNextItem>,
) {
  if (rotationStartedAt.value != null) {
    return null
  }

  const accounting = buildAccountingSnapshot(now)
  const queuedCount = accounting.summary.queued
  const noBuildActivity =
    pendingSpawn.value == null &&
    enteringCount.value === 0 &&
    fadingCount.value === 0 &&
    getActiveExitFlowItem() == null &&
    accounting.summary.blocked + accounting.summary.failedPlacement + accounting.summary.cooldown === 0

  const buildProgressAgeMs = getBuildProgressAgeMs(now)
  const noViableQueuedSlot =
    queuedCount > 0 &&
    (!selection.upload ||
      (getQueuedIdentities().has(selection.upload.id) && placement != null && !canInsertDuringBuild(placement)))

  if (canUnlockRotationFromBuildStall(now, selection, placement)) {
    return queuedCount <= 3 ? 'build-stalled-no-slot-final-queue' : 'build-complete-due-no-slot'
  }

  if (!isRotationAllowedByDensity()) {
    if (queuedCount > 0 && (buildPlacementAttemptsSinceLastInsert.value > 0 || buildProgressAgeMs >= BUILD_STALL_TIMEOUT_MS)) {
      logRotationBlockedLowCoverage('build-abort-blocked-low-coverage', now)
    }
    return null
  }

  if (getCurrentCoverage() >= stageCapacity.value.targetCoverage) {
    return 'build-target-coverage-reached'
  }

  if (queuedCount > 0 && buildProgressAgeMs >= BUILD_STALL_TIMEOUT_MS && noBuildActivity) {
    return 'build-stalled-no-progress'
  }

  if (noViableQueuedSlot && buildPlacementAttemptsSinceLastInsert.value >= BUILD_ABORT_RETRY_THRESHOLD) {
    return 'build-no-viable-slot-after-retries'
  }

  if (queuedCount > 0 && getQueuedOldestAgeMs(now) >= BUILD_STALL_TIMEOUT_MS && noViableQueuedSlot) {
    return 'build-queued-timeout-no-slot'
  }

  return null
}

function logBuildAbortToRotation(
  now: number,
  reason: string,
  selection: TickSelection,
  placement?: ReturnType<typeof assessPlacementForNextItem>,
) {
  const accounting = buildAccountingSnapshot(now)
  const payload = {
    reason,
    coverage: Number((getCurrentCoverage() * 100).toFixed(1)),
    minRotationCoverage: Number((getMinRotationCoverage() * 100).toFixed(1)),
    targetCoverage: Number((stageCapacity.value.targetCoverage * 100).toFixed(1)),
    rotationAllowed: isRotationAllowed(now),
    buildAllowed: currentPhase.value === 'build',
    queuedCount: accounting.summary.queued,
    buildProgressAgeMs: Math.round(getBuildProgressAgeMs(now)),
    queuedOldestAgeMs: Math.round(getQueuedOldestAgeMs(now)),
    placementAttemptsSinceLastInsert: buildPlacementAttemptsSinceLastInsert.value,
    lastBuildProgressReason: lastBuildProgressReason.value,
    lastFailedInsertReason: lastFailedInsertReason.value,
    effectiveBuildCompleteReason: getEffectiveBuildCompleteReason(now),
    stalledRetryThreshold: BUILD_ABORT_RETRY_THRESHOLD,
    lastViableSlotTimestamp: lastViableSlotTimestamp.value == null ? null : Math.round(lastViableSlotTimestamp.value),
    selectedInsertImageId: selection.upload?.id ?? null,
    placementScore: placement?.score ?? null,
    placementOverlap: placement?.maxOverlapRatio ?? null,
  }

  logSlideshowDebug('BUILD_STALLED', payload)
  logSlideshowDebug('BUILD_ABORTED_TO_ROTATION', payload)
}

function getStableVisibleTargetCount() {
  if (!availableUploads.value.length) {
    return 0
  }

  return Math.min(
    Math.max(stageCapacity.value.minBuildCount, stageCapacity.value.minStableVisibleCount),
    availableUploads.value.length,
    stageCapacity.value.safetyMaxItems,
  )
}

function getActiveExitFlowItem() {
  return visibleItems.value.find(
    (item) => item.lifecycleStatus === 'visible_aging' || item.lifecycleStatus === 'fading_out',
  ) ?? null
}

function assessPlacementForNextItem(upload: UploadItem & { display_url: string }) {
  return assessPolaroidPlacement(
    stageSize.value,
    getOccupiedLayouts(),
    targetVisibleCount.value,
    (upload.id * 0.137 + (instanceCounter + 1) * 0.271) % 1,
  )
}

function canInsertPlacement(placement: ReturnType<typeof assessPlacementForNextItem>) {
  const overlapLimit = POLAROID_CONFIG.layout.overlapTolerance
  if (stackLoad.value >= stageCapacity.value.safetyMaxItems) {
    return false
  }

  const overlapMultiplier = visibleItems.value.length < stageCapacity.value.minBuildCount ? 9.6 : 8.8
  const placementMultiplier = visibleItems.value.length < stageCapacity.value.minBuildCount ? 5.1 : 4.5
  return (
    placement.maxOverlapRatio <= overlapLimit * overlapMultiplier &&
    placement.score <= stageCapacity.value.hardPlacementScore * placementMultiplier &&
    placement.coverageAfter <= Math.min(stageCapacity.value.hardCoverage + 0.08, 1.08)
  )
}

function canInsertDuringBuild(placement: ReturnType<typeof assessPlacementForNextItem>) {
  return canInsertPlacement(placement)
}

function getCurrentCoverage() {
  return measureLayoutCoverage(stageSize.value, visibleItems.value.map((item) => item.layout))
}

function pickExitCandidate(ignoreMinVisibleHold: boolean) {
  const now = nowMs()
  const eligibleItems = visibleItems.value.filter((item) => isExitEligible(item, now, ignoreMinVisibleHold))

  if (!eligibleItems.length) {
    return null
  }

  const preferredItems = eligibleItems.filter((item) => !getFreshnessEntry(item).isTopFresh)
  const candidatePool = preferredItems.length ? preferredItems : eligibleItems

  let bestCandidate: ActivePolaroid | null = null
  let bestScore = Number.NEGATIVE_INFINITY

  for (const item of candidatePool) {
    const score = getExitPriorityScore(item, now)
    if (score > bestScore) {
      bestCandidate = item
      bestScore = score
    }
  }

  return bestCandidate
}

function isExitEligible(item: ActivePolaroid, now: number, ignoreMinVisibleHold: boolean) {
  if (item.lifecycleStatus !== 'visible_fresh') {
    return false
  }

  const visibleSince = item.visibleSince ?? item.entryActivatedAt ?? item.enteredAt
  if (!ignoreMinVisibleHold && now - visibleSince < getEffectiveMinVisibleHoldMs()) {
    return false
  }

  return true
}

function getExitPriorityScore(item: ActivePolaroid, now: number) {
  const freshness = getFreshnessEntry(item)
  const visibleAgeMs = now - (item.visibleSince ?? item.entryActivatedAt ?? item.enteredAt)
  const footprint = getLayoutFootprint(item.layout)
  const stageCenterX = stageSize.value.width * 0.5
  const stageCenterY = stageSize.value.height * 0.5
  const centerDistance = Math.hypot(item.layout.x - stageCenterX, item.layout.y - stageCenterY)
  const normalizedEdgeBias = clamp(centerDistance / Math.hypot(stageCenterX, stageCenterY), 0, 1)

  return (
    freshness.freshnessRank * 10_000 +
    visibleAgeMs +
    normalizedEdgeBias * 1_000 +
    item.order * 0.1 +
    (freshness.isTopFresh ? -1_000_000 : 0) +
    footprint.bottom * 0.01
  )
}

function getNextExitEligibilityDelayMs(now = nowMs()) {
  const effectiveMinVisibleHoldMs = getEffectiveMinVisibleHoldMs()
  const remainingHoldMs = visibleItems.value
    .filter((item) => item.lifecycleStatus === 'visible_fresh')
    .map((item) => {
      const visibleSince = item.visibleSince ?? item.entryActivatedAt ?? item.enteredAt
      return Math.max(0, effectiveMinVisibleHoldMs - (now - visibleSince))
    })
    .filter((remainingMs) => remainingMs > 0)

  if (!remainingHoldMs.length) {
    return timings.value.spawnIntervalMs
  }

  return Math.min(
    Math.max(Math.min(...remainingHoldMs), POLAROID_CONFIG.timing.entryRetryDelayMs),
    effectiveMinVisibleHoldMs,
  )
}

function getNextLifecycleProgressDelayMs(now = nowMs()) {
  const nextDelays: number[] = []

  for (const item of visibleItems.value) {
    if (item.lifecycleStatus === 'pre_enter' || item.lifecycleStatus === 'entering') {
      nextDelays.push(Math.max(0, item.entryMotion.durationMs - (now - item.enteredAt)))
      continue
    }

    if (item.lifecycleStatus === 'visible_aging') {
      const ageStartedAt = item.ageStartedAt ?? now
      const agingElapsedMs = Math.max(0, now - ageStartedAt)
      const agingWindowMs = Math.max(item.timings.agingDurationMs, 1)
      const thresholds = getPolaroidAgingThresholds(agingWindowMs)
      for (const thresholdMs of [thresholds.deepStartMs, thresholds.finalStartMs, agingWindowMs]) {
        const remainingMs = thresholdMs - agingElapsedMs
        if (remainingMs > 0) {
          nextDelays.push(remainingMs)
        }
      }
      continue
    }

    if (item.lifecycleStatus === 'fading_out') {
      const fadeStartedAt = item.fadeStartedAt ?? now
      nextDelays.push(Math.max(0, item.timings.exitDurationMs - (now - fadeStartedAt)))
    }
  }

  if (pendingSpawn.value) {
    nextDelays.push(POLAROID_CONFIG.timing.entryRetryDelayMs)
  }

  const positiveDelays = nextDelays.filter((delayMs) => delayMs > 0)
  if (!positiveDelays.length) {
    return POLAROID_CONFIG.timing.entryRetryDelayMs
  }

  return Math.max(Math.min(...positiveDelays), POLAROID_CONFIG.timing.entryRetryDelayMs)
}

function recoverStaleInsertState(now = nowMs()) {
  let recovered = false

  if (activeEntryInstanceId != null) {
    const activeEntryStillPresent = visibleItems.value.some(
      (item) =>
        item.instanceId === activeEntryInstanceId &&
        (item.lifecycleStatus === 'pre_enter' || item.lifecycleStatus === 'entering'),
    )

    if (!activeEntryStillPresent) {
      logSlideshowDebug('STALE_ACTIVE_ENTRY_RESET', {
        staleInstanceId: activeEntryInstanceId,
        visibleCount: visibleItems.value.length,
        enteringCount: enteringCount.value,
        currentEngineState: currentEngineState.value,
        lastTransition: lastProgressReason.value,
      })
      activeEntryInstanceId = null
      recovered = true
    }
  }

  const pending = pendingSpawn.value
  if (!pending) {
    if (recovered) {
      runAccountingCheck('recover-stale-active-entry')
    }
    return false
  }

  const pendingAgeMs = now - pending.preparedAt
  const pendingDeadline = pending.spawnAt + Math.max(PENDING_SPAWN_WATCHDOG_GRACE_MS, POLAROID_CONFIG.timing.entryRetryDelayMs)
  const pendingTimerMissing = pendingSpawnTimer == null
  const pendingOverdue = now >= pendingDeadline

  if (!pendingTimerMissing && !pendingOverdue) {
    if (recovered) {
      runAccountingCheck('recover-stale-active-entry')
    }
    return false
  }

  logSlideshowDebug('STALE_PENDING_SPAWN_RECOVERED', {
    pendingImageId: pending.item.uploadId,
    pendingInstanceId: pending.item.instanceId,
    pendingPreparedAt: pending.preparedAt,
    pendingSpawnAt: pending.spawnAt,
    pendingDelayMs: pending.delayMs,
    pendingAgeMs: Math.round(pendingAgeMs),
    pendingTimerMissing,
    pendingOverdue,
    currentEngineState: currentEngineState.value,
    lastTransition: lastProgressReason.value,
  })

  if (pendingSpawnTimer != null) {
    window.clearTimeout(pendingSpawnTimer)
    pendingSpawnTimer = null
  }

  mountPendingSpawn(pending.item.instanceId)
  return true
}

function updateVisibleItem(
  instanceId: string,
  updater: (item: ActivePolaroid) => ActivePolaroid,
) {
  let updatedItem: ActivePolaroid | null = null
  visibleItems.value = visibleItems.value.map((item) => {
    if (item.instanceId !== instanceId) {
      return item
    }
    updatedItem = updater(item)
    return updatedItem
  })
  return updatedItem
}

function getOccupiedLayouts() {
  return [
    ...visibleItems.value.map((item) => item.layout),
    ...(pendingSpawn.value ? [pendingSpawn.value.item.layout] : []),
  ]
}

function getOccupiedIdentities() {
  return new Set([
    ...visibleItems.value.map((item) => getImageIdentity(item)),
    ...(pendingSpawn.value ? [getImageIdentity(pendingSpawn.value.item)] : []),
  ])
}

function pushRecentHistory(uploadId: number) {
  recentHistory = updateRecentHistory(
    recentHistory,
    uploadId,
    availableUploads.value.length,
    effectiveVisibleCount.value,
  )
}

function markStageMutation(_reason: string) {
  lastStageMutationAt.value = nowMs()
  lastProgressReason.value = _reason
  armFreezeFailsafe()
  runAccountingCheck(_reason)
}

function getFlashStyle(flash: PolaroidFlash) {
  return {
    left: `${flash.x}px`,
    top: `${flash.y}px`,
    width: `${Math.max(flash.width * 1.02, POLAROID_CONFIG.flash.radiusPx)}px`,
    height: `${Math.max(flash.height * 1.02, POLAROID_CONFIG.flash.radiusPx)}px`,
    '--flash-duration': `${timings.value.flashDurationMs}ms`,
    '--flash-opacity': POLAROID_CONFIG.flash.overlayPeakOpacity.toFixed(3),
    '--flash-secondary-opacity': POLAROID_CONFIG.flash.overlaySecondaryOpacity.toFixed(3),
  }
}

function dedupeQueue(queue: number[]) {
  const seen = new Set<number>()
  return queue.filter((value) => {
    if (seen.has(value)) {
      return false
    }
    seen.add(value)
    return true
  })
}

function addItemTimer(instanceId: string, timer: number) {
  const timersForItem = itemTimers.get(instanceId) ?? []
  timersForItem.push(timer)
  itemTimers.set(instanceId, timersForItem)
}

function clearItemTimers(instanceId: string) {
  const timersForItem = itemTimers.get(instanceId)
  if (!timersForItem) {
    return
  }
  for (const timer of timersForItem) {
    window.clearTimeout(timer)
  }
  itemTimers.delete(instanceId)
}

function clearAllItemTimers() {
  for (const instanceId of itemTimers.keys()) {
    clearItemTimers(instanceId)
  }
}

function clearAllFlashTimers() {
  for (const timer of flashTimers.values()) {
    window.clearTimeout(timer)
  }
  flashTimers.clear()
}

function clearSchedulerTimer() {
  if (schedulerTimer != null) {
    window.clearTimeout(schedulerTimer)
    schedulerTimer = null
  }
}

function cancelPendingSpawn() {
  const hadPendingSpawn = pendingSpawn.value != null
  if (pendingSpawnTimer != null) {
    window.clearTimeout(pendingSpawnTimer)
    pendingSpawnTimer = null
  }
  if (pendingSpawn.value) {
    insertMetrics.delete(pendingSpawn.value.item.instanceId)
  }
  pendingSpawn.value = null
  if (hadPendingSpawn) {
    runAccountingCheck('cancel-pending-spawn')
  }
}

function cancelActivationFrames() {
  if (activationRafA != null) {
    window.cancelAnimationFrame(activationRafA)
    activationRafA = null
  }
  if (activationRafB != null) {
    window.cancelAnimationFrame(activationRafB)
    activationRafB = null
  }
}

function readSlideshowDebugFlag() {
  return Boolean(window.__RAVEBERG_DEBUG_SLIDESHOW__)
}

function syncDebugEnabled() {
  debugEnabled.value = readSlideshowDebugFlag()
  return debugEnabled.value
}

function armDebugHeartbeat() {
  clearDebugHeartbeat()
  debugHeartbeatTimer = window.setTimeout(() => {
    debugHeartbeatTimer = null
    runDebugHeartbeat()
    armDebugHeartbeat()
  }, DEBUG_HEARTBEAT_MS)
}

function clearDebugHeartbeat() {
  if (debugHeartbeatTimer != null) {
    window.clearTimeout(debugHeartbeatTimer)
    debugHeartbeatTimer = null
  }
}

function logSlideshowDebug(
  event: string,
  payload: Record<string, unknown>,
  summaryLines: string[] = [],
) {
  if (!syncDebugEnabled()) {
    return
  }

  console.groupCollapsed(`[SLIDESHOW][${event}]`)
  for (const line of summaryLines) {
    console.log(line)
  }
  console.log(payload)
  console.groupEnd()
}

function getCurrentQueueState(now = nowMs()) {
  return selectNextUpload(now).queueState
}

function getUsableStageArea() {
  const usableWidth =
    stageSize.value.width * Math.max(1 - POLAROID_CONFIG.zonePadding.left - POLAROID_CONFIG.zonePadding.right, 0)
  const usableHeight =
    stageSize.value.height * Math.max(1 - POLAROID_CONFIG.zonePadding.top - POLAROID_CONFIG.zonePadding.bottom, 0)

  return Math.max(usableWidth * usableHeight, 0)
}

function getCoverageDebugSnapshot(coverage = getCurrentCoverage()) {
  const totalStageArea = getUsableStageArea()
  const occupiedArea = totalStageArea * coverage

  return {
    totalStageArea: Math.round(totalStageArea),
    occupiedArea: Math.round(occupiedArea),
    coveragePercent: Number((coverage * 100).toFixed(1)),
  }
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function getProgressTimestamps() {
  return {
    lastInsertTimestamp: lastInsertTimestamp.value == null ? null : Math.round(lastInsertTimestamp.value),
    lastRemoveTimestamp: lastRemoveTimestamp.value == null ? null : Math.round(lastRemoveTimestamp.value),
    lastProgressTimestamp: Math.round(lastStageMutationAt.value),
  }
}

function getFreshnessDebugPayload(item: ActivePolaroid, freshness = getFreshnessEntry(item)) {
  return {
    imageId: item.uploadId,
    freshnessRank: freshness.freshnessRank,
    isTop3: freshness.isTopFresh,
    currentAgingStyle: freshness.freshnessProfile,
    filterProfile: freshness.freshnessProfile,
  }
}

function buildStatePayload() {
  const coverage = getCurrentCoverage()
  const coverageStats = getCoverageDebugSnapshot(coverage)
  const accounting = buildAccountingSnapshot()
  const exitPipeline = getExitPipelineSnapshot()
  const nextCandidate = selectNextUpload()

  return {
    phase: currentPhase.value,
    currentEngineState: currentEngineState.value,
    stageCoveragePercent: coverageStats.coveragePercent,
    totalStageArea: coverageStats.totalStageArea,
    occupiedArea: coverageStats.occupiedArea,
    configuredInsertInterval: Math.round(timings.value.spawnIntervalMs),
    effectiveMinVisibleHoldMs: Math.round(getEffectiveMinVisibleHoldMs()),
    insertCadenceOverdue: isInsertCadenceOverdue(),
    actualTimeSinceLastVisibleInsert: Math.round(getActualTimeSinceLastVisibleInsertMs()),
    averageEffectiveInsertInterval: getAverageEffectiveInsertIntervalMs(),
    agingDurationCurrent: Math.round(timings.value.agingDurationMs),
    fadeDurationCurrent: Math.round(timings.value.exitDurationMs),
    timeSpentWaitingForRemoval: Math.round(getTimeSpentWaitingForRemovalMs()),
    visibleImagesCount: visibleItems.value.length,
    fadingImagesCount: fadingCount.value,
    enteringImagesCount: enteringCount.value,
    removedImagesCount: removedImagesCount.value,
    totalUploads: accounting.summary.totalUploads,
    unseenImagesCount: accounting.summary.unseen,
    recyclePoolSize: accounting.summary.recyclePool,
    queueSize: accounting.summary.queued,
    blockedCount: accounting.summary.blocked,
    failedPlacementCount: accounting.summary.failedPlacement,
    cooldownCount: accounting.summary.cooldown,
    accountingSum: accounting.summary.sum,
    accountingMismatch: accounting.summary.mismatch,
    targetCoverage: Number((stageCapacity.value.targetCoverage * 100).toFixed(1)),
    minRotationCoverage: Number((getMinRotationCoverage() * 100).toFixed(1)),
    rotationAllowed: isRotationAllowed(),
    buildAllowed: currentPhase.value === 'build',
    selectedAgingImageId: exitPipeline.imageId,
    nextCandidateId: nextCandidate.upload?.id ?? null,
    agingStartedAt: exitPipeline.agingStartedAt,
    agingDeadline: exitPipeline.agingDeadline,
    fadeDeadline: exitPipeline.fadeDeadline,
    exitPipelineState: exitPipeline.state,
    effectiveBuildCompleteReason: getEffectiveBuildCompleteReason(),
    stalledRetryThreshold: BUILD_ABORT_RETRY_THRESHOLD,
    lastViableSlotTimestamp: lastViableSlotTimestamp.value == null ? null : Math.round(lastViableSlotTimestamp.value),
    buildProgressAgeMs: Math.round(getBuildProgressAgeMs()),
    queuedOldestAgeMs: Math.round(getQueuedOldestAgeMs()),
    placementAttemptsSinceLastInsert: buildPlacementAttemptsSinceLastInsert.value,
    lastProgressReason: lastProgressReason.value,
    lastFailedInsertReason: lastFailedInsertReason.value,
    lastTransition: lastProgressReason.value,
    ...getProgressTimestamps(),
  }
}

function runAccountingCheck(reason: string) {
  if (!readSlideshowDebugFlag()) {
    return
  }

  const accounting = buildAccountingSnapshot()
  const { summary } = accounting
  const payload = {
    reason,
    totalUploads: summary.totalUploads,
    visible: summary.visible,
    aging: summary.aging,
    entering: summary.entering,
    fading: summary.fading,
    queued: summary.queued,
    unseen: summary.unseen,
    recycle: summary.recyclePool,
    blocked: summary.blocked,
    failedPlacement: summary.failedPlacement,
    cooldown: summary.cooldown,
    sum: summary.sum,
    mismatch: summary.mismatch,
    images: accounting.images,
    nonVisibleImages: accounting.nonVisibleImages,
  }

  if (summary.mismatch) {
    console.error('[SLIDESHOW][ACCOUNTING_ERROR]', payload)
  }

  logSlideshowDebug(
    'ACCOUNTING_CHECK',
    payload,
    [
      `Total: ${summary.totalUploads}`,
      `Visible: ${summary.visible} | Aging: ${summary.aging} | Entering: ${summary.entering} | Fading: ${summary.fading}`,
      `Unseen: ${summary.unseen} | Queued: ${summary.queued} | Recycle: ${summary.recyclePool}`,
      `Blocked: ${summary.blocked} | FailedPlacement: ${summary.failedPlacement} | Cooldown: ${summary.cooldown}`,
      `Sum: ${summary.sum}${summary.mismatch ? ' (MISMATCH)' : ''}`,
    ],
  )
}

function logFreshnessHierarchy(reason: string) {
  if (!readSlideshowDebugFlag()) {
    return
  }

  logSlideshowDebug(
    'AGING',
    {
      reason,
      images: freshnessEntries.value.map((entry) => ({
        imageId: entry.item.uploadId,
        freshnessRank: entry.freshnessRank,
        isTop3: entry.isTopFresh,
        currentAgingStyle: entry.freshnessProfile,
        filterProfile: entry.freshnessProfile,
        lifecycleStatus: entry.item.lifecycleStatus,
      })),
    },
    freshnessEntries.value.map(
      (entry) =>
        `→ image: ${entry.item.uploadId} | rank: ${entry.freshnessRank} | top3: ${entry.isTopFresh ? 'yes' : 'no'} | profile: ${entry.freshnessProfile}`,
    ),
  )
}

function runDebugHeartbeat() {
  if (!syncDebugEnabled()) {
    return
  }

  const payload = buildStatePayload()
  runAccountingCheck('heartbeat')
  logSlideshowDebug(
    'STATE',
    payload,
    [
      `Engine: ${payload.currentEngineState}`,
      `Coverage: ${payload.stageCoveragePercent}%`,
      `Visible: ${payload.visibleImagesCount} | Fading: ${payload.fadingImagesCount} | Entering: ${payload.enteringImagesCount}`,
      `Removed: ${payload.removedImagesCount}`,
      `Uploads total: ${payload.totalUploads} | Accounting sum: ${payload.accountingSum}`,
      `Configured interval: ${Math.round(payload.configuredInsertInterval / 1000)}s | Effective min hold: ${Math.round(payload.effectiveMinVisibleHoldMs / 1000)}s | Overdue: ${payload.insertCadenceOverdue ? 'yes' : 'no'} | Actual since last insert: ${Math.round(payload.actualTimeSinceLastVisibleInsert / 1000)}s | Average effective interval: ${Math.round(payload.averageEffectiveInsertInterval / 1000)}s`,
      `Aging: ${Math.round(payload.agingDurationCurrent / 1000)}s | Fade: ${Math.round(payload.fadeDurationCurrent / 1000)}s | Waiting for removal: ${Math.round(payload.timeSpentWaitingForRemoval / 1000)}s`,
      `Unseen: ${payload.unseenImagesCount} | Recycle: ${payload.recyclePoolSize} | Queue: ${payload.queueSize}`,
      `Blocked: ${payload.blockedCount} | FailedPlacement: ${payload.failedPlacementCount} | Cooldown: ${payload.cooldownCount}`,
      `Next candidate: ${payload.nextCandidateId ?? 'none'} | Last transition: ${payload.lastTransition ?? 'none'}`,
      `Target coverage: ${payload.targetCoverage}% | Min rotation: ${payload.minRotationCoverage}%`,
      `Exit pipeline: ${payload.exitPipelineState} | Aging image: ${payload.selectedAgingImageId ?? 'none'}`,
      `Queued oldest: ${Math.round(payload.queuedOldestAgeMs / 1000)}s | Last viable slot: ${payload.lastViableSlotTimestamp ?? 'none'}`,
      `Placement retries: ${payload.placementAttemptsSinceLastInsert} | Last failed insert: ${payload.lastFailedInsertReason ?? 'none'}`,
    ],
  )
}

function logInit() {
  if (!readSlideshowDebugFlag()) {
    syncDebugEnabled()
    return
  }
  const accounting = buildAccountingSnapshot()
  logSlideshowDebug(
    'INIT',
    {
      totalUploads: accounting.summary.totalUploads,
      config: {
        targetCoverage: stageCapacity.value.targetCoverage,
        maxVisible: effectiveVisibleCount.value,
        minDisplayTime: stageCapacity.value.minVisibleHoldMs,
        spawnInterval: timings.value.spawnIntervalMs,
      },
      initialQueueSize: accounting.summary.queued,
      initialPhase: currentPhase.value,
    },
    [
      `Uploads: ${accounting.summary.totalUploads}`,
      `Target coverage: ${Math.round(stageCapacity.value.targetCoverage * 100)}%`,
      `Max visible: ${effectiveVisibleCount.value} | Min display: ${Math.round(stageCapacity.value.minVisibleHoldMs / 1000)}s`,
      `Spawn interval: ${Math.round(timings.value.spawnIntervalMs / 1000)}s | Initial queue: ${accounting.summary.queued}`,
    ],
  )
}

function logInsertEvent(item: ActivePolaroid, metric?: InsertMetric) {
  if (!readSlideshowDebugFlag()) {
    return
  }
  const coverage = getCurrentCoverage()
  logSlideshowDebug(
    'INSERT',
    {
      ...getFreshnessDebugPayload(item),
      reason: metric?.reason ?? 'force_progress',
      source: metric?.source ?? (shownAtByIdentity.has(item.uploadId) ? 'recycle' : 'unseen'),
      currentCoverage: Number((coverage * 100).toFixed(1)),
      visibleCountAfterInsert: visibleItems.value.length,
      coverageBefore: metric?.coverageBefore == null ? null : Number((metric.coverageBefore * 100).toFixed(1)),
      coverageAfter: Number((coverage * 100).toFixed(1)),
      ...getProgressTimestamps(),
    },
    [
      `→ image: ${item.uploadId}`,
      `→ rank: ${getFreshnessEntry(item).freshnessRank} | top3: ${getFreshnessEntry(item).isTopFresh ? 'yes' : 'no'} | profile: ${getFreshnessEntry(item).freshnessProfile}`,
      `→ source: ${metric?.source ?? 'unseen'}`,
      `→ reason: ${metric?.reason ?? 'force_progress'}`,
      `→ coverage: ${metric?.coverageBefore == null ? 'n/a' : `${Number((metric.coverageBefore * 100).toFixed(1))}%`} → ${Number((coverage * 100).toFixed(1))}%`,
    ],
  )
}

function logAgingStart(item: ActivePolaroid, startedAt: number) {
  if (!readSlideshowDebugFlag()) {
    return
  }
  const visibleSince = item.visibleSince ?? item.entryActivatedAt ?? item.enteredAt
  const agingDeadline = startedAt + item.timings.agingDurationMs
  logSlideshowDebug(
    'AGING_START',
    {
      ...getFreshnessDebugPayload(item),
      selectedAgingImageId: item.uploadId,
      ageProgress: 0,
      agingStartedAt: Math.round(startedAt),
      agingDeadline: Math.round(agingDeadline),
      fadeDeadline: Math.round(agingDeadline + item.timings.exitDurationMs),
      exitPipelineState: 'visible_aging',
      timeVisible: Math.round(startedAt - visibleSince),
      phase: currentPhase.value,
    },
    [
      `→ image: ${item.uploadId}`,
      `→ rank: ${getFreshnessEntry(item).freshnessRank} | top3: ${getFreshnessEntry(item).isTopFresh ? 'yes' : 'no'} | profile: ${getFreshnessEntry(item).freshnessProfile}`,
      `→ timeVisible: ${Math.round((startedAt - visibleSince) / 1000)}s`,
    ],
  )
}

function logRemoveStart(
  item: ActivePolaroid,
  startedAt: number,
  reason: 'stage_full_rotation' | 'overflow_control',
) {
  if (!readSlideshowDebugFlag()) {
    return
  }
  const coverageBefore = getCurrentCoverage()
  const visibleSince = item.visibleSince ?? item.entryActivatedAt ?? item.enteredAt
  logSlideshowDebug(
    'REMOVE_START',
    {
      ...getFreshnessDebugPayload(item),
      visibleDuration: Math.round(startedAt - visibleSince),
      reason,
      coverageBefore: Number((coverageBefore * 100).toFixed(1)),
      coverageAfter: Number((coverageBefore * 100).toFixed(1)),
    },
    [
      `→ image: ${item.uploadId}`,
      `→ rank: ${getFreshnessEntry(item).freshnessRank} | top3: ${getFreshnessEntry(item).isTopFresh ? 'yes' : 'no'} | profile: ${getFreshnessEntry(item).freshnessProfile}`,
      `→ reason: ${reason}`,
      `→ visibleDuration: ${Math.round((startedAt - visibleSince) / 1000)}s`,
      `→ coverage: ${Number((coverageBefore * 100).toFixed(1))}%`,
    ],
  )
}

function logRemoveDone(
  item: ActivePolaroid,
  freshness: FreshnessEntry,
  coverageBefore: number,
  coverageAfter: number,
  removedAt: number,
  reason: 'stage_full_rotation' | 'overflow_control',
) {
  if (!readSlideshowDebugFlag()) {
    return
  }
  const visibleSince = item.visibleSince ?? item.entryActivatedAt ?? item.enteredAt
  logSlideshowDebug(
    'REMOVE_DONE',
    {
      ...getFreshnessDebugPayload(item, freshness),
      visibleDuration: Math.round(removedAt - visibleSince),
      reason,
      coverageBefore: Number((coverageBefore * 100).toFixed(1)),
      coverageAfter: Number((coverageAfter * 100).toFixed(1)),
      removedImagesCount: removedImagesCount.value,
      ...getProgressTimestamps(),
    },
    [
      `→ image: ${item.uploadId}`,
      `→ rank: ${getFreshnessEntry(item).freshnessRank} | top3: ${getFreshnessEntry(item).isTopFresh ? 'yes' : 'no'} | profile: ${getFreshnessEntry(item).freshnessProfile}`,
      `→ reason: ${reason}`,
      `→ coverage: ${Number((coverageBefore * 100).toFixed(1))}% → ${Number((coverageAfter * 100).toFixed(1))}%`,
    ],
  )
}

function getDecisionKey(decision: TickDecision) {
  if (decision.type === 'remove') {
    return 'remove_oldest'
  }
  if (decision.type === 'insert') {
    return 'insert_next'
  }
  return 'idle_wait'
}

function logInsert(event: string, instanceId: string, details: Record<string, unknown>) {
  if (!syncDebugEnabled()) {
    return
  }
  logSlideshowDebug(`INSERT_${event.toUpperCase()}`, {
    instanceId,
    currentEngineState: currentEngineState.value,
    visibleCount: visibleItems.value.length,
    fadingCount: fadingCount.value,
    enteringCount: enteringCount.value,
    stackLoad: stackLoad.value,
    nextTickInMs: nextTickAt == null ? null : Math.round(nextTickAt - nowMs()),
    ...details,
  })
}

function logSchedulerDecision(decision: TickDecision) {
  if (!readSlideshowDebugFlag()) {
    return
  }
  const coverageStats = getCoverageDebugSnapshot()
  const exitFreshness = decision.exitCandidate ? getFreshnessDebugPayload(decision.exitCandidate) : null
  const exitPipeline = getExitPipelineSnapshot()
  logSlideshowDebug(
    'DECISION',
    {
      decision: getDecisionKey(decision),
      reason: decision.reason,
      currentEngineState: decision.engineState,
      coverage: coverageStats.coveragePercent,
      targetCoverage: Number((stageCapacity.value.targetCoverage * 100).toFixed(1)),
      visibleCount: visibleItems.value.length,
      unseenCount: decision.selection.queueState.unseenCount,
      fadingCount: fadingCount.value,
      recycleCount: decision.selection.queueState.recycleCount,
      enteringCount: enteringCount.value,
      nextCandidateId: decision.selection.upload?.id ?? null,
      placementSuccess: decision.placementSuccess ?? null,
      configuredInsertInterval: Math.round(timings.value.spawnIntervalMs),
      effectiveMinVisibleHoldMs: Math.round(getEffectiveMinVisibleHoldMs()),
      insertCadenceOverdue: isInsertCadenceOverdue(),
      actualTimeSinceLastVisibleInsert: Math.round(getActualTimeSinceLastVisibleInsertMs()),
      averageEffectiveInsertInterval: getAverageEffectiveInsertIntervalMs(),
      agingDurationCurrent: Math.round(timings.value.agingDurationMs),
      fadeDurationCurrent: Math.round(timings.value.exitDurationMs),
      timeSpentWaitingForRemoval: Math.round(getTimeSpentWaitingForRemovalMs()),
      selectedAgingImageId: exitPipeline.imageId,
      agingStartedAt: exitPipeline.agingStartedAt,
      agingDeadline: exitPipeline.agingDeadline,
      fadeDeadline: exitPipeline.fadeDeadline,
      exitPipelineState: exitPipeline.state,
      removeTargetId: decision.exitCandidate?.uploadId ?? null,
      selectedExitFreshnessRank: exitFreshness?.freshnessRank ?? null,
      selectedExitIsTop3: exitFreshness?.isTop3 ?? null,
      selectedExitFilterProfile: exitFreshness?.filterProfile ?? null,
      selectedInsertImageId: decision.selection.upload?.id ?? null,
      totalStageArea: coverageStats.totalStageArea,
      occupiedArea: coverageStats.occupiedArea,
      lastProgressTimestamp: Math.round(lastStageMutationAt.value),
      lastTransition: lastProgressReason.value,
    },
    [
      `→ decision: ${getDecisionKey(decision)}`,
      `→ reason: ${decision.reason}`,
      `→ engine: ${decision.engineState} | coverage: ${coverageStats.coveragePercent}% | target: ${Number((stageCapacity.value.targetCoverage * 100).toFixed(1))}%`,
      `→ visible: ${visibleItems.value.length} | unseen: ${decision.selection.queueState.unseenCount} | recycle: ${decision.selection.queueState.recycleCount}`,
      `→ configuredInterval: ${Math.round(timings.value.spawnIntervalMs / 1000)}s | effectiveMinHold: ${Math.round(getEffectiveMinVisibleHoldMs() / 1000)}s | overdue: ${isInsertCadenceOverdue() ? 'yes' : 'no'} | actualSinceLastInsert: ${Math.round(getActualTimeSinceLastVisibleInsertMs() / 1000)}s | avgEffective: ${Math.round(getAverageEffectiveInsertIntervalMs() / 1000)}s`,
      `→ aging: ${Math.round(timings.value.agingDurationMs / 1000)}s | fade: ${Math.round(timings.value.exitDurationMs / 1000)}s | waitingForRemoval: ${Math.round(getTimeSpentWaitingForRemovalMs() / 1000)}s`,
      `→ nextCandidate: ${decision.selection.upload?.id ?? 'none'} | placementSuccess: ${decision.placementSuccess == null ? 'n/a' : decision.placementSuccess ? 'yes' : 'no'} | removeTarget: ${decision.exitCandidate?.uploadId ?? 'none'}`,
      `→ exitPipeline: ${exitPipeline.state} | agingImage: ${exitPipeline.imageId ?? 'none'} | lastTransition: ${lastProgressReason.value}`,
    ],
  )
}

function logAgingDecision(allowed: boolean) {
  if (!syncDebugEnabled()) {
    return
  }

  const signature = JSON.stringify({
    allowed,
    phase: currentPhase.value,
    visibleCount: visibleItems.value.length,
    fadingCount: fadingCount.value,
    agingCount: agingCount.value,
    coverageRatio: Number(coverageRatio.value.toFixed(3)),
  })

  if (signature === lastAgingLogSignature) {
    return
  }
  lastAgingLogSignature = signature

  logSlideshowDebug(allowed ? 'AGING_ENABLED' : 'AGING_BLOCKED', {
    allowed,
    phase: currentPhase.value,
    visibleImages: visibleItems.value.length,
    fadingCount: fadingCount.value,
    agingCount: agingCount.value,
    enteringCount: enteringCount.value,
    coverageRatio: Number(coverageRatio.value.toFixed(3)),
    rotationStarted: rotationStartedAt.value != null,
  })
}

function nowMs() {
  return window.performance.now()
}
</script>

<template>
  <section ref="stageRef" class="polaroid-stage">
    <div class="polaroid-stage__bg-base" aria-hidden="true" />
    <div
      class="polaroid-stage__bg-light"
      :class="{ 'polaroid-stage__bg-light--debug': POLAROID_CONFIG.debug.showCloudLayerBounds }"
      aria-hidden="true"
    >
      <div class="polaroid-stage__bg-blob polaroid-stage__bg-blob--primary">
        <span v-if="POLAROID_CONFIG.debug.showCloudLayerBounds" class="polaroid-stage__bg-debug-label">A</span>
      </div>
      <div class="polaroid-stage__bg-blob polaroid-stage__bg-blob--secondary">
        <span v-if="POLAROID_CONFIG.debug.showCloudLayerBounds" class="polaroid-stage__bg-debug-label">B</span>
      </div>
      <div class="polaroid-stage__bg-blob polaroid-stage__bg-blob--tertiary">
        <span v-if="POLAROID_CONFIG.debug.showCloudLayerBounds" class="polaroid-stage__bg-debug-label">C</span>
      </div>
    </div>

    <div class="polaroid-stage__polaroids" aria-hidden="true">
      <div class="polaroid-stage__flash-layer">
        <div
          v-for="flash in flashes"
          :key="flash.id"
          class="polaroid-stage__flash"
          :style="getFlashStyle(flash)"
        />
      </div>

      <div class="polaroid-stage__stack">
        <SelfiePolaroidItem
          v-for="item in stackItems"
          :key="item.instanceId"
          :item="item"
          :vintage-look-enabled="props.vintageLookEnabled"
          @image-error="handleImageError"
        />
      </div>
    </div>

    <div v-if="debugOverlayState" class="polaroid-stage__debug-overlay">
      <div class="polaroid-stage__debug-title">SLIDESHOW DEBUG</div>
      <div>Engine: {{ debugOverlayState.currentEngineState }}</div>
      <div>Coverage: {{ debugOverlayState.coveragePercent }}</div>
      <div>Interval cfg: {{ debugOverlayState.configuredInsertInterval }}ms</div>
      <div>Min hold eff: {{ debugOverlayState.effectiveMinVisibleHoldMs }}ms</div>
      <div>Overdue: {{ debugOverlayState.insertCadenceOverdue ? 'yes' : 'no' }}</div>
      <div>Last insert age: {{ debugOverlayState.actualTimeSinceLastVisibleInsert }}ms</div>
      <div>Avg insert: {{ debugOverlayState.averageEffectiveInsertInterval }}ms</div>
      <div>Total: {{ debugOverlayState.totalUploads }}</div>
      <div>Visible: {{ debugOverlayState.visibleCount }}</div>
      <div>Aging: {{ debugOverlayState.agingCount }}</div>
      <div>Unseen: {{ debugOverlayState.unseenCount }}</div>
      <div>Queued: {{ debugOverlayState.queuedCount }}</div>
      <div>Recycle: {{ debugOverlayState.recycleCount }}</div>
      <div>Fading: {{ debugOverlayState.fadingCount }}</div>
      <div>Entering: {{ debugOverlayState.enteringCount }}</div>
      <div>Blocked/Retry: {{ debugOverlayState.blockedCount }}</div>
      <div :class="{ 'polaroid-stage__debug-error': debugOverlayState.mismatch }">Sum: {{ debugOverlayState.sum }}</div>
      <div>Next candidate: {{ debugOverlayState.nextCandidateId ?? 'none' }}</div>
      <div>Exit pipeline: {{ debugOverlayState.exitPipelineState }}</div>
      <div>Aging image: {{ debugOverlayState.selectedAgingImageId ?? 'none' }}</div>
      <div>Aging dur: {{ debugOverlayState.agingDurationCurrent }}ms</div>
      <div>Fade dur: {{ debugOverlayState.fadeDurationCurrent }}ms</div>
      <div>Wait remove: {{ debugOverlayState.timeSpentWaitingForRemoval }}ms</div>
      <div>Queued oldest: {{ debugOverlayState.queuedOldestAge }}s</div>
      <div>Retries since insert: {{ debugOverlayState.placementAttemptsSinceLastInsert }}</div>
      <div>Last transition: {{ debugOverlayState.lastTransition }}</div>
      <div>Last failed insert: {{ debugOverlayState.lastFailedInsertReason }}</div>
      <div v-if="debugOverlayState.mismatch" class="polaroid-stage__debug-error">ACCOUNTING MISMATCH</div>
    </div>
  </section>
</template>

<style scoped>
.polaroid-stage {
  position: relative;
  isolation: isolate;
  width: 100%;
  min-height: 100dvh;
  overflow: hidden;
  background: #000;
}

.polaroid-stage__bg-base,
.polaroid-stage__bg-light,
.polaroid-stage__polaroids,
.polaroid-stage__flash-layer,
.polaroid-stage__stack {
  position: absolute;
  inset: 0;
}

.polaroid-stage__bg-base {
  z-index: 0;
  background: #000;
}

.polaroid-stage__bg-light {
  position: absolute;
  width: 220%;
  height: 220%;
  left: -60%;
  top: -60%;
  z-index: 1;
  pointer-events: none;
  overflow: visible;
}

.polaroid-stage__bg-light--debug {
  outline: 1px dashed rgba(120, 220, 255, 0.35);
  outline-offset: -1px;
}

.polaroid-stage__bg-blob {
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
  mix-blend-mode: screen;
  filter: blur(54px);
  will-change: transform, opacity;
  transform: translate3d(0, 0, 0) scale(1);
}

.polaroid-stage__bg-light--debug .polaroid-stage__bg-blob {
  outline: 1px dashed rgba(138, 220, 255, 0.24);
}

.polaroid-stage__bg-debug-label {
  position: absolute;
  top: 1rem;
  left: 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  min-height: 1.5rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: rgba(7, 14, 22, 0.74);
  border: 1px solid rgba(138, 220, 255, 0.28);
  color: rgba(196, 236, 255, 0.92);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.polaroid-stage__bg-blob--primary {
  width: 72%;
  height: 68%;
  left: 6%;
  top: 4%;
  background:
    radial-gradient(
      ellipse at 34% 30%,
      rgba(126, 196, 255, 0.36) 0%,
      rgba(126, 196, 255, 0.21) 14%,
      rgba(126, 196, 255, 0.11) 28%,
      rgba(126, 196, 255, 0.042) 42%,
      transparent 68%
    ),
    radial-gradient(
      ellipse at 58% 54%,
      rgba(96, 170, 255, 0.12) 0%,
      rgba(96, 170, 255, 0.05) 22%,
      transparent 48%
    );
  animation: polaroid-glow-primary 44s cubic-bezier(0.42, 0, 0.22, 1) infinite alternate;
}

.polaroid-stage__bg-blob--secondary {
  width: 64%;
  height: 60%;
  left: 40%;
  top: 28%;
  background:
    radial-gradient(
      ellipse at 46% 42%,
      rgba(72, 146, 228, 0.2) 0%,
      rgba(72, 146, 228, 0.11) 16%,
      rgba(72, 146, 228, 0.048) 32%,
      transparent 62%
    ),
    radial-gradient(
      ellipse at 62% 58%,
      rgba(114, 188, 255, 0.08) 0%,
      transparent 42%
    );
  animation: polaroid-glow-secondary 52s cubic-bezier(0.42, 0, 0.24, 1) infinite alternate;
}

.polaroid-stage__bg-blob--tertiary {
  width: 58%;
  height: 54%;
  left: 24%;
  top: 56%;
  background:
    radial-gradient(
      ellipse at 44% 44%,
      rgba(94, 162, 236, 0.13) 0%,
      rgba(94, 162, 236, 0.07) 18%,
      rgba(94, 162, 236, 0.03) 34%,
      transparent 64%
    ),
    radial-gradient(
      ellipse at 58% 52%,
      rgba(152, 214, 255, 0.05) 0%,
      transparent 38%
    );
  animation: polaroid-glow-tertiary 60s cubic-bezier(0.4, 0, 0.24, 1) infinite alternate;
}

.polaroid-stage__polaroids {
  z-index: 2;
}

.polaroid-stage__debug-overlay {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 30;
  display: grid;
  gap: 0.18rem;
  min-width: 11rem;
  padding: 0.7rem 0.85rem;
  border-radius: 0.8rem;
  background: rgba(6, 10, 14, 0.72);
  border: 1px solid rgba(158, 214, 255, 0.22);
  color: rgba(232, 244, 255, 0.92);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 0.72rem;
  line-height: 1.25;
  letter-spacing: 0.02em;
  backdrop-filter: blur(8px);
  pointer-events: none;
}

.polaroid-stage__debug-title {
  margin-bottom: 0.16rem;
  color: rgba(162, 222, 255, 0.98);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.polaroid-stage__debug-error {
  color: rgba(255, 132, 132, 0.98);
}

.polaroid-stage__flash-layer {
  pointer-events: none;
}

.polaroid-stage__flash {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background:
    radial-gradient(circle, rgba(255, 248, 240, var(--flash-opacity)) 0, rgba(255, 248, 240, 0.14) 40%, transparent 72%),
    radial-gradient(circle, rgba(255, 233, 208, var(--flash-secondary-opacity)) 0, transparent 78%);
  opacity: 0;
  animation: flash-fade var(--flash-duration) ease-out forwards;
}

.polaroid-stage__stack {
  pointer-events: none;
}

@keyframes flash-fade {
  0% {
    opacity: 0;
  }
  12% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@keyframes polaroid-glow-primary {
  0% {
    transform: translate3d(-9%, -7%, 0) scale(1);
    opacity: 0.8;
  }
  23% {
    transform: translate3d(4%, -4%, 0) scale(1.04);
    opacity: 0.94;
  }
  51% {
    transform: translate3d(10%, 8%, 0) scale(1.08);
    opacity: 0.88;
  }
  78% {
    transform: translate3d(-2%, 13%, 0) scale(1.03);
    opacity: 0.96;
  }
  100% {
    transform: translate3d(8%, 2%, 0) scale(1.06);
    opacity: 0.86;
  }
}

@keyframes polaroid-glow-secondary {
  0% {
    transform: translate3d(7%, -5%, 0) scale(1.02);
    opacity: 0.5;
  }
  28% {
    transform: translate3d(-5%, 1%, 0) scale(1.06);
    opacity: 0.7;
  }
  56% {
    transform: translate3d(4%, 12%, 0) scale(1.09);
    opacity: 0.58;
  }
  100% {
    transform: translate3d(-7%, 6%, 0) scale(1.04);
    opacity: 0.68;
  }
}

@keyframes polaroid-glow-tertiary {
  0% {
    transform: translate3d(-3%, 4%, 0) scale(1);
    opacity: 0.36;
  }
  33% {
    transform: translate3d(6%, -2%, 0) scale(1.05);
    opacity: 0.5;
  }
  67% {
    transform: translate3d(-6%, -6%, 0) scale(1.03);
    opacity: 0.4;
  }
  100% {
    transform: translate3d(4%, 8%, 0) scale(1.07);
    opacity: 0.48;
  }
}
</style>
