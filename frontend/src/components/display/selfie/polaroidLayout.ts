import {
  POLAROID_CONFIG,
  clamp,
  getPolaroidLayoutDensity,
  getVisiblePhotoCount,
} from './polaroidConfig'
import type { PolaroidLayout, StageSize } from './polaroidTypes'

interface LayoutCandidate {
  layout: PolaroidLayout
  score: number
}

export function buildPolaroidLayout(
  stageSize: StageSize,
  existingLayouts: PolaroidLayout[],
  maxVisiblePhotos: number,
  randomSeed = Math.random(),
) {
  const density = getPolaroidLayoutDensity(maxVisiblePhotos)
  const dimensions = getPolaroidDimensions(stageSize, maxVisiblePhotos)
  const safeBounds = getSafeBounds(stageSize, dimensions)
  const occupiedAnchors = new Set(existingLayouts.map((layout) => layout.anchorId))
  let best: LayoutCandidate | null = null

  for (const zone of POLAROID_CONFIG.layoutZones) {
    for (let attempt = 0; attempt < POLAROID_CONFIG.layout.candidateAttemptsPerZone; attempt += 1) {
      const jitterSeed = randomSeed + attempt * 0.173 + zone.x * 0.31 + zone.y * 0.29
      const normalizedX = clamp(zone.x + randomBetween(-0.065, 0.065, jitterSeed), 0.01, 0.99)
      const normalizedY = clamp(zone.y + randomBetween(-0.06, 0.06, jitterSeed + 0.11), 0.01, 0.99)
      const layout = createLayoutFromNormalized(
        stageSize,
        dimensions.width,
        normalizedX,
        normalizedY,
        zone.id,
        randomBetween(POLAROID_CONFIG.rotation.min, POLAROID_CONFIG.rotation.max, jitterSeed + 0.19),
        randomBetween(POLAROID_CONFIG.scale.min, POLAROID_CONFIG.scale.max, jitterSeed + 0.37),
      )

      const score = scoreLayoutCandidate(
        layout,
        existingLayouts,
        safeBounds,
        occupiedAnchors.has(zone.id),
        zone,
        density,
        jitterSeed,
      )

      if (!best || score < best.score) {
        best = { layout, score }
      }
    }
  }

  return best?.layout ?? createLayoutFromNormalized(stageSize, dimensions.width, 0.5, 0.4, 'fallback', 0, 1)
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
    layout.scale,
  )
}

export function getPolaroidDimensions(stageSize: StageSize, maxVisiblePhotos: number) {
  const density = getPolaroidLayoutDensity(maxVisiblePhotos)
  const visibleCount = getVisiblePhotoCount(maxVisiblePhotos)
  const widthFactor =
    stageSize.width < 760
      ? POLAROID_CONFIG.item.compactWidthFactor
      : POLAROID_CONFIG.item.defaultWidthFactor
  const width = clamp(
    Math.min(stageSize.width * widthFactor * density.sizeScale, stageSize.height * 0.42 * density.sizeScale) *
      getWidthBiasForCount(visibleCount),
    POLAROID_CONFIG.item.minWidthPx,
    POLAROID_CONFIG.item.maxWidthPx,
  )

  return {
    width,
    height: width * POLAROID_CONFIG.item.aspectRatio,
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
  const shadowPadding = Math.max(14, dimensions.width * 0.06)
  const rotatedPadding = Math.max(dimensions.width, dimensions.height) * 0.09
  const left =
    stageSize.width * POLAROID_CONFIG.zonePadding.left + dimensions.width * 0.5 + shadowPadding
  const right =
    stageSize.width * (1 - POLAROID_CONFIG.zonePadding.right) - dimensions.width * 0.5 - shadowPadding
  const top =
    stageSize.height * POLAROID_CONFIG.zonePadding.top + dimensions.height * 0.5 + rotatedPadding
  const bottom =
    stageSize.height * (1 - POLAROID_CONFIG.zonePadding.bottom) -
    dimensions.height * 0.5 -
    shadowPadding

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
  zone: (typeof POLAROID_CONFIG.layoutZones)[number],
  density: ReturnType<typeof getPolaroidLayoutDensity>,
  jitterSeed: number,
) {
  const candidateBounds = getLayoutFootprint(candidate)
  const centerDistance = Math.abs(candidate.normalizedX - 0.5) + Math.abs(candidate.normalizedY - 0.5)
  let score = (anchorAlreadyUsed ? 200 : 0) + (1.08 - zone.weight) * 180 - centerDistance * 28

  if (
    candidateBounds.left < safeBounds.left - candidate.width * 0.04 ||
    candidateBounds.right > safeBounds.right + candidate.width * 0.04 ||
    candidateBounds.top < safeBounds.top - candidate.height * 0.04 ||
    candidateBounds.bottom > safeBounds.bottom + candidate.height * 0.04
  ) {
    score += 1_400
  }

  for (const layout of existingLayouts) {
    const existingBounds = getLayoutFootprint(layout)
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

    score += overlapRatio * 1_200
    if (overlapRatio > density.overlapTolerance) {
      score += 880
    }
    if (distance < minDistance) {
      score += (minDistance - distance) * 6.5
    } else if (distance < preferredDistance) {
      score += (preferredDistance - distance) * 1.15
    } else {
      score -= Math.min(distance - preferredDistance, candidate.width * 0.55) * 0.22
    }

    if (areZonesInSameBand(zone.id, layout.anchorId)) {
      score += 42
    }
  }

  return score + randomBetween(0, 18, jitterSeed + 0.71)
}

function getLayoutFootprint(layout: PolaroidLayout) {
  const radians = (layout.rotation * Math.PI) / 180
  const scaledWidth = layout.width * layout.scale
  const scaledHeight = layout.height * layout.scale
  const boxWidth =
    Math.abs(scaledWidth * Math.cos(radians)) + Math.abs(scaledHeight * Math.sin(radians)) + 28
  const boxHeight =
    Math.abs(scaledWidth * Math.sin(radians)) + Math.abs(scaledHeight * Math.cos(radians)) + 36

  return {
    left: layout.x - boxWidth / 2,
    right: layout.x + boxWidth / 2,
    top: layout.y - boxHeight / 2,
    bottom: layout.y + boxHeight / 2,
  }
}

function areZonesInSameBand(leftAnchor: string, rightAnchor: string) {
  const leftZone = POLAROID_CONFIG.layoutZones.find((zone) => zone.id === leftAnchor)
  const rightZone = POLAROID_CONFIG.layoutZones.find((zone) => zone.id === rightAnchor)
  if (!leftZone || !rightZone) {
    return false
  }

  return leftZone.row === rightZone.row || leftZone.column === rightZone.column
}

function getWidthBiasForCount(visibleCount: number) {
  if (visibleCount <= 3) {
    return 1.04
  }
  if (visibleCount <= 6) {
    return 1
  }
  if (visibleCount <= 8) {
    return 0.965
  }
  return 0.94
}

function randomBetween(min: number, max: number, seed: number) {
  const value = Math.sin(seed * 12_989.341 + 78.233) * 43_758.5453
  const normalized = value - Math.floor(value)
  return min + (max - min) * normalized
}
