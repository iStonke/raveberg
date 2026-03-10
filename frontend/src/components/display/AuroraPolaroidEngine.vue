<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { AURORA_THEMES, type AuroraColorMode } from './aurora/auroraThemes'

type QualityMode = 'auto' | 'low' | 'medium' | 'high'

type AuroraBandSeed = {
  amplitude: number
  wavelength: number
  thickness: number
  drift: number
  offset: number
  tilt: number
}

type FogSeed = {
  x: number
  y: number
  radius: number
  driftX: number
  driftY: number
  alpha: number
  speed: number
  depth: number
}

type ParticleSeed = {
  x: number
  y: number
  drift: number
  phase: number
  depth: number
  speed: number
  size: number
  orbit: number
  glow: number
  skew: number
  twinkle: number
  stretch: number
}

type Pulse = {
  x: number
  y: number
  startedAt: number
  strength: number
}

const props = withDefaults(
  defineProps<{
    intensity?: number
    particleDensity?: number
    colorMode?: AuroraColorMode
    quality?: QualityMode
    pulseToken?: number
    pulseOrigin?: { x: number; y: number } | null
  }>(),
  {
    intensity: 0.78,
    particleDensity: 0.72,
    colorMode: 'cool',
    quality: 'auto',
    pulseToken: 0,
    pulseOrigin: null,
  },
)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const theme = computed(() => AURORA_THEMES[props.colorMode])

let context: CanvasRenderingContext2D | null = null
let frameId = 0
let startTime = 0
let viewportWidth = 0
let viewportHeight = 0
let currentQuality: Exclude<QualityMode, 'auto'> = 'medium'
let pulseAnchorIndex = 0

let auroraBands: AuroraBandSeed[] = []
let fogBackSeeds: FogSeed[] = []
let fogMidSeeds: FogSeed[] = []
let particleSeeds: ParticleSeed[] = []
let dustSeeds: ParticleSeed[] = []
let pulses: Pulse[] = []

const pulseAnchors = [
  { x: 0.38, y: 0.4 },
  { x: 0.62, y: 0.44 },
  { x: 0.47, y: 0.58 },
  { x: 0.68, y: 0.6 },
]

onMounted(() => {
  context = canvasRef.value?.getContext('2d') ?? null
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  startTime = performance.now()
  frameId = window.requestAnimationFrame(render)
})

onBeforeUnmount(() => {
  window.cancelAnimationFrame(frameId)
  window.removeEventListener('resize', resizeCanvas)
})

watch(
  () => [props.quality, props.particleDensity],
  () => {
    rebuildScene()
  },
)

watch(
  () => props.pulseToken,
  (nextToken, previousToken) => {
    if (nextToken <= 0 || nextToken === previousToken) {
      return
    }
    emitPulse()
  },
)

function resizeCanvas() {
  const canvas = canvasRef.value
  if (!canvas || !context) {
    return
  }

  viewportWidth = window.innerWidth
  viewportHeight = window.innerHeight
  currentQuality = resolveQuality()
  const dprCap = currentQuality === 'high' ? 1.8 : currentQuality === 'medium' ? 1.45 : 1.15
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap)

  canvas.width = Math.floor(viewportWidth * dpr)
  canvas.height = Math.floor(viewportHeight * dpr)
  canvas.style.width = `${viewportWidth}px`
  canvas.style.height = `${viewportHeight}px`
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  rebuildScene()
}

function resolveQuality(): Exclude<QualityMode, 'auto'> {
  if (props.quality !== 'auto') {
    return props.quality
  }
  if (window.innerWidth < 720) {
    return 'low'
  }
  if (window.innerWidth < 1280) {
    return 'medium'
  }
  return 'high'
}

