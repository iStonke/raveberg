import type { UploadItem } from '../../../services/api'
import { POLAROID_CONFIG, clamp, getVisiblePhotoCount } from './polaroidConfig'
import type { ActivePolaroid } from './polaroidTypes'

type UploadWithDisplay = UploadItem & { display_url: string }
type ImageIdentity = number

interface SpawnSelectionOptions {
  pool: UploadWithDisplay[]
  priorityQueue: ImageIdentity[]
  nextCursor: number
  blockedIdentities: Set<ImageIdentity>
  recentHistory: ImageIdentity[]
  removedAtByIdentity: Map<ImageIdentity, number>
  now: number
  maxVisiblePhotos: number
}

interface SelectionStage {
  allowRecent: boolean
  allowCooldown: boolean
}

export interface SpawnSelectionResult {
  upload: UploadWithDisplay | null
  nextCursor: number
  nextPriorityQueue: ImageIdentity[]
}

export function getImageIdentity(upload: Pick<UploadItem, 'id'> | Pick<ActivePolaroid, 'uploadId'>): ImageIdentity {
  return 'id' in upload ? upload.id : upload.uploadId
}

export function updateRecentHistory(
  history: ImageIdentity[],
  identity: ImageIdentity,
  poolSize: number,
  maxVisiblePhotos: number,
) {
  const historySize = getRecentHistoryLimit(poolSize, maxVisiblePhotos)
  return [identity, ...history.filter((entry) => entry !== identity)].slice(0, historySize)
}

export function pickNextImage(options: SpawnSelectionOptions): SpawnSelectionResult {
  const pool = options.pool
  if (!pool.length) {
    return {
      upload: null,
      nextCursor: options.nextCursor,
      nextPriorityQueue: [],
    }
  }

  const byIdentity = new Map(pool.map((upload) => [getImageIdentity(upload), upload]))
  const nextPriorityQueue = dedupeQueue(options.priorityQueue).filter((identity) => byIdentity.has(identity))
  const recentBlocked = new Set(
    options.recentHistory.slice(0, getRecentWindowSize(pool.length, options.maxVisiblePhotos)),
  )
  const orderedPool = getOrderedPool(pool, options.nextCursor)
  const queuedPool = nextPriorityQueue
    .map((identity) => byIdentity.get(identity))
    .filter((upload): upload is UploadWithDisplay => Boolean(upload))
  const selectionStages: SelectionStage[] = POLAROID_CONFIG.queue.fallbackRelaxRecent
    ? [
        { allowRecent: false, allowCooldown: false },
        { allowRecent: true, allowCooldown: false },
        { allowRecent: true, allowCooldown: true },
      ]
    : [
        { allowRecent: false, allowCooldown: false },
        { allowRecent: false, allowCooldown: true },
      ]

  for (const stage of selectionStages) {
    const queuedCandidate = findCandidate(
      queuedPool,
      stage,
      options.blockedIdentities,
      recentBlocked,
      options.removedAtByIdentity,
      options.now,
    )
    if (queuedCandidate) {
      return {
        upload: queuedCandidate,
        nextCursor: getAdvancedCursor(pool, options.nextCursor, queuedCandidate),
        nextPriorityQueue: nextPriorityQueue.filter((identity) => identity !== getImageIdentity(queuedCandidate)),
      }
    }

    const poolCandidate = findCandidate(
      orderedPool,
      stage,
      options.blockedIdentities,
      recentBlocked,
      options.removedAtByIdentity,
      options.now,
    )
    if (poolCandidate) {
      return {
        upload: poolCandidate,
        nextCursor: getAdvancedCursor(pool, options.nextCursor, poolCandidate),
        nextPriorityQueue: nextPriorityQueue.filter((identity) => identity !== getImageIdentity(poolCandidate)),
      }
    }
  }

  return {
    upload: null,
    nextCursor: options.nextCursor,
    nextPriorityQueue,
  }
}

export function getRecentWindowSize(poolSize: number, maxVisiblePhotos: number) {
  const visibleCount = getVisiblePhotoCount(maxVisiblePhotos)
  const desiredWindow = Math.max(
    2,
    POLAROID_CONFIG.queue.recentWindowSize + Math.max(0, Math.ceil((visibleCount - 4) / 2)),
  )

  return clamp(desiredWindow, 2, Math.max(Math.min(poolSize - 1, POLAROID_CONFIG.queue.recentHistoryMax), 2))
}

function findCandidate(
  uploads: UploadWithDisplay[],
  stage: SelectionStage,
  blockedIdentities: Set<ImageIdentity>,
  recentBlocked: Set<ImageIdentity>,
  removedAtByIdentity: Map<ImageIdentity, number>,
  now: number,
) {
  const maxAttempts = Math.min(uploads.length, POLAROID_CONFIG.queue.candidateSelectionMaxAttempts)

  for (let index = 0; index < maxAttempts; index += 1) {
    const upload = uploads[index]
    const identity = getImageIdentity(upload)
    if (POLAROID_CONFIG.queue.preventSimultaneousDuplicates && blockedIdentities.has(identity)) {
      continue
    }
    if (!stage.allowRecent && recentBlocked.has(identity)) {
      continue
    }
    if (!stage.allowCooldown && isInCooldown(identity, removedAtByIdentity, now)) {
      continue
    }
    return upload
  }

  return null
}

function getOrderedPool(pool: UploadWithDisplay[], nextCursor: number) {
  return pool.map((_, offset) => pool[(nextCursor + offset) % pool.length])
}

function getAdvancedCursor(pool: UploadWithDisplay[], nextCursor: number, upload: UploadWithDisplay) {
  const selectedIdentity = getImageIdentity(upload)
  for (let offset = 0; offset < pool.length; offset += 1) {
    const index = (nextCursor + offset) % pool.length
    if (getImageIdentity(pool[index]) === selectedIdentity) {
      return (index + 1) % pool.length
    }
  }

  return nextCursor
}

function getRecentHistoryLimit(poolSize: number, maxVisiblePhotos: number) {
  return clamp(
    getRecentWindowSize(poolSize, maxVisiblePhotos) + 2,
    3,
    Math.max(Math.min(poolSize, POLAROID_CONFIG.queue.recentHistoryMax), 3),
  )
}

function isInCooldown(identity: ImageIdentity, removedAtByIdentity: Map<ImageIdentity, number>, now: number) {
  const removedAt = removedAtByIdentity.get(identity)
  return removedAt != null && now - removedAt < POLAROID_CONFIG.queue.imageCooldownMs
}

function dedupeQueue(queue: ImageIdentity[]) {
  const seen = new Set<ImageIdentity>()
  return queue.filter((identity) => {
    if (seen.has(identity)) {
      return false
    }
    seen.add(identity)
    return true
  })
}
