<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { ModerationMode, UploadItem } from '../../../services/api'
import { POLAROID_CONFIG, getPolaroidTimings, getVisiblePhotoCount } from './polaroidConfig'
import { buildPolaroidLayout, rebasePolaroidLayout } from './polaroidLayout'
import { getImageIdentity, pickNextImage, updateRecentHistory } from './polaroidPool'
import type { ActivePolaroid, PolaroidFlash, StageSize } from './polaroidTypes'
import SelfiePolaroidItem from './SelfiePolaroidItem.vue'

interface PendingSpawn {
  item: ActivePolaroid
  preparedAt: number
}

interface InsertMetric {
  preparedAt: number
  mountedAt?: number
  activatedAt?: number
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
const exitingItems = ref<ActivePolaroid[]>([])
const pendingSpawn = ref<PendingSpawn | null>(null)
const flashes = ref<PolaroidFlash[]>([])
const brokenUploadIds = ref<Set<number>>(new Set())

const itemTimers = new Map<string, number[]>()
const flashTimers = new Map<string, number>()
const insertMetrics = new Map<string, InsertMetric>()

let resizeObserver: ResizeObserver | null = null
let schedulerTimer: number | null = null
let pendingSpawnTimer: number | null = null
let activationRafA: number | null = null
let activationRafB: number | null = null
let activeEntryInstanceId: string | null = null
let nextTickAt: number | null = null
let preExitHandledForTick = false
let nextCursor = 0
let instanceCounter = 0
let orderCounter = 0
let flashCounter = 0
let knownPoolIds = new Set<number>()
let priorityQueue: number[] = []
let recentHistory: number[] = []
const removedAtByIdentity = new Map<number, number>()

const availableUploads = computed(() =>
  props.uploads.filter(
    (upload): upload is UploadItem & { display_url: string } =>
      Boolean(upload.display_url) && !brokenUploadIds.value.has(upload.id),
  ),
)

const targetVisibleCount = computed(() => getVisiblePhotoCount(props.maxVisiblePhotos))
const timings = computed(() => getPolaroidTimings(props.intervalSeconds, targetVisibleCount.value))
const stackItems = computed(() => [...exitingItems.value, ...visibleItems.value])
const stackLoad = computed(
  () => visibleItems.value.length + exitingItems.value.length + (pendingSpawn.value ? 1 : 0),
)
const cloudLayers = computed(() =>
  POLAROID_CONFIG.clouds.layers
    .slice(0, POLAROID_CONFIG.clouds.numberOfCloudLayers)
    .map((layer) => ({
      id: layer.id,
      style: {
        top: layer.top,
        left: layer.left,
        width: layer.width,
        height: layer.height,
        opacity: String(layer.opacity * POLAROID_CONFIG.clouds.cloudOpacity),
        background: layer.background,
        '--cloud-drift-x': `${layer.driftX ?? POLAROID_CONFIG.clouds.cloudDriftDistanceX}px`,
        '--cloud-drift-y': `${layer.driftY ?? POLAROID_CONFIG.clouds.cloudDriftDistanceY}px`,
        '--cloud-duration': `${layer.durationMs ?? POLAROID_CONFIG.clouds.cloudAnimationDurationMs}ms`,
        '--cloud-delay': `${layer.delayMs ?? 0}ms`,
      },
    })),
)

onMounted(() => {
  syncStageSize()
  resizeObserver = new ResizeObserver(() => {
    syncStageSize()
  })
  if (stageRef.value) {
    resizeObserver.observe(stageRef.value)
  }
})

onBeforeUnmount(() => {
  clearSchedulerTimer()
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
      return
    }
    ensureScheduler(stackLoad.value === 0)
  },
)

