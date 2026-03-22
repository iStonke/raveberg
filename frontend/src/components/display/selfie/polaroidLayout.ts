import {
  POLAROID_CONFIG,
  clamp,
  getPolaroidLayoutDensity,
} from './polaroidConfig'
import type { PolaroidLayout, StageSize } from './polaroidTypes'

interface LayoutCandidate {
  layout: PolaroidLayout
  score: number
  region: string
  index: number
}

interface LayoutZoneLike {
  id: string
  weight: number
  column: string
  row: string
}

export interface PolaroidPlacementAssessment {
  layout: PolaroidLayout
  score: number
  coverageBefore: number
  coverageAfter: number
  maxOverlapRatio: number
  attempts: number
  chosenCandidateIndex: number
  candidatePoolSize: number
  region: string
  chosenX: number
  chosenY: number
  chosenRotation: number
}

interface LayoutFootprint {
  left: number
  right: number
  top: number
  bottom: number
}

type FootprintMode = 'collision' | 'coverage'
const RESTING_POLAROID_SCALE = 1

export function buildPolaroidLayout(
  stageSize: StageSize,
  existingLayouts: PolaroidLayout[],
  maxVisiblePhotos: number,
  randomSeed = Math.random(),
) {
  return assessPolaroidPlacement(stageSize, existingLayouts, maxVisiblePhotos, randomSeed).layout
}

export function assessPolaroidPlacement(
  stageSize: StageSize,
  existingLayouts: PolaroidLayout[],
  maxVisiblePhotos: number,
  randomSeed = Math.random(),
): PolaroidPlacementAssessment {
  const density = getPolaroidLayoutDensity(maxVisiblePhotos)
  const dimensions = getPolaroidDimensions(stageSize, maxVisiblePhotos)
  const safeBounds = getSafeBounds(stageSize, dimensions)
  const occupiedAnchors = new Set(existingLayouts.map((layout) => layout.anchorId))
  const candidates: LayoutCandidate[] = []
  let attempts = 0
  let candidateIndex = 0

  const registerCandidate = (
    zone: LayoutZoneLike,
    normalizedX: number,
    normalizedY: number,
    candidateSeed: number,
  ) => {
    attempts += 1
    const layout = createLayoutFromNormalized(
      stageSize,
      dimensions.width,
      normalizedX,
      normalizedY,
      zone.id,
      randomBetween(POLAROID_CONFIG.rotation.min, POLAROID_CONFIG.rotation.max, candidateSeed + 0.19),
      RESTING_POLAROID_SCALE,
    )

    const score = scoreLayoutCandidate(
      layout,
      existingLayouts,
      safeBounds,
      occupiedAnchors.has(zone.id),
      zone,
      density,
      candidateSeed,
    )

    candidates.push({
      layout,
      score,
      region: getLayoutRegion(layout),
      index: candidateIndex,
    })
    candidateIndex += 1
  }

  for (const zone of shuffleBySeed(POLARAROID_LAYOUT_ZONES, randomSeed + 0.07)) {
    for (let attempt = 0; attempt < POLAROID_CONFIG.layout.candidateAttemptsPerZone; attempt += 1) {
      const jitterSeed = randomSeed + attempt * 0.173 + zone.x * 0.31 + zone.y * 0.29
      registerCandidate(
        zone,
        clamp(zone.x + randomBetween(-0.12, 0.12, jitterSeed), 0.01, 0.99),
        clamp(zone.y + randomBetween(-0.13, 0.13, jitterSeed + 0.11), 0.01, 0.99),
        jitterSeed,
      )
    }
  }

  for (const zone of shuffleBySeed(buildGridCandidateZones(), randomSeed + 0.33)) {
    const jitterSeed = randomSeed + zone.weight * 0.271 + zone.id.length * 0.019
    registerCandidate(
      zone,
      clamp(zone.normalizedX + randomBetween(-0.08, 0.08, jitterSeed), 0.01, 0.99),
      clamp(zone.normalizedY + randomBetween(-0.08, 0.08, jitterSeed + 0.11), 0.01, 0.99),
      jitterSeed,
    )
  }

  for (const zone of buildFreeformCandidateZones(randomSeed)) {
    registerCandidate(zone, zone.normalizedX, zone.normalizedY, zone.seed)
  }

  const sortedCandidates = [...candidates].sort((left, right) => left.score - right.score)
  const best = sortedCandidates[0] ?? null
  const candidatePool = best
    ? sortedCandidates
        .filter((candidate) => candidate.score <= best.score + POLAROID_CONFIG.layout.candidateSelectionScoreWindow)
        .slice(0, POLAROID_CONFIG.layout.candidateSelectionPoolSize)
    : []
  const chosen =
    chooseCandidate(candidatePool, randomSeed + attempts * 0.047 + existingLayouts.length * 0.131) ?? best
  const fallbackLayout =
    chosen?.layout ??
    createLayoutFromNormalized(stageSize, dimensions.width, 0.5, 0.4, 'fallback', 0, RESTING_POLAROID_SCALE)

  return {
    layout: fallbackLayout,
    score: chosen?.score ?? 0,
    coverageBefore: measureLayoutCoverage(stageSize, existingLayouts),
    coverageAfter: measureLayoutCoverage(stageSize, [...existingLayouts, fallbackLayout]),
    maxOverlapRatio: getMaxOverlapRatio(fallbackLayout, existingLayouts),
    attempts,
    chosenCandidateIndex: chosen?.index ?? -1,
    candidatePoolSize: candidatePool.length,
    region: chosen?.region ?? getLayoutRegion(fallbackLayout),
    chosenX: Math.round(fallbackLayout.x),
    chosenY: Math.round(fallbackLayout.y),
    chosenRotation: Number(fallbackLayout.rotation.toFixed(2)),
  }
}

