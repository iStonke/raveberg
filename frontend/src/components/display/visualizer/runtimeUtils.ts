export function normalize(value: number) {
  return clamp(value, 0, 100) / 100
}

export function circularDistance(value: number, target: number) {
  const rawDistance = Math.abs(value - target)
  return Math.min(rawDistance, 1 - rawDistance)
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount
}

export function smoothstep(value: number) {
  const clamped = clamp(value, 0, 1)
  return clamped * clamped * (3 - 2 * clamped)
}