function runSchedulerTick(force: boolean) {
  clearSchedulerTimer()
  if (props.paused || !availableUploads.value.length) {
    nextTickAt = null
    preExitHandledForTick = false
    return
  }

  const now = nowMs()
  if (pendingSpawn.value) {
    advanceSchedulerTick(now, force)
    return
  }
  if (activeEntryInstanceId && !force) {
    nextTickAt = now + POLAROID_CONFIG.timing.entryRetryDelayMs
    preExitHandledForTick = false
    scheduleSchedulerAction()
    return
  }

  const nextUpload = pickNextUpload()
  if (!nextUpload) {
    advanceSchedulerTick(now, force)
    return
  }

  let spawnDelay = 0
  if (isSteadyStateActive() && visibleItems.value.length >= targetVisibleCount.value) {
    if (!moveOldestToExit()) {
      advanceSchedulerTick(now, force)
      return
    }
    spawnDelay = POLAROID_CONFIG.timing.spawnDelayAfterExitStartMs
  }

  prepareSpawn(nextUpload, spawnDelay, now)
  advanceSchedulerTick(now, force)
}

function prepareSpawn(upload: UploadItem & { display_url: string }, spawnDelay: number, preparedAt: number) {
  const item = createActiveItem(upload, preparedAt)
  pendingSpawn.value = {
    item,
    preparedAt,
  }
  insertMetrics.set(item.instanceId, { preparedAt })
  logInsert('prepared', item.instanceId, {
    spawnDelay,
    phase: isSteadyStateActive() ? 'steady' : 'build',
  })

  pendingSpawnTimer = window.setTimeout(() => {
    pendingSpawnTimer = null
    mountPendingSpawn(item.instanceId)
  }, Math.max(0, Math.round(spawnDelay)))
}

function mountPendingSpawn(instanceId: string) {
  const candidate = pendingSpawn.value
  if (!candidate || candidate.item.instanceId !== instanceId) {
    return
  }

  const mountedAt = nowMs()
  visibleItems.value = [...visibleItems.value, candidate.item]
  pendingSpawn.value = null

  const metric = insertMetrics.get(instanceId)
  if (metric) {
    metric.mountedAt = mountedAt
  }
  logInsert('mounted', instanceId, {
    prepareToMountMs: metric ? Math.round(mountedAt - metric.preparedAt) : undefined,
  })

  armEntryActivation(instanceId)
  scheduleSchedulerAction()
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
    lifecycleStatus: 'entering',
  }))

  if (!activatedItem) {
    return
  }

  activeEntryInstanceId = instanceId
  pushRecentHistory(getImageIdentity(activatedItem))
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

  scheduleLifecycle(activatedItem)
}

function scheduleLifecycle(item: ActivePolaroid) {
  clearItemTimers(item.instanceId)
  const elapsedMs = Math.max(0, nowMs() - item.enteredAt)
  applyLifecycleSnapshot(item.instanceId, elapsedMs)

  const registerAt = (targetDelayMs: number, task: () => void) => {
    const remainingMs = Math.max(0, Math.round(targetDelayMs - elapsedMs))
    if (remainingMs <= 0) {
      return
    }
    const timer = window.setTimeout(task, remainingMs)
    addItemTimer(item.instanceId, timer)
  }

  registerAt(item.timings.entryDurationMs, () => {
    updateVisibleItem(item.instanceId, (current) => ({
      ...current,
      lifecycleStatus: current.toneStage === 'fresh' ? 'active' : 'aging',
    }))
    if (activeEntryInstanceId === item.instanceId) {
      activeEntryInstanceId = null
    }
    logInsert('entry-complete', item.instanceId, {
      activeEntering: activeEntryInstanceId ? 1 : 0,
    })
  })

  if (POLAROID_CONFIG.debug.disableAgingDuringInsert) {
    return
  }

  const rotationWindowMs = item.timings.rotationWindowMs
  registerAt(rotationWindowMs * POLAROID_CONFIG.aging.freshPhaseEnd, () => {
    updateVisibleItem(item.instanceId, (current) => ({
      ...current,
      lifecycleStatus: 'aging',
      toneStage: 'soft',
    }))
  })
  registerAt(rotationWindowMs * POLAROID_CONFIG.aging.agingPhase1End, () => {
    updateVisibleItem(item.instanceId, (current) => ({
      ...current,
      lifecycleStatus: 'aging',
      toneStage: 'deep',
    }))
  })
  registerAt(rotationWindowMs * POLAROID_CONFIG.aging.agingPhase2End, () => {
    updateVisibleItem(item.instanceId, (current) => ({
      ...current,
      lifecycleStatus: 'aging',
      toneStage: 'final',
    }))
  })
}