export function rebasePolaroidLayout(layout: PolaroidLayout, stageSize: StageSize, maxVisiblePhotos: number) {
  const dimensions = getPolaroidDimensions(stageSize, maxVisiblePhotos)
  return createLayoutFromNormalized(
    stageSize,
    dimensions.width,
    layout.normalizedX,
    layout.normalizedY,
    layout.anchorId,
    layout.rotation,
    RESTING_POLAROID_SCALE,
  )
}

export function getPolaroidDimensions(stageSize: StageSize, maxVisiblePhotos: number) {
  const density = getPolaroidLayoutDensity(maxVisiblePhotos)
  const widthFactor =
    stageSize.width < 760
      ? POLAROID_CONFIG.item.compactWidthFactor
      : POLAROID_CONFIG.item.widthFactor
  const width = clamp(
    Math.min(stageSize.width * widthFactor, stageSize.height * POLAROID_CONFIG.item.heightLimitFactor) *
      density.sizeScale,
    POLAROID_CONFIG.item.minWidthPx,
    POLAROID_CONFIG.item.maxWidthPx,
  )

  return {
    width: Math.round(width),
    height: Math.round(width * POLAROID_CONFIG.item.aspectRatio),
  }
}

function createLayoutFromNormalized(
  stageSize: StageSize,
  width: number,
  normalizedX: number,
  normalizedY: number,
  anchorId: string,
  rotation: number,
  scale: number,
) {
  const height = width * POLAROID_CONFIG.item.aspectRatio
  const safeBounds = getSafeBounds(stageSize, { width, height })
  const x = safeBounds.left + safeBounds.width * normalizedX
  const y = safeBounds.top + safeBounds.height * normalizedY

  return {
    x,
    y,
    width,
    height,
    rotation,
    scale,
    anchorId,
    normalizedX,
    normalizedY,
  }
}