function rebuildScene() {
  const densityFactor = clamp(0.45 + props.particleDensity * 0.85, 0.45, 1.3)
  const counts =
    currentQuality === 'high'
      ? { aurora: 5, fogBack: 10, fogMid: 8, particles: 74, dust: 22 }
      : currentQuality === 'medium'
        ? { aurora: 4, fogBack: 8, fogMid: 6, particles: 54, dust: 14 }
        : { aurora: 3, fogBack: 6, fogMid: 4, particles: 34, dust: 10 }

  auroraBands = Array.from({ length: counts.aurora }, (_, index) => ({
    amplitude: 0.06 + pseudo(index, 1.3) * 0.08,
    wavelength: 0.75 + pseudo(index, 2.1) * 0.7,
    thickness: 0.1 + pseudo(index, 3.7) * 0.1,
    drift: 0.3 + pseudo(index, 5.2) * 0.8,
    offset: pseudo(index, 6.1),
    tilt: -0.2 + pseudo(index, 7.2) * 0.4,
  }))

  fogBackSeeds = buildFogSeeds(counts.fogBack, 14.5, 0.22, 0.42)
  fogMidSeeds = buildFogSeeds(counts.fogMid, 25.5, 0.12, 0.25)
  particleSeeds = buildParticleSeeds(Math.round(counts.particles * densityFactor), 37.2, 0.55, 1)
  dustSeeds = buildParticleSeeds(Math.round(counts.dust * densityFactor), 71.8, 0.2, 0.55)
}

function buildFogSeeds(count: number, salt: number, minRadius: number, maxRadius: number) {
  return Array.from({ length: count }, (_, index) => ({
    x: pseudo(index, salt),
    y: pseudo(index, salt + 2.1),
    radius: minRadius + pseudo(index, salt + 4.2) * (maxRadius - minRadius),
    driftX: 0.02 + pseudo(index, salt + 6.4) * 0.05,
    driftY: 0.01 + pseudo(index, salt + 8.5) * 0.04,
    alpha: 0.08 + pseudo(index, salt + 10.7) * 0.13,
    speed: 0.02 + pseudo(index, salt + 12.3) * 0.06,
    depth: 0.45 + pseudo(index, salt + 13.8) * 0.55,
  }))
}

function buildParticleSeeds(count: number, salt: number, minDepth: number, maxDepth: number) {
  return Array.from({ length: count }, (_, index) => ({
    x: pseudo(index, salt),
    y: pseudo(index, salt + 2.6),
    drift: 0.02 + pseudo(index, salt + 4.1) * 0.085,
    phase: pseudo(index, salt + 5.9) * Math.PI * 2,
    depth: minDepth + pseudo(index, salt + 7.6) * (maxDepth - minDepth),
    speed: 0.045 + pseudo(index, salt + 10.4) * 0.14,
    size: 0.5 + pseudo(index, salt + 12.8) * 4.9,
    orbit: 0.7 + pseudo(index, salt + 14.3) * 2.3,
    glow: 0.4 + pseudo(index, salt + 16.6) * 0.6,
    skew: -1 + pseudo(index, salt + 18.9) * 2,
    twinkle: 0.45 + pseudo(index, salt + 21.1) * 1.7,
    stretch: 0.7 + pseudo(index, salt + 23.7) * 1.9,
  }))
}

function emitPulse() {
  const now = performance.now()
  const anchor = props.pulseOrigin ?? pulseAnchors[pulseAnchorIndex % pulseAnchors.length]
  pulseAnchorIndex += 1
  pulses.push({
    x: anchor.x,
    y: anchor.y,
    startedAt: now,
    strength: 0.85 + pseudo(pulseAnchorIndex, 91.2) * 0.35,
  })
  pulses = pulses.slice(-4)
}

function render(timestamp: number) {
  const canvas = canvasRef.value
  if (!canvas || !context || viewportWidth <= 0 || viewportHeight <= 0) {
    return
  }

  const elapsed = (timestamp - startTime) / 1000
  pulses = pulses.filter((pulse) => timestamp - pulse.startedAt < 3200)

  drawBackdrop(context, elapsed)
  drawFogLayer(context, fogBackSeeds, elapsed, 0.7)
  drawAuroraLayer(context, elapsed)
  drawFogLayer(context, fogMidSeeds, elapsed, 1)
  drawPulseLayer(context, elapsed, timestamp)
  drawParticleLayer(context, particleSeeds, elapsed, timestamp, false)
  drawParticleLayer(context, dustSeeds, elapsed, timestamp, true)
  drawVignette(context, elapsed)

  frameId = window.requestAnimationFrame(render)
}