function applyLifecycleSnapshot(instanceId: string, elapsedMs: number) {
  updateVisibleItem(instanceId, (current) => {
    if (current.lifecycleStatus === 'exiting') {
      return current
    }

    const toneStage = POLAROID_CONFIG.debug.disableAgingDuringInsert
      ? current.toneStage
      : getToneStageForElapsed(elapsedMs, current.timings.rotationWindowMs)
    const entryCompleted = elapsedMs >= current.timings.entryDurationMs

    return {
      ...current,
      lifecycleStatus: entryCompleted ? (toneStage === 'fresh' ? 'active' : 'aging') : current.lifecycleStatus,
      toneStage,
    }
  })

  const itemTimings = itemTimingForInstance(instanceId)
  if (itemTimings && elapsedMs >= itemTimings.entryDurationMs && activeEntryInstanceId === instanceId) {
    activeEntryInstanceId = null
  }
}

function getToneStageForElapsed(elapsedMs: number, rotationWindowMs: number) {
  const safeWindowMs = Math.max(rotationWindowMs, 1)
  const progress = elapsedMs / safeWindowMs

  if (progress >= POLAROID_CONFIG.aging.agingPhase2End) {
    return 'final'
  }
  if (progress >= POLAROID_CONFIG.aging.agingPhase1End) {
    return 'deep'
  }
  if (progress >= POLAROID_CONFIG.aging.freshPhaseEnd) {
    return 'soft'
  }
  return 'fresh'
}

function startExit(instanceId: string) {
  const current = visibleItems.value.find((item) => item.instanceId === instanceId)
  if (!current) {
    return false
  }

  clearItemTimers(instanceId)
  if (activeEntryInstanceId === instanceId) {
    activeEntryInstanceId = null
  }

  visibleItems.value = visibleItems.value.filter((item) => item.instanceId !== instanceId)
  exitingItems.value = [
    ...exitingItems.value,
    {
      ...current,
      lifecycleStatus: 'exiting',
    },
  ]

  const exitTimer = window.setTimeout(() => {
    clearItemTimers(instanceId)
    exitingItems.value = exitingItems.value.filter((item) => item.instanceId !== instanceId)
    removedAtByIdentity.set(getImageIdentity(current), nowMs())
    insertMetrics.delete(instanceId)
    ensureScheduler(stackLoad.value === 0)
  }, current.timings.exitDurationMs)

  addItemTimer(instanceId, exitTimer)
  return true
}

function moveOldestToExit() {
  const candidates = [...visibleItems.value].sort((left, right) => {
    if (left.enteredAt !== right.enteredAt) {
      return left.enteredAt - right.enteredAt
    }
    return left.order - right.order
  })
  const oldest = candidates[0]
  if (!oldest) {
    return false
  }
  return startExit(oldest.instanceId)
}

function syncUploads(nextUploads: Array<UploadItem & { display_url: string }>) {
  const nextIds = new Set(nextUploads.map((upload) => upload.id))
  const nextById = new Map(nextUploads.map((upload) => [upload.id, upload]))

  visibleItems.value = syncItemSources(visibleItems.value, nextById)
  exitingItems.value = syncItemSources(exitingItems.value, nextById)

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

  const newIds = nextUploads
    .map((upload) => upload.id)
    .filter((uploadId) => !knownPoolIds.has(uploadId))

  if (newIds.length) {
    priorityQueue = dedupeQueue([...newIds, ...priorityQueue])
  }

  knownPoolIds = nextIds
  priorityQueue = priorityQueue.filter((identity) => nextIds.has(identity))
  recentHistory = recentHistory.filter((identity) => nextIds.has(identity))
  for (const identity of [...removedAtByIdentity.keys()]) {
    if (!nextIds.has(identity)) {
      removedAtByIdentity.delete(identity)
    }
  }

  refreshVisibleLifecycleSchedules()
  reconcileVisibleCount()
  ensureScheduler(stackLoad.value === 0)
}