function getSafeBounds(stageSize: StageSize, dimensions: { width: number; height: number }) {
  const shadowPadding = Math.max(10, dimensions.width * 0.045)
  const horizontalPadding = Math.max(8, dimensions.width * 0.025)
  const topRotationPadding = Math.max(dimensions.width, dimensions.height) * 0.045
  const bottomRotationPadding = Math.max(dimensions.width, dimensions.height) * 0.028
  const left =
    stageSize.width * POLAROID_CONFIG.zonePadding.left + dimensions.width * 0.5 + shadowPadding + horizontalPadding
  const right =
    stageSize.width * (1 - POLAROID_CONFIG.zonePadding.right) - dimensions.width * 0.5 - shadowPadding - horizontalPadding
  const top =
    stageSize.height * POLAROID_CONFIG.zonePadding.top + dimensions.height * 0.5 + topRotationPadding
  const bottom =
    stageSize.height * (1 - POLAROID_CONFIG.zonePadding.bottom) -
    dimensions.height * 0.5 -
    shadowPadding -
    bottomRotationPadding

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(right - left, 1),
    height: Math.max(bottom - top, 1),
  }
}

function scoreLayoutCandidate(
  candidate: PolaroidLayout,
  existingLayouts: PolaroidLayout[],
  safeBounds: ReturnType<typeof getSafeBounds>,
  anchorAlreadyUsed: boolean,
  zone: LayoutZoneLike,
  density: ReturnType<typeof getPolaroidLayoutDensity>,
  jitterSeed: number,
) {
  const candidateBounds = getLayoutFootprint(candidate, 'collision')
  const centerDistance = Math.abs(candidate.normalizedX - 0.5) + Math.abs(candidate.normalizedY - 0.5)
  const verticalSpreadBias = Math.abs(candidate.normalizedY - 0.5)
  const edgeDistance = Math.max(Math.abs(candidate.normalizedX - 0.5), Math.abs(candidate.normalizedY - 0.5)) * 2
  const region = getLayoutRegion(candidate)
  let score =
    (anchorAlreadyUsed ? POLAROID_CONFIG.layout.anchorReusePenalty : 0) +
    (1.04 - zone.weight) * 68 -
    centerDistance * 14 -
    verticalSpreadBias * 10 -
    edgeDistance * 12

  const sameRegionCount = existingLayouts.filter((layout) => getLayoutRegion(layout) === region).length
  score += sameRegionCount * POLAROID_CONFIG.layout.sameRegionPenalty

  if (
    candidateBounds.left < safeBounds.left - candidate.width * 0.04 ||
    candidateBounds.right > safeBounds.right + candidate.width * 0.04 ||
    candidateBounds.top < safeBounds.top - candidate.height * 0.04 ||
    candidateBounds.bottom > safeBounds.bottom + candidate.height * 0.04
  ) {
    score += 1_400
  }

  for (const layout of existingLayouts) {
    const existingBounds = getLayoutFootprint(layout, 'collision')
    const overlapX = Math.max(
      0,
      Math.min(candidateBounds.right, existingBounds.right) - Math.max(candidateBounds.left, existingBounds.left),
    )
    const overlapY = Math.max(
      0,
      Math.min(candidateBounds.bottom, existingBounds.bottom) - Math.max(candidateBounds.top, existingBounds.top),
    )
    const overlapArea = overlapX * overlapY
    const smallerArea = Math.min(
      (candidateBounds.right - candidateBounds.left) * (candidateBounds.bottom - candidateBounds.top),
      (existingBounds.right - existingBounds.left) * (existingBounds.bottom - existingBounds.top),
    )
    const overlapRatio = smallerArea > 0 ? overlapArea / smallerArea : 0
    const distance = Math.hypot(candidate.x - layout.x, candidate.y - layout.y)
    const minDistance = candidate.width * density.minCenterDistanceFactor
    const preferredDistance = candidate.width * density.preferredDistanceFactor

    score += overlapRatio * 620
    if (overlapRatio > density.overlapTolerance) {
      score += 360
    }
    if (distance < minDistance) {
      score += (minDistance - distance) * 3.1
    } else if (distance < preferredDistance) {
      score += (preferredDistance - distance) * 0.6
    } else {
      score -= Math.min(distance - preferredDistance, candidate.width * 0.85) * 0.3
    }

    if (areZonesInSameBand(zone.id, layout.anchorId)) {
      score += POLAROID_CONFIG.layout.sameBandPenalty
    }
  }

  return score + randomBetween(0, 24, jitterSeed + 0.71)
}