function drawBackdrop(ctx: CanvasRenderingContext2D, elapsed: number) {
  const breathing = 0.92 + Math.sin(elapsed * 0.12) * 0.04
  const gradient = ctx.createLinearGradient(0, 0, 0, viewportHeight)
  gradient.addColorStop(0, theme.value.backgroundTop)
  gradient.addColorStop(1, theme.value.backgroundBottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, viewportWidth, viewportHeight)

  const glow = ctx.createRadialGradient(
    viewportWidth * 0.5,
    viewportHeight * 0.12,
    0,
    viewportWidth * 0.5,
    viewportHeight * 0.12,
    viewportHeight * 0.85,
  )
  glow.addColorStop(0, rgba(theme.value.aurora[0], 0.12 * breathing))
  glow.addColorStop(0.35, rgba(theme.value.aurora[1], 0.08 * breathing))
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, viewportWidth, viewportHeight)
}

function drawFogLayer(
  ctx: CanvasRenderingContext2D,
  seeds: FogSeed[],
  elapsed: number,
  layerStrength: number,
) {
  const intensity = clamp(props.intensity, 0.15, 1.2)
  ctx.save()
  ctx.globalCompositeOperation = 'screen'

  for (let index = 0; index < seeds.length; index += 1) {
    const seed = seeds[index]
    const x =
      viewportWidth *
      wrap01(seed.x + Math.sin(elapsed * seed.speed + index) * seed.driftX + elapsed * seed.speed * 0.015)
    const y =
      viewportHeight *
      wrap01(seed.y + Math.cos(elapsed * seed.speed * 0.85 + seed.x * 6) * seed.driftY)
    const radius = Math.min(viewportWidth, viewportHeight) * seed.radius * (0.95 + Math.sin(elapsed * 0.08 + index) * 0.06)
    const fogColor = theme.value.fog[index % theme.value.fog.length]
    const alpha = seed.alpha * layerStrength * intensity * (0.75 + seed.depth * 0.35)
    const gradient = ctx.createRadialGradient(x, y, radius * 0.08, x, y, radius)

    gradient.addColorStop(0, rgba(fogColor, alpha))
    gradient.addColorStop(0.55, rgba(fogColor, alpha * 0.44))
    gradient.addColorStop(1, rgba(fogColor, 0))

    ctx.fillStyle = gradient
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }

  ctx.restore()
}