function createActiveItem(upload: UploadItem & { display_url: string }, preparedAt: number): ActivePolaroid {
  instanceCounter += 1
  orderCounter += 1

  return {
    instanceId: `polaroid-${upload.id}-${instanceCounter}`,
    uploadId: upload.id,
    src: upload.display_url,
    alt: upload.filename_original,
    caption: upload.comment,
    enteredAt: preparedAt,
    entryActivatedAt: null,
    timings: timings.value,
    order: orderCounter,
    motionSeed: ((upload.id * 37 + instanceCounter * 17) % 997) / 997,
    layout: buildPolaroidLayout(
      stageSize.value,
      getOccupiedLayouts(),
      targetVisibleCount.value,
      (upload.id * 0.137 + instanceCounter * 0.271) % 1,
    ),
    lifecycleStatus: 'pre_enter',
    toneStage: 'fresh',
  }
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

function pickNextUpload() {
  const selection = pickNextImage({
    pool: availableUploads.value,
    priorityQueue,
    nextCursor,
    blockedIdentities: new Set([
      ...visibleItems.value.map((item) => getImageIdentity(item)),
      ...exitingItems.value.map((item) => getImageIdentity(item)),
      ...(pendingSpawn.value ? [getImageIdentity(pendingSpawn.value.item)] : []),
    ]),
    recentHistory,
    removedAtByIdentity,
    now: nowMs(),
    maxVisiblePhotos: targetVisibleCount.value,
  })

  priorityQueue = selection.nextPriorityQueue
  nextCursor = selection.nextCursor
  return selection.upload
}

function handleImageError(instanceId: string) {
  const brokenItem =
    visibleItems.value.find((item) => item.instanceId === instanceId) ??
    exitingItems.value.find((item) => item.instanceId === instanceId) ??
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

  visibleItems.value = visibleItems.value.filter((item) => item.instanceId !== instanceId)
  exitingItems.value = exitingItems.value.filter((item) => item.instanceId !== instanceId)

  if (pendingSpawn.value?.item.instanceId === instanceId) {
    cancelPendingSpawn()
  }

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
  visibleItems.value = visibleItems.value.map((item) => ({
    ...item,
    layout: rebasePolaroidLayout(item.layout, nextSize, targetVisibleCount.value),
  }))
  exitingItems.value = exitingItems.value.map((item) => ({
    ...item,
    layout: rebasePolaroidLayout(item.layout, nextSize, targetVisibleCount.value),
  }))
  if (pendingSpawn.value) {
    pendingSpawn.value = {
      ...pendingSpawn.value,
      item: {
        ...pendingSpawn.value.item,
        layout: rebasePolaroidLayout(pendingSpawn.value.item.layout, nextSize, targetVisibleCount.value),
      },
    }
  }
}

function refreshActiveTimings() {
  visibleItems.value = visibleItems.value.map((item) => ({
    ...item,
    timings: timings.value,
  }))
  refreshVisibleLifecycleSchedules()

  if (!pendingSpawn.value) {
    return
  }

  pendingSpawn.value = {
    ...pendingSpawn.value,
    item: {
      ...pendingSpawn.value.item,
      timings: timings.value,
      layout: rebasePolaroidLayout(pendingSpawn.value.item.layout, stageSize.value, targetVisibleCount.value),
    },
  }
}

function refreshVisibleLifecycleSchedules() {
  for (const item of visibleItems.value) {
    scheduleLifecycle(item)
  }
}

function reconcileVisibleCount() {
  if (pendingSpawn.value && visibleItems.value.length >= targetVisibleCount.value) {
    cancelPendingSpawn()
  }

  while (visibleItems.value.length > targetVisibleCount.value) {
    if (!moveOldestToExit()) {
      break
    }
  }
}

function ensureScheduler(immediateWhenEmpty: boolean) {
  if (props.paused || !availableUploads.value.length) {
    clearSchedulerTimer()
    nextTickAt = null
    preExitHandledForTick = false
    return
  }

  if (nextTickAt == null) {
    nextTickAt = nowMs() + getInitialTickDelay(immediateWhenEmpty)
    preExitHandledForTick = false
  }
  scheduleSchedulerAction()
}

function rebaseScheduler(forceImmediateTick: boolean) {
  clearSchedulerTimer()
  if (props.paused || !availableUploads.value.length) {
    nextTickAt = null
    preExitHandledForTick = false
    return
  }

  const now = nowMs()
  const remainingMs = nextTickAt == null ? timings.value.spawnIntervalMs : Math.max(0, nextTickAt - now)
  nextTickAt = forceImmediateTick
    ? now
    : now + (stackLoad.value === 0 ? getInitialTickDelay(false) : Math.min(remainingMs, timings.value.spawnIntervalMs))
  preExitHandledForTick = false
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
    preExitHandledForTick = false
  }

  const preExitAt = getScheduledPreExitAt()
  if (preExitAt != null && preExitAt <= now) {
    triggerScheduledPreExit()
    scheduleSchedulerAction()
    return
  }
  if (nextTickAt != null && nextTickAt <= now) {
    runSchedulerTick(false)
    return
  }

  const nextActionAt = preExitAt != null ? Math.min(preExitAt, nextTickAt ?? preExitAt) : nextTickAt
  if (nextActionAt == null) {
    return
  }

  schedulerTimer = window.setTimeout(() => {
    schedulerTimer = null
    const duePreExitAt = getScheduledPreExitAt()
    if (duePreExitAt != null && duePreExitAt <= nowMs()) {
      triggerScheduledPreExit()
      scheduleSchedulerAction()
      return
    }
    runSchedulerTick(false)
  }, Math.max(0, Math.round(nextActionAt - now)))
}

