export interface PolaroidEntryMotion {
  offsetX: number
  offsetY: number
  scaleMultiplier: number
  rotationOffsetDeg: number
}

export function getPolaroidEntryMotion(simplified: boolean): PolaroidEntryMotion {
  if (simplified) {
    return {
      offsetX: -22,
      offsetY: -44,
      scaleMultiplier: 0.965,
      rotationOffsetDeg: -2.2,
    }
  }

  return {
    offsetX: -30,
    offsetY: -62,
    scaleMultiplier: 0.948,
    rotationOffsetDeg: -3.1,
  }
}
