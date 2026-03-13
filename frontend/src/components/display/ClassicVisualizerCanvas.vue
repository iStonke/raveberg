<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch, ref } from 'vue'

import type { VisualizerState } from '../../services/api'

const props = defineProps<{
  visualizer: VisualizerState
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

let frameId = 0
let startTime = 0
let lastFrameTime = 0
let smoothedSpeed = props.visualizer.speed
let smoothedIntensity = props.visualizer.intensity
let smoothedBrightness = props.visualizer.brightness

type ParticleState = {
  x: number
  y: number
  vx: number
  vy: number
  depth: number
  baseSize: number
  alpha: number
  colorIndex: number
  colorShift: number
  driftStrength: number
  noiseSpeed: number
  noisePhaseX: number
  noisePhaseY: number
  turnSpeed: number
  turnPhase: number
  sizePulseSpeed: number
  sizePulsePhase: number
  sizePulseAmount: number
  glow: number
  hero: boolean
}

const particleStates: ParticleState[] = []
let particleFieldWidth = 0
let particleFieldHeight = 0

const beamSeeds = Array.from({ length: 8 }, (_, index) => ({
  offset: index / 8,
  drift: 0.18 + ((index * 19) % 10) / 22,
  width: 0.16 + ((index * 11) % 7) / 25,
}))

const sparkSeeds = Array.from({ length: 96 }, (_, index) => ({
  angle: (index / 96) * Math.PI * 2,
  seed: ((index * 53) % 89) / 89,
  drift: ((index * 31) % 47) / 47,
}))

onMounted(() => {
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  startTime = performance.now()
  lastFrameTime = startTime
  frameId = window.requestAnimationFrame(render)
})

onBeforeUnmount(() => {
  window.cancelAnimationFrame(frameId)
  window.removeEventListener('resize', resizeCanvas)
})

watch(
  () => props.visualizer.active_preset,
  () => {
    startTime = performance.now()
    lastFrameTime = startTime
    if (props.visualizer.active_preset === 'particles') {
      initializeParticleField(window.innerWidth, window.innerHeight)
    }
  },
)

function resizeCanvas() {
  const canvas = canvasRef.value
  if (!canvas) {
    return
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const width = window.innerWidth
  const height = window.innerHeight

  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const context = canvas.getContext('2d')
  if (context) {
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  if (props.visualizer.active_preset === 'particles' || particleStates.length === 0) {
    initializeParticleField(width, height)
  }
}

function render(timestamp: number) {
  const canvas = canvasRef.value
  const context = canvas?.getContext('2d')
  if (!canvas || !context) {
    return
  }

  const width = window.innerWidth
  const height = window.innerHeight
  const elapsed = (timestamp - startTime) / 1000
  const deltaSeconds = Math.min(0.05, Math.max(1 / 240, (timestamp - lastFrameTime) / 1000))
  lastFrameTime = timestamp
  smoothedSpeed += (props.visualizer.speed - smoothedSpeed) * 0.045
  smoothedIntensity += (props.visualizer.intensity - smoothedIntensity) * 0.05
  smoothedBrightness += (props.visualizer.brightness - smoothedBrightness) * 0.05
  const speedFactor = 0.35 + smoothedSpeed / 90
  const intensityFactor = 0.25 + smoothedIntensity / 100
  const brightnessFactor = 0.35 + smoothedBrightness / 100
  const palette = getPalette(props.visualizer.color_scheme, brightnessFactor)

  context.clearRect(0, 0, width, height)
  context.fillStyle = `rgba(4, 5, 8, ${Math.max(0.12, 0.26 - brightnessFactor * 0.08)})`
  context.fillRect(0, 0, width, height)

  if (props.visualizer.active_preset === 'particles') {
    drawParticles(
      context,
      width,
      height,
      elapsed,
      deltaSeconds,
      speedFactor,
      intensityFactor,
      brightnessFactor,
      palette,
    )
  } else if (props.visualizer.active_preset === 'warehouse') {
    drawWarehouse(context, width, height, elapsed, speedFactor, intensityFactor, palette)
  } else {
    drawKaleidoscope(context, width, height, elapsed, speedFactor, intensityFactor, palette)
  }

  frameId = window.requestAnimationFrame(render)
}

function drawParticles(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsed: number,
  deltaSeconds: number,
  speedFactor: number,
  intensityFactor: number,
  brightnessFactor: number,
  palette: string[],
) {
  if (particleFieldWidth !== width || particleFieldHeight !== height || particleStates.length === 0) {
    initializeParticleField(width, height)
  }

  const particlePalette = getParticlePalette(props.visualizer.color_scheme, brightnessFactor)
  drawParticleHaze(context, width, height, elapsed, particlePalette, intensityFactor, brightnessFactor)
  context.save()
  context.globalCompositeOperation = 'lighter'

  for (let index = 0; index < particleStates.length; index += 1) {
    const particle = particleStates[index]
    updateParticle(particle, width, height, elapsed, deltaSeconds, speedFactor, intensityFactor)
    const pulse = 1 + Math.sin(elapsed * particle.sizePulseSpeed + particle.sizePulsePhase) * particle.sizePulseAmount
    const size = particle.baseSize * pulse * (1.24 + intensityFactor * 0.46)
    const alpha = particle.alpha * (0.72 + brightnessFactor * 0.4) * (particle.hero ? 1.12 : 1)
    const baseColor = particlePalette[(particle.colorIndex + Math.floor(elapsed * particle.colorShift)) % particlePalette.length]
    const coreColor = withAlpha(baseColor, alpha * 0.92)
    context.beginPath()
    context.fillStyle = coreColor
    context.globalAlpha = 1
    context.arc(particle.x, particle.y, size, 0, Math.PI * 2)
    context.fill()
  }

  context.restore()
  context.globalAlpha = 1
  context.globalCompositeOperation = 'source-over'
}

function drawKaleidoscope(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsed: number,
  speedFactor: number,
  intensityFactor: number,
  palette: string[],
) {
  const cx = width / 2
  const cy = height / 2
  const minSide = Math.min(width, height)
  const globalPulse = 1 + Math.sin(elapsed * 0.28) * 0.035 + Math.cos(elapsed * 0.11) * 0.02
  const phaseShift = 0.5 + 0.5 * Math.sin(elapsed * 0.17)
  const backgroundGlow = context.createRadialGradient(cx, cy, minSide * 0.06, cx, cy, minSide * 0.86)
  backgroundGlow.addColorStop(0, withAlpha(palette[1], 0.09 + intensityFactor * 0.04))
  backgroundGlow.addColorStop(0.42, withAlpha(palette[0], 0.04 + phaseShift * 0.03))
  backgroundGlow.addColorStop(1, 'rgba(2, 4, 7, 0)')
  context.fillStyle = backgroundGlow
  context.fillRect(0, 0, width, height)

  drawKaleidoscopeBackdrop(context, width, height, elapsed, palette, intensityFactor)

  context.save()
  context.translate(cx, cy)
  context.scale(globalPulse, globalPulse)
  context.globalCompositeOperation = 'lighter'

  drawKaleidoscopeRing(context, {
    elapsed,
    speedFactor,
    intensityFactor,
    palette,
    ringRadius: minSide * 0.14,
    segmentCount: 8 + Math.round(phaseShift * 4),
    rotationSpeed: speedFactor * 0.78,
    direction: 1,
    alphaBase: 0.24,
    alphaRange: 0.12,
    lengthBase: minSide * 0.12,
    lengthRange: minSide * 0.03,
    widthBase: minSide * 0.028,
    widthRange: minSide * 0.015,
    tipDepth: 0.22,
    oscillation: 0.44,
    colorOffset: 0,
  })

  drawKaleidoscopeRing(context, {
    elapsed,
    speedFactor,
    intensityFactor,
    palette,
    ringRadius: minSide * 0.24,
    segmentCount: 12 + Math.round(phaseShift * 4),
    rotationSpeed: speedFactor * 0.34,
    direction: -1,
    alphaBase: 0.15,
    alphaRange: 0.1,
    lengthBase: minSide * 0.16,
    lengthRange: minSide * 0.05,
    widthBase: minSide * 0.024,
    widthRange: minSide * 0.012,
    tipDepth: 0.28,
    oscillation: 0.3,
    colorOffset: 1,
  })

  drawKaleidoscopeRing(context, {
    elapsed,
    speedFactor,
    intensityFactor,
    palette,
    ringRadius: minSide * 0.34,
    segmentCount: 16 + Math.round(phaseShift * 2),
    rotationSpeed: speedFactor * 0.12,
    direction: 1,
    alphaBase: 0.08,
    alphaRange: 0.06,
    lengthBase: minSide * 0.19,
    lengthRange: minSide * 0.04,
    widthBase: minSide * 0.018,
    widthRange: minSide * 0.008,
    tipDepth: 0.34,
    oscillation: 0.18,
    colorOffset: 2,
  })

  drawKaleidoscopeCore(context, elapsed, minSide, palette, intensityFactor)

  context.restore()
  context.globalAlpha = 1
  context.globalCompositeOperation = 'source-over'
}

type KaleidoscopeRingOptions = {
  elapsed: number
  speedFactor: number
  intensityFactor: number
  palette: string[]
  ringRadius: number
  segmentCount: number
  rotationSpeed: number
  direction: 1 | -1
  alphaBase: number
  alphaRange: number
  lengthBase: number
  lengthRange: number
  widthBase: number
  widthRange: number
  tipDepth: number
  oscillation: number
  colorOffset: number
}

function drawKaleidoscopeRing(context: CanvasRenderingContext2D, options: KaleidoscopeRingOptions) {
  const {
    elapsed,
    speedFactor,
    intensityFactor,
    palette,
    ringRadius,
    segmentCount,
    rotationSpeed,
    direction,
    alphaBase,
    alphaRange,
    lengthBase,
    lengthRange,
    widthBase,
    widthRange,
    tipDepth,
    oscillation,
    colorOffset,
  } = options
  const phaseShift = Math.sin(elapsed * 0.19 + ringRadius * 0.02) * 0.08

  for (let index = 0; index < segmentCount; index += 1) {
    const normalized = index / segmentCount
    const oscillationPhase = elapsed * (0.34 + oscillation) + index * 0.73
    const localScale = 0.92 + Math.sin(oscillationPhase) * 0.08 + intensityFactor * 0.04
    const segmentLength = (lengthBase + Math.sin(oscillationPhase * 1.3) * lengthRange) * localScale
    const segmentWidth = widthBase + Math.cos(oscillationPhase * 0.9) * widthRange
    const skew = Math.sin(oscillationPhase * 0.6) * (0.08 + oscillation * 0.08)
    const tipInset = segmentLength * (tipDepth + Math.sin(oscillationPhase * 1.1) * 0.06)
    const rotation =
      normalized * Math.PI * 2 +
      elapsed * rotationSpeed * direction +
      phaseShift +
      Math.sin(oscillationPhase * 0.45) * 0.06

    context.save()
    context.rotate(rotation)
    context.beginPath()
    context.moveTo(-segmentWidth, ringRadius - segmentWidth * 0.45)
    context.bezierCurveTo(
      -segmentWidth * (1.2 + skew),
      ringRadius + segmentLength * 0.18,
      -segmentWidth * 0.35,
      ringRadius + segmentLength - tipInset,
      0,
      ringRadius + segmentLength,
    )
    context.bezierCurveTo(
      segmentWidth * 0.35,
      ringRadius + segmentLength - tipInset,
      segmentWidth * (1.2 - skew),
      ringRadius + segmentLength * 0.18,
      segmentWidth,
      ringRadius - segmentWidth * 0.45,
    )
    context.quadraticCurveTo(segmentWidth * 0.15, ringRadius - segmentWidth * 1.6, 0, ringRadius - segmentWidth * 1.05)
    context.quadraticCurveTo(-segmentWidth * 0.15, ringRadius - segmentWidth * 1.6, -segmentWidth, ringRadius - segmentWidth * 0.45)
    context.closePath()
    context.fillStyle = palette[(index + colorOffset) % palette.length]
    context.globalAlpha = alphaBase + (0.5 + 0.5 * Math.sin(oscillationPhase * 0.8)) * alphaRange
    context.fill()
    context.restore()
  }
}

function drawKaleidoscopeCore(
  context: CanvasRenderingContext2D,
  elapsed: number,
  minSide: number,
  palette: string[],
  intensityFactor: number,
) {
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 1.8)
  const outerCore = minSide * (0.09 + intensityFactor * 0.02 + pulse * 0.01)
  const innerCore = minSide * (0.028 + intensityFactor * 0.01)
  const coreGlow = context.createRadialGradient(0, 0, 0, 0, 0, outerCore)
  coreGlow.addColorStop(0, withAlpha(palette[3 % palette.length], 0.32 + pulse * 0.14))
  coreGlow.addColorStop(0.45, withAlpha(palette[1 % palette.length], 0.14 + pulse * 0.08))
  coreGlow.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = coreGlow
  context.beginPath()
  context.arc(0, 0, outerCore, 0, Math.PI * 2)
  context.fill()

  context.beginPath()
  context.fillStyle = withAlpha(palette[0], 0.78)
  context.arc(0, 0, innerCore, 0, Math.PI * 2)
  context.fill()

  context.beginPath()
  context.fillStyle = withAlpha(palette[2 % palette.length], 0.48 + pulse * 0.16)
  context.arc(0, 0, innerCore * 0.46, 0, Math.PI * 2)
  context.fill()
}

function drawKaleidoscopeBackdrop(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsed: number,
  palette: string[],
  intensityFactor: number,
) {
  const veilA = context.createRadialGradient(
    width * (0.42 + Math.sin(elapsed * 0.05) * 0.06),
    height * (0.48 + Math.cos(elapsed * 0.04) * 0.05),
    0,
    width * 0.48,
    height * 0.5,
    Math.max(width, height) * 0.54,
  )
  veilA.addColorStop(0, withAlpha(palette[0], 0.035 + intensityFactor * 0.015))
  veilA.addColorStop(0.55, withAlpha(palette[1], 0.02))
  veilA.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = veilA
  context.fillRect(0, 0, width, height)

  const veilB = context.createLinearGradient(0, 0, width, height)
  veilB.addColorStop(0, withAlpha(palette[2 % palette.length], 0.018))
  veilB.addColorStop(0.5, 'rgba(0,0,0,0)')
  veilB.addColorStop(1, withAlpha(palette[3 % palette.length], 0.022))
  context.fillStyle = veilB
  context.fillRect(0, 0, width, height)
}

function drawWarehouse(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsed: number,
  speedFactor: number,
  intensityFactor: number,
  palette: string[],
) {
  const cx = width / 2
  const cy = height * (0.3 + Math.sin(elapsed * speedFactor * 0.35) * 0.025)
  const floorTop = cy + height * (0.08 + intensityFactor * 0.04)
  const floorHeight = height - floorTop
  const baseRadius = Math.min(width, height) * (0.18 + intensityFactor * 0.16)
  const kick = Math.pow(0.5 + 0.5 * Math.sin(elapsed * speedFactor * 8.5), 3)
  const sweep = Math.sin(elapsed * speedFactor * 1.7)

  const glow = context.createRadialGradient(cx, cy, baseRadius * 0.15, cx, cy, Math.max(width, height) * 0.75)
  glow.addColorStop(0, withAlpha(palette[0], 0.2 + kick * 0.3))
  glow.addColorStop(0.4, withAlpha(palette[1], 0.1 + intensityFactor * 0.14))
  glow.addColorStop(1, 'rgba(1, 3, 8, 0)')
  context.fillStyle = glow
  context.fillRect(0, 0, width, height)

  context.save()
  context.beginPath()
  context.moveTo(cx - width * 0.5, floorTop)
  context.lineTo(cx + width * 0.5, floorTop)
  context.lineTo(width, height)
  context.lineTo(0, height)
  context.closePath()
  context.clip()

  const laneCount = 12 + Math.floor(intensityFactor * 14)
  for (let lane = -laneCount; lane <= laneCount; lane += 1) {
    const normalized = lane / laneCount
    const topSpread = width * (0.035 + intensityFactor * 0.065)
    const bottomSpread = width * 0.92
    const wobble = Math.sin(elapsed * speedFactor * 1.1 + normalized * 4) * width * 0.012
    context.beginPath()
    context.strokeStyle = palette[Math.abs(lane) % palette.length]
    context.globalAlpha = 0.12 + Math.abs(normalized) * 0.16 + kick * 0.12
    context.lineWidth = 1 + intensityFactor * 1.8
    context.moveTo(cx + normalized * topSpread + wobble, floorTop)
    context.lineTo(cx + normalized * bottomSpread, height)
    context.stroke()
  }

  const rowCount = 14 + Math.floor(intensityFactor * 16)
  for (let row = 0; row < rowCount; row += 1) {
    const progress = ((elapsed * speedFactor * 0.95) + row / rowCount) % 1
    const eased = Math.pow(progress, 2.3)
    const y = floorTop + eased * floorHeight
    const halfWidth = width * (0.08 + eased * 0.94)
    context.beginPath()
    context.strokeStyle = palette[row % palette.length]
    context.globalAlpha = 0.08 + progress * 0.28
    context.lineWidth = 1.2 + eased * (1.5 + intensityFactor * 3)
    context.moveTo(cx - halfWidth, y)
    context.lineTo(cx + halfWidth, y)
    context.stroke()
  }
  context.restore()

  context.save()
  context.globalCompositeOperation = 'lighter'
  context.shadowBlur = 28 + intensityFactor * 36
  for (let index = 0; index < beamSeeds.length; index += 1) {
    const beam = beamSeeds[index]
    const beamSwing = Math.sin(elapsed * speedFactor * (0.7 + beam.drift) + beam.offset * Math.PI * 2)
    const x = cx + beamSwing * width * (0.14 + beam.offset * 0.28)
    const beamWidth = (6 + beam.width * 16 + intensityFactor * 18) * (1 + kick * 0.7)
    const gradient = context.createLinearGradient(x, 0, x, height)
    gradient.addColorStop(0, withAlpha(palette[index % palette.length], 0))
    gradient.addColorStop(0.2, withAlpha(palette[index % palette.length], 0.2 + kick * 0.18))
    gradient.addColorStop(0.6, withAlpha(palette[(index + 1) % palette.length], 0.08 + intensityFactor * 0.14))
    gradient.addColorStop(1, withAlpha(palette[index % palette.length], 0))
    context.fillStyle = gradient
    context.fillRect(x - beamWidth / 2, 0, beamWidth, height)
  }
  context.restore()

  context.save()
  context.translate(cx, cy)
  context.rotate(elapsed * speedFactor * 0.45)
  context.globalCompositeOperation = 'lighter'
  for (let ring = 0; ring < 4; ring += 1) {
    const pulse = ((elapsed * speedFactor * 1.4) + ring / 4) % 1
    const radius = baseRadius * (0.4 + pulse * 1.9)
    context.beginPath()
    context.strokeStyle = palette[ring % palette.length]
    context.globalAlpha = (1 - pulse) * (0.22 + kick * 0.35)
    context.lineWidth = 2 + (1 - pulse) * (8 + intensityFactor * 10)
    context.arc(0, 0, radius, 0, Math.PI * 2)
    context.stroke()
  }

  const bladeCount = 6 + Math.floor(intensityFactor * 10)
  for (let blade = 0; blade < bladeCount; blade += 1) {
    const angle = (Math.PI * 2 * blade) / bladeCount + elapsed * speedFactor * 0.9
    const inner = baseRadius * (0.18 + kick * 0.12)
    const outer = baseRadius * (0.72 + ((blade % 3) / 10) + intensityFactor * 0.28)
    context.save()
    context.rotate(angle)
    context.beginPath()
    context.moveTo(inner, 0)
    context.lineTo(outer, -baseRadius * 0.08)
    context.lineTo(outer + baseRadius * 0.2, 0)
    context.lineTo(outer, baseRadius * 0.08)
    context.closePath()
    context.fillStyle = palette[blade % palette.length]
    context.globalAlpha = 0.08 + kick * 0.2 + ((blade % 4) / 18)
    context.fill()
    context.restore()
  }

  context.rotate(-elapsed * speedFactor * 0.9 + sweep * 0.15)
  context.beginPath()
  context.moveTo(0, -baseRadius * (0.34 + kick * 0.18))
  context.lineTo(baseRadius * (0.28 + kick * 0.12), 0)
  context.lineTo(0, baseRadius * (0.34 + kick * 0.18))
  context.lineTo(-baseRadius * (0.28 + kick * 0.12), 0)
  context.closePath()
  context.fillStyle = withAlpha(palette[0], 0.45 + kick * 0.35)
  context.fill()
  context.restore()

  context.save()
  context.globalCompositeOperation = 'lighter'
  for (let index = 0; index < sparkSeeds.length; index += 1) {
    const spark = sparkSeeds[index]
    const cycle = ((elapsed * speedFactor * (0.55 + spark.seed * 1.4)) + spark.seed * 7) % 1
    const distance = baseRadius * (0.45 + cycle * cycle * (2.2 + spark.drift))
    const angle = spark.angle + elapsed * speedFactor * (0.18 + spark.drift * 0.4)
    const x = cx + Math.cos(angle) * distance
    const y = cy + Math.sin(angle) * distance * 0.58 + cycle * height * 0.18
    const trailX = x - Math.cos(angle) * (8 + cycle * 28)
    const trailY = y - Math.sin(angle) * (8 + cycle * 28) * 0.58
    context.beginPath()
    context.strokeStyle = palette[index % palette.length]
    context.globalAlpha = 0.08 + (1 - cycle) * 0.42
    context.lineWidth = 0.8 + spark.seed * 2.8 + intensityFactor * 1.5
    context.moveTo(trailX, trailY)
    context.lineTo(x, y)
    context.stroke()
  }
  context.restore()

  context.globalAlpha = 1
  context.globalCompositeOperation = 'source-over'
  context.shadowBlur = 0
}

function getPalette(colorScheme: VisualizerState['color_scheme'], brightnessFactor: number) {
  const palettes: Record<VisualizerState['color_scheme'], string[]> = {
    mono: ['rgba(255,255,255,0.95)', 'rgba(210,210,210,0.82)', 'rgba(145,145,145,0.72)'],
    acid: ['rgba(192,255,76,0.95)', 'rgba(35,255,220,0.88)', 'rgba(255,230,64,0.86)'],
    ultraviolet: ['rgba(165,112,255,0.96)', 'rgba(76,234,255,0.85)', 'rgba(255,84,214,0.82)'],
    redline: ['rgba(255,78,78,0.95)', 'rgba(255,160,70,0.86)', 'rgba(255,238,170,0.8)'],
  }

  return palettes[colorScheme].map((color) => withAlpha(color, Math.min(1, brightnessFactor)))
}

function getParticlePalette(colorScheme: VisualizerState['color_scheme'], brightnessFactor: number) {
  const palettes: Record<VisualizerState['color_scheme'], string[]> = {
    mono: [
      'rgba(236,244,255,0.96)',
      'rgba(202,224,255,0.9)',
      'rgba(170,197,255,0.84)',
      'rgba(206,255,250,0.78)',
      'rgba(255,250,224,0.7)',
    ],
    acid: [
      'rgba(80,246,255,0.96)',
      'rgba(58,255,213,0.92)',
      'rgba(172,255,98,0.88)',
      'rgba(224,255,100,0.82)',
      'rgba(255,214,94,0.74)',
      'rgba(255,156,74,0.66)',
    ],
    ultraviolet: [
      'rgba(96,244,255,0.94)',
      'rgba(92,208,255,0.92)',
      'rgba(148,255,167,0.84)',
      'rgba(217,236,98,0.76)',
      'rgba(255,184,96,0.7)',
      'rgba(255,134,116,0.62)',
    ],
    redline: [
      'rgba(255,216,122,0.94)',
      'rgba(255,177,82,0.9)',
      'rgba(255,133,88,0.82)',
      'rgba(238,255,118,0.76)',
      'rgba(126,255,220,0.74)',
      'rgba(88,221,255,0.72)',
    ],
  }

  return palettes[colorScheme].map((color) => withAlpha(color, Math.min(1, 0.78 + brightnessFactor * 0.22)))
}

function withAlpha(color: string, alpha: number) {
  const normalized = Math.max(0, Math.min(1, alpha))
  return color.replace(/[\d.]+\)\s*$/, `${normalized})`)
}

function initializeParticleField(width: number, height: number) {
  particleFieldWidth = width
  particleFieldHeight = height
  const targetCount = Math.max(170, Math.min(290, Math.round((width * height) / 7000)))
  particleStates.length = 0

  for (let index = 0; index < targetCount; index += 1) {
    particleStates.push(createParticle(width, height, index, false))
  }
}

function createParticle(width: number, height: number, index: number, allowOutside: boolean): ParticleState {
  const sizeTier = seeded(index, 0.13)
  const depthSeed = seeded(index, 0.27)
  const colorSeed = seeded(index, 0.41)
  const angle = seeded(index, 0.56) * Math.PI * 2
  const spawnOutside = allowOutside && seeded(index, 0.61) > 0.45
  const depth = clamp(0.12 + depthSeed * 0.88, 0.08, 1)
  const hero = sizeTier > 0.976
  let baseSize = 1.8 + seeded(index, 0.82) * 2.1

  if (sizeTier > 0.58) {
    baseSize = 3 + seeded(index, 0.77) * 3.8
  }
  if (sizeTier > 0.84) {
    baseSize = 5.8 + seeded(index, 0.73) * 5.8
  }
  if (hero) {
    baseSize = 10.5 + seeded(index, 0.69) * 8.5
  }

  const speed = (8 + depth * 32) * (0.7 + seeded(index, 0.92) * 0.65)
  const position = spawnParticlePosition(width, height, index, spawnOutside)

  return {
    x: position.x,
    y: position.y,
    vx: Math.cos(angle) * speed * 0.7,
    vy: Math.sin(angle) * speed * 0.7,
    depth,
    baseSize,
    alpha: 0.12 + depth * 0.48 + (hero ? 0.08 : 0),
    colorIndex: Math.floor(colorSeed * 6),
    colorShift: 0.04 + seeded(index, 0.22) * 0.12,
    driftStrength: 8 + depth * 28 + seeded(index, 0.31) * 12,
    noiseSpeed: 0.18 + seeded(index, 0.48) * 0.55,
    noisePhaseX: seeded(index, 0.59) * Math.PI * 2,
    noisePhaseY: seeded(index, 0.67) * Math.PI * 2,
    turnSpeed: 0.12 + seeded(index, 0.74) * 0.26,
    turnPhase: seeded(index, 0.83) * Math.PI * 2,
    sizePulseSpeed: 0.24 + seeded(index, 0.94) * 0.44,
    sizePulsePhase: seeded(index, 1.03) * Math.PI * 2,
    sizePulseAmount: 0.04 + seeded(index, 1.15) * (hero ? 0.08 : 0.05),
    glow: 0.2 + depth * 0.55,
    hero,
  }
}

function spawnParticlePosition(width: number, height: number, index: number, outside: boolean) {
  if (!outside) {
    return {
      x: seeded(index, 1.27) * width,
      y: seeded(index, 1.39) * height,
    }
  }

  const margin = 36 + seeded(index, 1.51) * 96
  const edge = Math.floor(seeded(index, 1.63) * 4)

  if (edge === 0) {
    return { x: -margin, y: seeded(index, 1.77) * height }
  }
  if (edge === 1) {
    return { x: width + margin, y: seeded(index, 1.77) * height }
  }
  if (edge === 2) {
    return { x: seeded(index, 1.89) * width, y: -margin }
  }
  return { x: seeded(index, 1.89) * width, y: height + margin }
}

function updateParticle(
  particle: ParticleState,
  width: number,
  height: number,
  elapsed: number,
  deltaSeconds: number,
  speedFactor: number,
  intensityFactor: number,
) {
  const flowX =
    Math.sin(particle.noisePhaseX + elapsed * particle.noiseSpeed + particle.y * 0.0024) +
    Math.cos(particle.noisePhaseY + elapsed * particle.noiseSpeed * 0.53 + particle.x * 0.0012)
  const flowY =
    Math.cos(particle.noisePhaseY + elapsed * particle.noiseSpeed * 0.91 + particle.x * 0.0021) -
    Math.sin(particle.noisePhaseX + elapsed * particle.noiseSpeed * 0.47 + particle.y * 0.0016)
  const turn = Math.sin(elapsed * particle.turnSpeed + particle.turnPhase) * (0.22 + intensityFactor * 0.2)
  const driftScale = (0.45 + speedFactor * 0.5) * deltaSeconds

  particle.vx += (flowX * particle.driftStrength - particle.vy * turn * 0.35) * driftScale
  particle.vy += (flowY * particle.driftStrength + particle.vx * turn * 0.35) * driftScale

  const damping = Math.exp(-deltaSeconds * (0.16 + (1 - particle.depth) * 0.18))
  particle.vx *= damping
  particle.vy *= damping

  const parallax = 0.55 + particle.depth * 0.95
  particle.x += particle.vx * deltaSeconds * parallax
  particle.y += particle.vy * deltaSeconds * parallax

  const margin = 80 + particle.baseSize * 8
  if (
    particle.x < -margin ||
    particle.x > width + margin ||
    particle.y < -margin ||
    particle.y > height + margin
  ) {
    const next = createParticle(width, height, Math.round((elapsed + particle.noisePhaseX) * 10000), true)
    Object.assign(particle, next)
  }
}

function drawParticleHaze(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsed: number,
  palette: string[],
  intensityFactor: number,
  brightnessFactor: number,
) {
  const bloomA = context.createRadialGradient(
    width * (0.24 + Math.sin(elapsed * 0.07) * 0.06),
    height * (0.34 + Math.cos(elapsed * 0.05) * 0.04),
    0,
    width * 0.26,
    height * 0.36,
    Math.max(width, height) * 0.42,
  )
  bloomA.addColorStop(0, withAlpha(palette[0], 0.05 + intensityFactor * 0.05 + brightnessFactor * 0.03))
  bloomA.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = bloomA
  context.fillRect(0, 0, width, height)

  const bloomB = context.createRadialGradient(
    width * (0.76 + Math.cos(elapsed * 0.06) * 0.05),
    height * (0.62 + Math.sin(elapsed * 0.04) * 0.05),
    0,
    width * 0.74,
    height * 0.6,
    Math.max(width, height) * 0.48,
  )
  bloomB.addColorStop(0, withAlpha(palette[palette.length - 1], 0.04 + brightnessFactor * 0.04))
  bloomB.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = bloomB
  context.fillRect(0, 0, width, height)
}

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123
  return value - Math.floor(value)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
</script>

<template>
  <canvas ref="canvasRef" class="visualizer-canvas" />
</template>

<style scoped>
.visualizer-canvas {
  display: block;
  width: 100vw;
  height: 100vh;
  background: #030407;
}
</style>