function getInitialTickDelay(immediateWhenEmpty: boolean) {
  if (stackLoad.value === 0) {
    return immediateWhenEmpty ? 0 : POLAROID_CONFIG.timing.entryRetryDelayMs
  }
  return timings.value.spawnIntervalMs
}

function getScheduledPreExitAt() {
  if (!timings.value.steadyStateRotationEnabled || preExitHandledForTick || nextTickAt == null) {
    return null
  }
  if (stackLoad.value < targetVisibleCount.value) {
    return null
  }
  return nextTickAt - timings.value.preExitLeadTimeMs
}

function triggerScheduledPreExit() {
  preExitHandledForTick = true
  if (!isSteadyStateActive()) {
    return
  }
  if (visibleItems.value.length >= targetVisibleCount.value) {
    moveOldestToExit()
  }
}

function advanceSchedulerTick(now: number, force: boolean) {
  const baseTickAt = force ? now : nextTickAt ?? now
  let candidateTickAt = baseTickAt + timings.value.spawnIntervalMs
  while (candidateTickAt <= now) {
    candidateTickAt += timings.value.spawnIntervalMs
  }
  nextTickAt = candidateTickAt
  preExitHandledForTick = false
  scheduleSchedulerAction()
}

function isSteadyStateActive() {
  return timings.value.steadyStateRotationEnabled && stackLoad.value >= targetVisibleCount.value
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

function itemTimingForInstance(instanceId: string) {
  const item =
    visibleItems.value.find((entry) => entry.instanceId === instanceId) ??
    exitingItems.value.find((entry) => entry.instanceId === instanceId)
  return item?.timings
}

function getOccupiedLayouts() {
  return [
    ...visibleItems.value.map((item) => item.layout),
    ...exitingItems.value.map((item) => item.layout),
    ...(pendingSpawn.value ? [pendingSpawn.value.item.layout] : []),
  ]
}

function pushRecentHistory(uploadId: number) {
  recentHistory = updateRecentHistory(
    recentHistory,
    uploadId,
    availableUploads.value.length,
    targetVisibleCount.value,
  )
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
  if (pendingSpawnTimer != null) {
    window.clearTimeout(pendingSpawnTimer)
    pendingSpawnTimer = null
  }
  if (pendingSpawn.value) {
    insertMetrics.delete(pendingSpawn.value.item.instanceId)
  }
  pendingSpawn.value = null
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

function logInsert(event: string, instanceId: string, details: Record<string, unknown>) {
  if (!POLAROID_CONFIG.debug.logInsertTimings) {
    return
  }
  console.debug('[polaroid-insert]', event, {
    instanceId,
    activeEntering: activeEntryInstanceId ? 1 : 0,
    visibleCount: visibleItems.value.length,
    exitingCount: exitingItems.value.length,
    stackLoad: stackLoad.value,
    nextTickInMs: nextTickAt == null ? null : Math.round(nextTickAt - nowMs()),
    preExitLeadTimeMs: timings.value.preExitLeadTimeMs,
    ...details,
  })
}

function nowMs() {
  return window.performance.now()
}
</script>

<template>
  <section ref="stageRef" class="polaroid-stage">
    <div class="polaroid-stage__clouds" aria-hidden="true">
      <div
        v-for="cloud in cloudLayers"
        :key="cloud.id"
        class="polaroid-stage__cloud"
        :style="cloud.style"
      />
    </div>
    <div class="polaroid-stage__glow polaroid-stage__glow--warm" />
    <div class="polaroid-stage__glow polaroid-stage__glow--cool" />
    <div class="polaroid-stage__surface" />

    <div class="polaroid-stage__flash-layer" aria-hidden="true">
      <div
        v-for="flash in flashes"
        :key="flash.id"
        class="polaroid-stage__flash"
        :style="getFlashStyle(flash)"
      />
    </div>

    <div class="polaroid-stage__stack" aria-hidden="true">
      <SelfiePolaroidItem
        v-for="item in stackItems"
        :key="item.instanceId"
        :item="item"
        :vintage-look-enabled="props.vintageLookEnabled"
        @image-error="handleImageError"
      />
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
  background: linear-gradient(180deg, #04070b 0%, #03050a 42%, #020308 100%);
}

.polaroid-stage::before {
  content: '';
  position: absolute;
  inset: -8%;
  background:
    radial-gradient(circle at 24% 18%, rgba(146, 202, 255, 0.2), rgba(146, 202, 255, 0.08) 18%, transparent 34%),
    linear-gradient(180deg, rgba(2, 6, 11, 0.12), rgba(1, 4, 8, 0.22));
  animation: polaroid-spotlight-drift 24s ease-in-out infinite alternate;
  will-change: transform, opacity;
  pointer-events: none;
}

.polaroid-stage__glow,
.polaroid-stage__clouds,
.polaroid-stage__surface,
.polaroid-stage__flash-layer,
.polaroid-stage__stack {
  position: absolute;
  inset: 0;
}

.polaroid-stage__clouds {
  display: none;
}

.polaroid-stage__cloud {
  position: absolute;
  border-radius: 999px;
  transform: translate3d(0, 0, 0);
  animation: cloud-drift var(--cloud-duration) ease-in-out infinite alternate;
  animation-delay: var(--cloud-delay);
  will-change: transform;
  contain: paint;
}

.polaroid-stage__glow {
  display: none;
}

.polaroid-stage__glow--warm {
  top: -16%;
  left: -8%;
  width: min(44vw, 40rem);
  height: min(44vw, 40rem);
  background: rgba(255, 174, 102, 0.22);
}

.polaroid-stage__glow--cool {
  top: 8%;
  right: -14%;
  width: min(38vw, 34rem);
  height: min(38vw, 34rem);
  background: rgba(103, 182, 220, 0.18);
}

.polaroid-stage__surface {
  inset: 0;
  background: none;
  box-shadow: none;
}

.polaroid-stage__surface::after {
  content: none;
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

@keyframes polaroid-spotlight-drift {
  0% {
    transform: translate3d(-1.5%, -1.2%, 0) scale(1);
    opacity: 0.88;
  }
  50% {
    transform: translate3d(1.2%, 0.8%, 0) scale(1.035);
    opacity: 1;
  }
  100% {
    transform: translate3d(2.4%, 1.6%, 0) scale(1.06);
    opacity: 0.92;
  }
}

@keyframes cloud-drift {
  0% {
    transform: translate3d(calc(var(--cloud-drift-x) * -0.45), calc(var(--cloud-drift-y) * -0.55), 0);
  }
  100% {
    transform: translate3d(var(--cloud-drift-x), var(--cloud-drift-y), 0);
  }
}
</style>