function buildGridCandidateZones() {
  const columns = 8
  const rows = 6
  const zones: Array<LayoutZoneLike & { normalizedX: number; normalizedY: number }> = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const normalizedX = (column + 0.5) / columns
      const normalizedY = (row + 0.5) / rows
      const edgeBias =
        Math.max(Math.abs(normalizedX - 0.5), Math.abs(normalizedY - 0.5)) * 2

      zones.push({
        id: `grid-${row}-${column}`,
        normalizedX,
        normalizedY,
        weight: 0.92 + edgeBias * 0.2,
        column: `grid-${column}`,
        row: `grid-${row}`,
      })
    }
  }

  return zones
}

function buildFreeformCandidateZones(randomSeed: number) {
  const zones: Array<LayoutZoneLike & { normalizedX: number; normalizedY: number; seed: number }> = []

  for (let index = 0; index < POLAROID_CONFIG.layout.freeformCandidateCount; index += 1) {
    const seed = randomSeed + index * 0.417
    const rawX = randomBetween(0.035, 0.965, seed + 0.13)
    const rawY = randomBetween(0.035, 0.965, seed + 0.37)
    const spreadX = clamp(rawX + randomBetween(-0.08, 0.08, seed + 0.59), 0.01, 0.99)
    const spreadY = clamp(rawY + randomBetween(-0.08, 0.08, seed + 0.83), 0.01, 0.99)
    const region = getRegionFromNormalized(spreadX, spreadY)
    const edgeBias = Math.max(Math.abs(spreadX - 0.5), Math.abs(spreadY - 0.5)) * 2

    zones.push({
      id: `freeform-${region}-${index}`,
      normalizedX: spreadX,
      normalizedY: spreadY,
      weight: 0.94 + edgeBias * 0.12,
      column: region.split('-')[1] ?? 'mid',
      row: region.split('-')[0] ?? 'center',
      seed,
    })
  }

  return zones
}

export function getLayoutFootprint(layout: PolaroidLayout, mode: FootprintMode = 'collision'): LayoutFootprint {
  const paddingX = mode === 'coverage' ? 8 : 18
  const paddingY = mode === 'coverage' ? 10 : 24
  const boxWidth = layout.width + paddingX
  const boxHeight = layout.height + paddingY

  return {
    left: layout.x - boxWidth / 2,
    right: layout.x + boxWidth / 2,
    top: layout.y - boxHeight / 2,
    bottom: layout.y + boxHeight / 2,
  }
}

export function measureLayoutCoverage(stageSize: StageSize, layouts: PolaroidLayout[]) {
  if (!layouts.length) {
    return 0
  }

  const usableBounds = getUsableStageBounds(stageSize)
  const footprints = layouts.map((layout) => getLayoutFootprint(layout, 'coverage'))
  let occupiedSamples = 0
  const totalSamples = POLAROID_CONFIG.stageCapacity.sampleColumns * POLAROID_CONFIG.stageCapacity.sampleRows

  for (let row = 0; row < POLAROID_CONFIG.stageCapacity.sampleRows; row += 1) {
    for (let column = 0; column < POLAROID_CONFIG.stageCapacity.sampleColumns; column += 1) {
      const x =
        usableBounds.left + usableBounds.width * ((column + 0.5) / POLAROID_CONFIG.stageCapacity.sampleColumns)
      const y =
        usableBounds.top + usableBounds.height * ((row + 0.5) / POLAROID_CONFIG.stageCapacity.sampleRows)

      if (footprints.some((footprint) => isPointInsideFootprint(x, y, footprint))) {
        occupiedSamples += 1
      }
    }
  }

  return totalSamples > 0 ? occupiedSamples / totalSamples : 0
}

