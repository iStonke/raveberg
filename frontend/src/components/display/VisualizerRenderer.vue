<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import type { VisualizerState } from '../../services/api'

const props = defineProps<{
  visualizer: VisualizerState
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

let frameId = 0
let startTime = 0

const particleSeeds = Array.from({ length: 180 }, (_, index) => ({
  angle: (index / 180) * Math.PI * 2,
  radius: 0.12 + ((index * 37) % 100) / 100,
  seed: ((index * 67) % 97) / 97,
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
  const speedFactor = 0.35 + props.visualizer.speed / 90
  const intensityFactor = 0.25 + props.visualizer.intensity / 100
  const brightnessFactor = 0.35 + props.visualizer.brightness / 100
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

function getPalette(colorScheme: VisualizerState['color_scheme'], brightnessFactor: number) {
  const palettes: Record<VisualizerState['color_scheme'], string[]> = {
    mono: ['rgba(255,255,255,0.95)', 'rgba(210,210,210,0.82)', 'rgba(145,145,145,0.72)'],
    acid: ['rgba(192,255,76,0.95)', 'rgba(35,255,220,0.88)', 'rgba(255,230,64,0.86)'],
    ultraviolet: ['rgba(165,112,255,0.96)', 'rgba(76,234,255,0.85)', 'rgba(255,84,214,0.82)'],
    redline: ['rgba(255,78,78,0.95)', 'rgba(255,160,70,0.86)', 'rgba(255,238,170,0.8)'],
  }

  return palettes[colorScheme].map((color) => color.replace(/0\.\d+\)$/, `${Math.min(1, brightnessFactor)})`))
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