function drawAuroraLayer(ctx: CanvasRenderingContext2D, elapsed: number) {
  const intensity = clamp(props.intensity, 0.2, 1.15)
  const minSide = Math.min(viewportWidth, viewportHeight)

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  for (let index = 0; index < auroraBands.length; index += 1) {
    const band = auroraBands[index]
    const centerX =
      viewportWidth *
      (0.18 +
        band.offset * 0.68 +
        Math.sin(elapsed * band.drift * 0.12 + index * 1.7) * 0.06)
    const centerY =
      viewportHeight *
      (0.18 +
        index * 0.08 +
        Math.cos(elapsed * band.drift * 0.16 + band.offset * 5.4) * 0.04)
    const radiusX = minSide * (0.26 + band.wavelength * 0.16)
    const radiusY = minSide * (0.08 + band.thickness * 0.1)

    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      radiusY * 0.12,
      centerX,
      centerY,
      radiusX,
    )
    gradient.addColorStop(0, rgba(theme.value.aurora[index % theme.value.aurora.length], 0.16 * intensity))
    gradient.addColorStop(0.42, rgba(theme.value.aurora[(index + 1) % theme.value.aurora.length], 0.12 * intensity))
    gradient.addColorStop(1, rgba(theme.value.aurora[(index + 2) % theme.value.aurora.length], 0))

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(band.tilt * 0.8 + Math.sin(elapsed * band.drift * 0.09 + index) * 0.08)
    ctx.scale(1.45 + band.wavelength * 0.18, 0.42 + band.thickness * 0.4)
    ctx.fillStyle = gradient
    ctx.globalAlpha = 0.72 + Math.sin(elapsed * 0.08 + index) * 0.04
    ctx.filter = `blur(${Math.round(42 + intensity * 20)}px)`
    ctx.beginPath()
    ctx.arc(0, 0, radiusX, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  ctx.restore()
}

function drawPulseLayer(ctx: CanvasRenderingContext2D, elapsed: number, now: number) {
  if (!pulses.length) {
    return
  }

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  for (let index = 0; index < pulses.length; index += 1) {
    const pulse = pulses[index]
    const age = (now - pulse.startedAt) / 1000
    const progress = clamp(age / 2.9, 0, 1)
    const eased = easeOutCubic(1 - progress)
    const x = viewportWidth * pulse.x
    const y = viewportHeight * pulse.y
    const radius = Math.min(viewportWidth, viewportHeight) * (0.08 + progress * 0.34)
    const glowRadius = radius * (1.55 + pulse.strength * 0.18)
    const glow = ctx.createRadialGradient(x, y, radius * 0.08, x, y, glowRadius)

    glow.addColorStop(0, rgba(theme.value.accent, 0.2 * eased))
    glow.addColorStop(0.3, rgba(theme.value.aurora[index % theme.value.aurora.length], 0.18 * eased))
    glow.addColorStop(1, rgba(theme.value.aurora[(index + 1) % theme.value.aurora.length], 0))
    ctx.fillStyle = glow
    ctx.fillRect(x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2)

    ctx.beginPath()
    ctx.strokeStyle = rgba(theme.value.accent, 0.12 * eased)
    ctx.lineWidth = 2 + eased * 10
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.stroke()

    ctx.beginPath()
    ctx.strokeStyle = rgba(theme.value.aurora[index % theme.value.aurora.length], 0.08 * eased)
    ctx.lineWidth = 1.2 + eased * 4
    ctx.arc(x, y, radius * 0.64, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.restore()
}

function drawParticleLayer(
  ctx: CanvasRenderingContext2D,
  seeds: ParticleSeed[],
  elapsed: number,
  now: number,
  isForeground: boolean,
) {
  const focusX = viewportWidth * 0.56
  const focusY = viewportHeight * 0.52
  const density = clamp(props.particleDensity, 0.25, 1.2)

  ctx.save()
  ctx.globalCompositeOperation = 'screen'

  for (let index = 0; index < seeds.length; index += 1) {
    const seed = seeds[index]
    const flowDrift = 1 + seed.depth * 0.9 + (isForeground ? 0.45 : 0)
    const baseX =
      wrap01(
        seed.x +
          elapsed * seed.speed * 0.03 * flowDrift +
          Math.sin(elapsed * seed.orbit * 0.42 + seed.phase) * seed.drift +
          Math.cos(elapsed * (0.12 + seed.speed * 0.45) + seed.phase * 1.2) * seed.drift * 0.28 * seed.skew,
      ) * viewportWidth
    const baseY =
      wrap01(
        seed.y +
          Math.cos(elapsed * (0.24 + seed.speed * 1.15) + seed.phase * 0.8) * seed.drift * 0.95 +
          Math.sin(elapsed * seed.orbit * 0.18 + seed.phase) * 0.012 +
          Math.sin(elapsed * (0.38 + seed.twinkle * 0.18) + seed.phase * 0.7) * 0.006 * seed.stretch,
      ) * viewportHeight

    let x =
      baseX +
      Math.sin(elapsed * seed.orbit + seed.phase) * viewportWidth * 0.013 * seed.depth * seed.stretch +
      Math.cos(elapsed * (seed.orbit * 0.56 + seed.twinkle * 0.22) + seed.phase) * viewportWidth * 0.004
    let y =
      baseY +
      Math.cos(elapsed * seed.orbit * 0.72 + seed.phase) * viewportHeight * 0.015 * seed.depth +
      Math.sin(elapsed * (seed.orbit * 0.45 + seed.twinkle * 0.16) + seed.phase * 0.6) * viewportHeight * 0.004

    // A very small compositional pull keeps the particle field feeling intentional.
    x += (focusX - x) * 0.004 * seed.depth
    y += (focusY - y) * 0.003 * seed.depth

    let pulseGlow = 0
    for (let pulseIndex = 0; pulseIndex < pulses.length; pulseIndex += 1) {
      const pulse = pulses[pulseIndex]
      const pulseAge = clamp((now - pulse.startedAt) / 1000, 0, 3.2)
      const pulseLife = 1 - pulseAge / 3.2
      const px = viewportWidth * pulse.x
      const py = viewportHeight * pulse.y
      const dx = px - x
      const dy = py - y
      const distance = Math.hypot(dx, dy)
      const spread = Math.min(viewportWidth, viewportHeight) * (0.16 + pulseAge * 0.12)
      const influence = Math.exp(-(distance * distance) / (2 * spread * spread)) * pulseLife * pulse.strength

      x += dx * influence * 0.035 * (isForeground ? 0.7 : 1)
      y += dy * influence * 0.03 * (isForeground ? 0.6 : 1)
      pulseGlow += influence
    }

    const twinkle = 0.84 + (Math.sin(elapsed * (0.9 + seed.twinkle) + seed.phase) * 0.5 + 0.5) * 0.48
    const size =
      seed.size *
      (isForeground ? 1.45 : 1) *
      density *
      twinkle *
      (0.72 + seed.depth * 0.72 + pulseGlow * 0.95)
    const alphaBase = isForeground ? 0.08 : 0.11
    const alpha =
      alphaBase +
      seed.glow * 0.18 * density * twinkle * (isForeground ? 0.55 : 1) +
      pulseGlow * (isForeground ? 0.08 : 0.12)

    const color = theme.value.particles[index % theme.value.particles.length]
    ctx.beginPath()
    ctx.fillStyle = rgba(color, clamp(alpha, 0.04, isForeground ? 0.24 : 0.42))
    ctx.shadowBlur = isForeground ? 16 + twinkle * 7 + pulseGlow * 18 : 10 + twinkle * 5 + pulseGlow * 16
    ctx.shadowColor = rgba(color, clamp(0.08 + twinkle * 0.05 + pulseGlow * 0.12, 0.06, 0.3))
    ctx.arc(x, y, size, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function drawVignette(ctx: CanvasRenderingContext2D, elapsed: number) {
  const vignette = ctx.createRadialGradient(
    viewportWidth * 0.5,
    viewportHeight * 0.45,
    viewportWidth * 0.08,
    viewportWidth * 0.5,
    viewportHeight * 0.5,
    Math.max(viewportWidth, viewportHeight) * 0.74,
  )
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vignette.addColorStop(1, 'rgba(1, 5, 12, 0.42)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, viewportWidth, viewportHeight)

  const haze = ctx.createLinearGradient(0, 0, 0, viewportHeight)
  haze.addColorStop(0, 'rgba(3, 9, 18, 0.1)')
  haze.addColorStop(0.4, 'rgba(3, 10, 18, 0.02)')
  haze.addColorStop(1, rgba(theme.value.backgroundBottom === '#111828' ? '8, 12, 20' : '4, 8, 16', 0.3 + Math.sin(elapsed * 0.08) * 0.02))
  ctx.fillStyle = haze
  ctx.fillRect(0, 0, viewportWidth, viewportHeight)
}

function rgba(rgb: string, alpha: number) {
  return `rgba(${rgb}, ${clamp(alpha, 0, 1)})`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function wrap01(value: number) {
  return ((value % 1) + 1) % 1
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3)
}

function pseudo(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123
  return value - Math.floor(value)
}
</script>

<template>
  <canvas ref="canvasRef" class="aurora-engine" aria-hidden="true" />
</template>

<style scoped>
.aurora-engine {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