function areZonesInSameBand(leftAnchor: string, rightAnchor: string) {
  const leftZone = POLAROID_CONFIG.layoutZones.find((zone) => zone.id === leftAnchor)
  const rightZone = POLAROID_CONFIG.layoutZones.find((zone) => zone.id === rightAnchor)
  if (!leftZone || !rightZone) {
    return false
  }

  return leftZone.row === rightZone.row || leftZone.column === rightZone.column
}

function getLayoutRegion(layout: Pick<PolaroidLayout, 'normalizedX' | 'normalizedY'>) {
  return getRegionFromNormalized(layout.normalizedX, layout.normalizedY)
}

function getRegionFromNormalized(normalizedX: number, normalizedY: number) {
  const horizontal = normalizedX < 0.33 ? 'left' : normalizedX > 0.67 ? 'right' : 'center'
  const vertical = normalizedY < 0.33 ? 'top' : normalizedY > 0.67 ? 'bottom' : 'middle'
  return `${vertical}-${horizontal}`
}

function chooseCandidate(candidates: LayoutCandidate[], seed: number) {
  if (!candidates.length) {
    return null
  }

  const weighted = candidates.map((candidate, index) => ({
    candidate,
    weight: 1 / Math.pow(index + 1, 0.72),
  }))
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0)
  const target = randomBetween(0, totalWeight, seed)
  let cursor = 0

  for (const entry of weighted) {
    cursor += entry.weight
    if (target <= cursor) {
      return entry.candidate
    }
  }

  return weighted[weighted.length - 1]?.candidate ?? null
}

function shuffleBySeed<T>(items: readonly T[], seed: number) {
  return [...items]
    .map((item, index) => ({
      item,
      sortKey: randomBetween(0, 1, seed + index * 0.137),
    }))
    .sort((left, right) => left.sortKey - right.sortKey)
    .map((entry) => entry.item)
}

const POLARAROID_LAYOUT_ZONES = POLAROID_CONFIG.layoutZones

function getMaxOverlapRatio(candidate: PolaroidLayout, existingLayouts: PolaroidLayout[]) {
  const candidateBounds = getLayoutFootprint(candidate, 'coverage')
  let maxOverlapRatio = 0

  for (const layout of existingLayouts) {
    const existingBounds = getLayoutFootprint(layout, 'coverage')
    const overlapMetrics = getOverlapMetrics(candidateBounds, existingBounds)
    if (overlapMetrics.overlapRatio > maxOverlapRatio) {
      maxOverlapRatio = overlapMetrics.overlapRatio
    }
  }

  return maxOverlapRatio
}

function getOverlapMetrics(left: LayoutFootprint, right: LayoutFootprint) {
  const overlapX = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
  const overlapY = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top))
  const overlapArea = overlapX * overlapY
  const smallerArea = Math.min(
    (left.right - left.left) * (left.bottom - left.top),
    (right.right - right.left) * (right.bottom - right.top),
  )

  return {
    overlapArea,
    overlapRatio: smallerArea > 0 ? overlapArea / smallerArea : 0,
  }
}

function getUsableStageBounds(stageSize: StageSize) {
  const left = stageSize.width * POLAROID_CONFIG.zonePadding.left
  const top = stageSize.height * POLAROID_CONFIG.zonePadding.top
  const right = stageSize.width * (1 - POLAROID_CONFIG.zonePadding.right)
  const bottom = stageSize.height * (1 - POLAROID_CONFIG.zonePadding.bottom)

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(right - left, 1),
    height: Math.max(bottom - top, 1),
  }
}

function isPointInsideFootprint(x: number, y: number, footprint: LayoutFootprint) {
  return x >= footprint.left && x <= footprint.right && y >= footprint.top && y <= footprint.bottom
}

function randomBetween(min: number, max: number, seed: number) {
  const value = Math.sin(seed * 12_989.341 + 78.233) * 43_758.5453
  const normalized = value - Math.floor(value)
  return min + (max - min) * normalized
}
