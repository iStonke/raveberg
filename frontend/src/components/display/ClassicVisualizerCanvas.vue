<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch, ref } from 'vue'

import type { VisualizerState } from '../../services/api'

const props = defineProps<{
  visualizer: VisualizerState
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

let frameId = 0
let startTime = 0
let smoothedSpeed = props.visualizer.speed
let smoothedIntensity = props.visualizer.intensity
let smoothedBrightness = props.visualizer.brightness

const particleSeeds = Array.from({ length: 180 }, (_, index) => ({
  angle: (index / 180) * Math.PI * 2,
  radius: 0.12 + ((index * 37) % 100) / 100,
  seed: ((index * 67) % 97) / 97,
}))

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

  if (props.visualizer.active_preset === 'tunnel') {
    drawTunnel(context, width, height, elapsed, speedFactor, intensityFactor, palette)
  } else if (props.visualizer.active_preset === 'particles') {
    drawParticles(context, width, height, elapsed, speedFactor, intensityFactor, palette)
  } else if (props.visualizer.active_preset === 'waves') {
    drawWaves(context, width, height, elapsed, speedFactor, intensityFactor, palette)
  } else if (props.visualizer.active_preset === 'warehouse') {
    drawWarehouse(context, width, height, elapsed, speedFactor, intensityFactor, palette)
  } else {
    drawKaleidoscope(context, width, height, elapsed, speedFactor, intensityFactor, palette)
  }

  frameId = window.requestAnimationFrame(render)
}

function drawTunnel(
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
  const maxRadius = Math.hypot(cx, cy)
  const rings = 14 + Math.floor(intensityFactor * 18)

  for (let index = 0; index < rings; index += 1) {
    const progress = ((elapsed * speedFactor * 0.55) + index / rings) % 1
    const radius = (1 - progress) * maxRadius
    context.beginPath()
    context.lineWidth = 2 + intensityFactor * 10 * (1 - progress)
    context.strokeStyle = palette[index % palette.length]
    context.globalAlpha = 0.08 + (1 - progress) * 0.42
    context.arc(cx, cy, radius, 0, Math.PI * 2)
    context.stroke()
  }

  context.globalAlpha = 1
}

function drawParticles(
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
  const radius = Math.min(width, height) * (0.22 + intensityFactor * 0.32)

  for (let index = 0; index < particleSeeds.length; index += 1) {
    const seed = particleSeeds[index]
    const angle = seed.angle + elapsed * speedFactor * (0.45 + seed.seed)
    const drift = Math.sin(elapsed * (0.9 + seed.seed) + seed.seed * 30) * radius * 0.45
    const distance = radius * seed.radius + drift
    const x = cx + Math.cos(angle) * distance
    const y = cy + Math.sin(angle * 1.3) * distance * 0.72
    const size = 1.2 + seed.seed * 4 + intensityFactor * 5

    context.beginPath()
    context.fillStyle = palette[index % palette.length]
    context.globalAlpha = 0.18 + seed.seed * 0.55
    context.arc(x, y, size, 0, Math.PI * 2)
    context.fill()
  }

  context.globalAlpha = 1
}

function drawWaves(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsed: number,
  speedFactor: number,
  intensityFactor: number,
  palette: string[],
) {
  const lines = 6 + Math.floor(intensityFactor * 8)
  const amplitude = 18 + intensityFactor * 90

  for (let line = 0; line < lines; line += 1) {
    const yBase = (height / (lines + 1)) * (line + 1)
    context.beginPath()
    context.lineWidth = 2 + intensityFactor * 6
    context.strokeStyle = palette[line % palette.length]
    context.globalAlpha = 0.18 + (line / lines) * 0.35

    for (let x = 0; x <= width; x += 18) {
      const wave =
        Math.sin((x / width) * Math.PI * (3 + line) + elapsed * speedFactor * 1.7 + line) *
          amplitude +
        Math.cos((x / width) * Math.PI * 2 + elapsed * speedFactor + line * 0.5) *
          amplitude *
          0.35
      const y = yBase + wave
      if (x === 0) {
        context.moveTo(x, y)
      } else {
        context.lineTo(x, y)
      }
    }
    context.stroke()
  }

  context.globalAlpha = 1
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
  const petals = 10 + Math.floor(intensityFactor * 16)
  const outerRadius = Math.min(width, height) * (0.22 + intensityFactor * 0.26)

  context.save()
  context.translate(cx, cy)

  for (let index = 0; index < petals; index += 1) {
    const rotation = (Math.PI * 2 * index) / petals + elapsed * speedFactor * 0.28
    const inner = outerRadius * (0.25 + ((index % 5) / 8))
    context.save()
    context.rotate(rotation)
    context.beginPath()
    context.moveTo(0, 0)
    context.quadraticCurveTo(inner * 0.35, -outerRadius * 0.45, 0, -outerRadius)
    context.quadraticCurveTo(-inner * 0.35, -outerRadius * 0.45, 0, 0)
    context.fillStyle = palette[index % palette.length]
    context.globalAlpha = 0.16 + ((index % 4) / 10)
    context.fill()
    context.restore()
  }

  context.restore()
  context.globalAlpha = 1
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

function withAlpha(color: string, alpha: number) {
  const normalized = Math.max(0, Math.min(1, alpha))
  return color.replace(/[\d.]+\)\s*$/, `${normalized})`)
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
