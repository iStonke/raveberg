<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, withDefaults } from 'vue'

import type { VisualizerState } from '../../services/api'

type QualityLevel = 'low' | 'medium' | 'high'
type LayerIndex = 0 | 1 | 2

interface SwarmCollisionConfig {
  ballCount: number
  minRadius: number
  maxRadius: number
  sizePulseStrength: number
  collisionStrength: number
  glowIntensity: number
  swarmStrength: number
  eventReactionStrength: number
  quality: QualityLevel
}

interface ResolvedConfig extends SwarmCollisionConfig {
  maxBallCount: number
  cellSize: number
}

interface Ball {
  id: number
  layer: LayerIndex
  x: number
  y: number
  vx: number
  vy: number
  ax: number
  ay: number
  baseRadius: number
  radius: number
  radiusVelocity: number
  pulse: number
  glow: number
  opacity: number
  softness: number
  mass: number
  driftPhase: number
  driftRate: number
  cohesionBias: number
  orbitBias: number
  eventBias: number
  maxSpeed: number
  tension: number
  linkId: number | null
  linkEnergy: number
  splitCooldown: number
}

interface WaveRing {
  x: number
  y: number
  radius: number
  width: number
  life: number
  maxLife: number
  strength: number
}

interface ForceField {
  x: number
  y: number
  radius: number
  life: number
  maxLife: number
  strength: number
}

interface Palette {
  backgroundTop: string
  backgroundBottom: string
  haze: [number, number, number]
  shell: [number, number, number]
  core: [number, number, number]
  accent: [number, number, number]
  deep: [number, number, number]
}

const props = withDefaults(
  defineProps<{
    visualizer: VisualizerState
    eventToken?: number
    config?: Partial<SwarmCollisionConfig>
  }>(),
  {
    eventToken: 0,
    config: () => ({}),
  },
)

const canvasRef = ref<HTMLCanvasElement | null>(null)

let frameId = 0
let lastTimestamp = 0
let nextBallId = 1
let width = 0
let height = 0
let dpr = 1
let resizeObserver: ResizeObserver | null = null
let rebuildSignature = ''
let smoothedSpeed = props.visualizer.speed
let smoothedIntensity = props.visualizer.intensity
let smoothedBrightness = props.visualizer.brightness

const balls: Ball[] = []
const rings: WaveRing[] = []
const forceFields: ForceField[] = []

onMounted(() => {
  resizeCanvas()
  rebuildSwarm(true)
  lastTimestamp = performance.now()
  frameId = window.requestAnimationFrame(render)

  resizeObserver = new ResizeObserver(() => {
    resizeCanvas()
    rebuildSwarm(true)
  })

  if (canvasRef.value) {
    resizeObserver.observe(canvasRef.value)
  }

  window.addEventListener('resize', handleWindowResize)
})

onBeforeUnmount(() => {
  window.cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', handleWindowResize)
})

watch(
  () => JSON.stringify(props.config ?? {}),
  () => {
    rebuildSwarm(true)
  },
)

watch(
  () => props.eventToken,
  (next, previous) => {
    if (!next || next === previous || !width || !height) {
      return
    }
    emitImageImpulse(next)
  },
)

function handleWindowResize() {
  resizeCanvas()
  rebuildSwarm(true)
}

function resizeCanvas() {
  const canvas = canvasRef.value
  if (!canvas) {
    return
  }

  dpr = Math.min(window.devicePixelRatio || 1, 2)
  width = window.innerWidth
  height = window.innerHeight

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
  if (!canvas || !context || !width || !height) {
    frameId = window.requestAnimationFrame(render)
    return
  }

  const deltaSeconds = clamp((timestamp - lastTimestamp) / 1000, 1 / 120, 1 / 24)
  lastTimestamp = timestamp

  const controls = updateControls(deltaSeconds)
  const config = resolveConfig()
  rebuildSwarm(false)

  updateForceFields(deltaSeconds)
  updateRings(deltaSeconds)
  updateSwarm(deltaSeconds, controls, config, timestamp * 0.001)
  drawScene(context, controls, config, timestamp * 0.001)

  frameId = window.requestAnimationFrame(render)
}

function rebuildSwarm(force: boolean) {
  const config = resolveConfig()
  const signature = `${width}x${height}:${config.ballCount}:${config.minRadius}:${config.maxRadius}:${config.quality}`
  if (!force && signature === rebuildSignature) {
    return
  }

  rebuildSignature = signature
  balls.length = 0
  rings.length = 0
  forceFields.length = 0
  nextBallId = 1

  const layerShares: Array<{ layer: LayerIndex; share: number }> = [
    { layer: 0, share: 0.44 },
    { layer: 1, share: 0.38 },
    { layer: 2, share: 0.18 },
  ]

  let created = 0
  for (let index = 0; index < layerShares.length; index += 1) {
    const entry = layerShares[index]
    const remaining = config.ballCount - created
    const count =
      index === layerShares.length - 1 ? remaining : Math.round(config.ballCount * entry.share)
    for (let item = 0; item < count; item += 1) {
      balls.push(createBall(entry.layer, config, false))
      created += 1
    }
  }
}

function createBall(layer: LayerIndex, config: ResolvedConfig, isSplit: boolean): Ball {
  const layerRadiusFactor = layer === 0 ? 0.6 : layer === 1 ? 1 : 1.52
  const layerSpeedFactor = layer === 0 ? 0.44 : layer === 1 ? 0.72 : 1
  const baseRadius =
    randomBetween(config.minRadius, config.maxRadius) *
    layerRadiusFactor *
    randomBetween(0.82, 1.18)
  const angle = Math.random() * Math.PI * 2
  const speed = randomBetween(16, 46) * layerSpeedFactor
  const padding = config.maxRadius * 2.4

  return {
    id: nextBallId++,
    layer,
    x: randomBetween(padding, Math.max(padding + 1, width - padding)),
    y: randomBetween(padding, Math.max(padding + 1, height - padding)),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed * randomBetween(0.74, 1.12),
    ax: 0,
    ay: 0,
    baseRadius,
    radius: baseRadius * randomBetween(0.92, 1.08),
    radiusVelocity: 0,
    pulse: isSplit ? 0.16 : randomBetween(-0.06, 0.08),
    glow: isSplit ? 0.7 : randomBetween(0.05, 0.18),
    opacity: layer === 0 ? randomBetween(0.12, 0.22) : layer === 1 ? randomBetween(0.2, 0.34) : randomBetween(0.28, 0.5),
    softness: layer === 0 ? randomBetween(0.85, 1.25) : layer === 1 ? randomBetween(0.6, 1) : randomBetween(0.35, 0.8),
    mass: Math.max(1, baseRadius * baseRadius * (layer === 2 ? 1.6 : layer === 1 ? 1.2 : 0.9)),
    driftPhase: Math.random() * Math.PI * 2,
    driftRate: randomBetween(0.22, 0.78),
    cohesionBias: randomBetween(0.78, 1.24),
    orbitBias: randomBetween(-1, 1),
    eventBias: randomBetween(0.72, 1.35),
    maxSpeed: layer === 0 ? 28 : layer === 1 ? 48 : 68,
    tension: 0,
    linkId: null,
    linkEnergy: 0,
    splitCooldown: isSplit ? 9 : randomBetween(1.5, 5),
  }
}

function updateControls(deltaSeconds: number) {
  const smoothing = 1 - Math.exp(-deltaSeconds * 3.2)
  smoothedSpeed += (props.visualizer.speed - smoothedSpeed) * smoothing
  smoothedIntensity += (props.visualizer.intensity - smoothedIntensity) * smoothing
  smoothedBrightness += (props.visualizer.brightness - smoothedBrightness) * smoothing

  return {
    speedFactor: 0.58 + smoothedSpeed / 92,
    intensityFactor: 0.36 + smoothedIntensity / 100,
    brightnessFactor: 0.44 + smoothedBrightness / 100,
    palette: getPalette(props.visualizer.color_scheme, 0.44 + smoothedBrightness / 120),
  }
}

function updateSwarm(
  deltaSeconds: number,
  controls: ReturnType<typeof updateControls>,
  config: ResolvedConfig,
  elapsed: number,
) {
  const cellSize = config.cellSize
  const buckets = new Map<string, number[]>()
  const ballsById = new Map<number, Ball>()
  const globalAngle =
    Math.sin(elapsed * 0.13) * 0.7 +
    Math.cos(elapsed * 0.07 + smoothedIntensity * 0.02) * 0.95 +
    Math.PI * 0.18
  const globalDrift = 4 + controls.intensityFactor * 4.6
  const centerX = width * 0.5
  const centerY = height * 0.5

  for (let index = 0; index < balls.length; index += 1) {
    ballsById.set(balls[index].id, balls[index])
  }

  for (let index = 0; index < balls.length; index += 1) {
    const ball = balls[index]
    ball.ax = Math.cos(globalAngle) * globalDrift * (ball.layer === 0 ? 0.66 : ball.layer === 1 ? 0.92 : 1.2)
    ball.ay = Math.sin(globalAngle * 1.03) * globalDrift * (ball.layer === 0 ? 0.5 : ball.layer === 1 ? 0.76 : 1.05)

    const driftX = Math.sin(elapsed * (0.8 + ball.driftRate) + ball.driftPhase) * (6 + ball.layer * 3)
    const driftY = Math.cos(elapsed * (0.62 + ball.driftRate * 0.9) + ball.driftPhase * 0.7) * (6 + ball.layer * 2.6)
    ball.ax += driftX
    ball.ay += driftY

    const centerDx = centerX - ball.x
    const centerDy = centerY - ball.y
    const centerDistance = Math.hypot(centerDx, centerDy) || 1
    const centerEase = clamp(centerDistance / Math.max(width, height), 0, 1)
    ball.ax += (centerDx / centerDistance) * centerEase * (2.8 + ball.cohesionBias * 1.8)
    ball.ay += (centerDy / centerDistance) * centerEase * (2.8 + ball.cohesionBias * 1.8)

    if (ball.linkId != null && ball.linkEnergy > 0) {
      const partner = ballsById.get(ball.linkId)
      if (partner) {
        const linkDx = partner.x - ball.x
        const linkDy = partner.y - ball.y
        const linkDistance = Math.hypot(linkDx, linkDy) || 1
        const pull = ball.linkEnergy * 18
        ball.ax += (linkDx / linkDistance) * pull
        ball.ay += (linkDy / linkDistance) * pull
      }
    }

    const cellKey = gridKey(ball.x, ball.y, cellSize)
    const bucket = buckets.get(cellKey)
    if (bucket) {
      bucket.push(index)
    } else {
      buckets.set(cellKey, [index])
    }
  }

  applyForceFields(balls, forceFields, controls, deltaSeconds)

  for (let index = 0; index < balls.length; index += 1) {
    const ball = balls[index]
    const cellX = Math.floor(ball.x / cellSize)
    const cellY = Math.floor(ball.y / cellSize)

    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const bucket = buckets.get(`${cellX + offsetX}:${cellY + offsetY}`)
        if (!bucket) {
          continue
        }
        for (let bucketIndex = 0; bucketIndex < bucket.length; bucketIndex += 1) {
          const otherIndex = bucket[bucketIndex]
          if (otherIndex <= index) {
            continue
          }
          interactBalls(ball, balls[otherIndex], controls, config, elapsed)
        }
      }
    }
  }

  for (let index = balls.length - 1; index >= 0; index -= 1) {
    const ball = balls[index]
    const targetRadius = ball.baseRadius * (1 + ball.pulse * config.sizePulseStrength)
    const spring = (targetRadius - ball.radius) * (8.4 + ball.softness * 3.2)
    ball.radiusVelocity = (ball.radiusVelocity + spring * deltaSeconds) * Math.exp(-deltaSeconds * 7.2)
    ball.radius += ball.radiusVelocity * deltaSeconds
    ball.pulse += (0 - ball.pulse) * (1 - Math.exp(-deltaSeconds * 2.8))
    ball.glow += (0 - ball.glow) * (1 - Math.exp(-deltaSeconds * 2.2))
    ball.tension += (0 - ball.tension) * (1 - Math.exp(-deltaSeconds * 3.8))
    ball.linkEnergy = Math.max(0, ball.linkEnergy - deltaSeconds * 0.38)
    if (ball.linkEnergy <= 0.01) {
      ball.linkEnergy = 0
      ball.linkId = null
    }
    ball.splitCooldown = Math.max(0, ball.splitCooldown - deltaSeconds)

    ball.vx = (ball.vx + ball.ax * deltaSeconds * controls.speedFactor) * Math.exp(-deltaSeconds * 0.36)
    ball.vy = (ball.vy + ball.ay * deltaSeconds * controls.speedFactor) * Math.exp(-deltaSeconds * 0.36)

    const speedLimit = ball.maxSpeed * controls.speedFactor * (ball.layer === 2 ? 1.05 : ball.layer === 0 ? 0.84 : 1)
    const speed = Math.hypot(ball.vx, ball.vy)
    if (speed > speedLimit) {
      const limiter = speedLimit / speed
      ball.vx *= limiter
      ball.vy *= limiter
    }

    ball.x += ball.vx * deltaSeconds
    ball.y += ball.vy * deltaSeconds

    resolveBounds(ball)
  }
}

function interactBalls(
  ball: Ball,
  other: Ball,
  controls: ReturnType<typeof updateControls>,
  config: ResolvedConfig,
  elapsed: number,
) {
  const dx = other.x - ball.x
  const dy = other.y - ball.y
  const distanceSq = dx * dx + dy * dy
  if (distanceSq <= 0.01) {
    return
  }

  const distance = Math.sqrt(distanceSq)
  const nx = dx / distance
  const ny = dy / distance
  const minDistance = ball.radius + other.radius
  const interactionRadius = minDistance * (2.7 + controls.intensityFactor * 0.6)

  if (distance < interactionRadius) {
    const falloff = 1 - distance / interactionRadius
    const separation = Math.max(0, 1 - distance / (minDistance * 1.22))
    const cohesion = falloff * config.swarmStrength * 6.2
    const orbit = falloff * config.swarmStrength * 2.8 * (ball.orbitBias - other.orbitBias)
    const align = falloff * config.swarmStrength * 0.03

    ball.ax += nx * cohesion * ball.cohesionBias
    ball.ay += ny * cohesion * ball.cohesionBias
    other.ax -= nx * cohesion * other.cohesionBias
    other.ay -= ny * cohesion * other.cohesionBias

    ball.ax += -ny * orbit
    ball.ay += nx * orbit
    other.ax -= -ny * orbit
    other.ay -= nx * orbit

    ball.ax += (other.vx - ball.vx) * align
    ball.ay += (other.vy - ball.vy) * align
    other.ax += (ball.vx - other.vx) * align
    other.ay += (ball.vy - other.vy) * align

    if (separation > 0) {
      const repel = separation * (20 + controls.intensityFactor * 12)
      ball.ax -= nx * repel
      ball.ay -= ny * repel
      other.ax += nx * repel
      other.ay += ny * repel
    }
  }

  if (distance >= minDistance) {
    return
  }

  const overlap = minDistance - distance
  const rvx = other.vx - ball.vx
  const rvy = other.vy - ball.vy
  const normalVelocity = rvx * nx + rvy * ny
  const restitution = 0.74 + Math.random() * 0.12
  const impulseMagnitude =
    ((-(1 + restitution) * Math.min(normalVelocity, 0)) + overlap * 4.5) /
    ((1 / ball.mass) + (1 / other.mass))

  const impulseX = impulseMagnitude * nx
  const impulseY = impulseMagnitude * ny
  ball.vx -= impulseX / ball.mass
  ball.vy -= impulseY / ball.mass
  other.vx += impulseX / other.mass
  other.vy += impulseY / other.mass

  const correction = overlap / ((1 / ball.mass) + (1 / other.mass)) * 0.52
  ball.x -= (correction / ball.mass) * nx
  ball.y -= (correction / ball.mass) * ny
  other.x += (correction / other.mass) * nx
  other.y += (correction / other.mass) * ny

  const impact = Math.abs(normalVelocity) + overlap * 9
  const midpointX = ball.x + dx * 0.5
  const midpointY = ball.y + dy * 0.5
  const variation = randomBetween(0, 1)
  const pulseDirection = variation > 0.24 ? 1 : -0.5
  const pulseStrength = clamp((impact / 34) * (0.12 + variation * 0.32), -0.18, 0.52)

  if (impact < 18) {
    applyCollisionPulse(ball, pulseStrength * 0.55 * pulseDirection, 0.26)
    applyCollisionPulse(other, pulseStrength * 0.48 * pulseDirection, 0.24)
  } else if (impact < 42) {
    applyCollisionPulse(ball, pulseStrength * pulseDirection, 0.38)
    applyCollisionPulse(other, pulseStrength * pulseDirection, 0.36)
    if (variation > 0.54) {
      connectBalls(ball, other, clamp(impact / 90, 0.12, 0.42))
    }
  } else {
    applyCollisionPulse(ball, pulseStrength * 1.15, 0.58)
    applyCollisionPulse(other, pulseStrength * 1.08, 0.56)
    connectBalls(ball, other, clamp(impact / 70, 0.2, 0.68))
    spawnRing(midpointX, midpointY, overlap * 0.6 + Math.max(ball.radius, other.radius), 0.62 + variation * 0.42)
    ball.vx -= nx * impact * 0.16 * config.collisionStrength
    ball.vy -= ny * impact * 0.16 * config.collisionStrength
    other.vx += nx * impact * 0.16 * config.collisionStrength
    other.vy += ny * impact * 0.16 * config.collisionStrength
  }

  if (
    variation > 0.988 &&
    config.quality !== 'low' &&
    balls.length < config.maxBallCount &&
    (ball.baseRadius > config.minRadius * 1.8 || other.baseRadius > config.minRadius * 1.8)
  ) {
    if (ball.baseRadius >= other.baseRadius) {
      splitBall(ball, nx, ny, config)
    } else {
      splitBall(other, -nx, -ny, config)
    }
    spawnRing(midpointX, midpointY, minDistance * 0.9, 0.92)
  }

  if (variation > 0.82) {
    forceFields.push({
      x: midpointX,
      y: midpointY,
      radius: Math.max(ball.radius, other.radius) * randomBetween(6, 9),
      life: 0.42,
      maxLife: 0.42,
      strength: randomBetween(-70, 70),
    })
  }

  ball.tension = Math.max(ball.tension, clamp(impact / 60, 0.08, 0.72))
  other.tension = Math.max(other.tension, clamp(impact / 60, 0.08, 0.72))
}

function applyCollisionPulse(ball: Ball, pulse: number, glow: number) {
  ball.pulse = clamp(ball.pulse + pulse, -0.22, 0.78)
  ball.glow = Math.max(ball.glow, glow)
}

function connectBalls(ball: Ball, other: Ball, energy: number) {
  ball.linkId = other.id
  other.linkId = ball.id
  ball.linkEnergy = Math.max(ball.linkEnergy, energy)
  other.linkEnergy = Math.max(other.linkEnergy, energy)
}

function splitBall(ball: Ball, nx: number, ny: number, config: ResolvedConfig) {
  if (ball.splitCooldown > 0 || balls.length >= config.maxBallCount) {
    return
  }

  const originalBase = ball.baseRadius
  const splitBase = clamp(originalBase * 0.64, config.minRadius, config.maxRadius * 0.82)
  ball.baseRadius = splitBase
  ball.radius = Math.max(ball.radius * 0.82, splitBase)
  ball.splitCooldown = 11
  ball.pulse = Math.max(ball.pulse, 0.22)
  ball.glow = Math.max(ball.glow, 0.9)

  const clone = createBall(ball.layer, config, true)
  clone.baseRadius = clamp(originalBase * 0.52, config.minRadius * 0.92, config.maxRadius * 0.74)
  clone.radius = clone.baseRadius
  clone.x = clamp(ball.x + nx * splitBase * 2.1, clone.baseRadius, width - clone.baseRadius)
  clone.y = clamp(ball.y + ny * splitBase * 2.1, clone.baseRadius, height - clone.baseRadius)
  clone.vx = ball.vx + nx * randomBetween(22, 34)
  clone.vy = ball.vy + ny * randomBetween(22, 34)
  clone.splitCooldown = 11
  balls.push(clone)
}

function resolveBounds(ball: Ball) {
  const margin = ball.radius + 2
  if (ball.x < margin) {
    ball.x = margin
    ball.vx = Math.abs(ball.vx) * 0.92
    ball.glow = Math.max(ball.glow, 0.24)
  } else if (ball.x > width - margin) {
    ball.x = width - margin
    ball.vx = -Math.abs(ball.vx) * 0.92
    ball.glow = Math.max(ball.glow, 0.24)
  }

  if (ball.y < margin) {
    ball.y = margin
    ball.vy = Math.abs(ball.vy) * 0.92
    ball.glow = Math.max(ball.glow, 0.24)
  } else if (ball.y > height - margin) {
    ball.y = height - margin
    ball.vy = -Math.abs(ball.vy) * 0.92
    ball.glow = Math.max(ball.glow, 0.24)
  }
}

function updateForceFields(deltaSeconds: number) {
  for (let index = forceFields.length - 1; index >= 0; index -= 1) {
    const field = forceFields[index]
    field.life -= deltaSeconds
    if (field.life <= 0) {
      forceFields.splice(index, 1)
    }
  }
}

function updateRings(deltaSeconds: number) {
  for (let index = rings.length - 1; index >= 0; index -= 1) {
    const ring = rings[index]
    ring.life -= deltaSeconds
    ring.radius += deltaSeconds * 58
    ring.width *= 0.996
    if (ring.life <= 0) {
      rings.splice(index, 1)
    }
  }
}

function applyForceFields(
  swarm: Ball[],
  fields: ForceField[],
  controls: ReturnType<typeof updateControls>,
  deltaSeconds: number,
) {
  for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
    const field = fields[fieldIndex]
    const lifeProgress = field.life / field.maxLife
    for (let ballIndex = 0; ballIndex < swarm.length; ballIndex += 1) {
      const ball = swarm[ballIndex]
      const dx = field.x - ball.x
      const dy = field.y - ball.y
      const distance = Math.hypot(dx, dy)
      if (!distance || distance > field.radius) {
        continue
      }
      const influence = 1 - distance / field.radius
      const wave = Math.sin(influence * Math.PI)
      const push = field.strength * influence * wave * ball.eventBias * deltaSeconds * 0.42
      ball.ax += (dx / distance) * push
      ball.ay += (dy / distance) * push
      ball.pulse += push * 0.0007 * controls.intensityFactor
      ball.glow = Math.max(ball.glow, lifeProgress * influence * 0.45)
    }
  }
}

function drawScene(
  context: CanvasRenderingContext2D,
  controls: ReturnType<typeof updateControls>,
  config: ResolvedConfig,
  elapsed: number,
) {
  const palette = controls.palette
  context.clearRect(0, 0, width, height)

  const background = context.createLinearGradient(0, 0, 0, height)
  background.addColorStop(0, palette.backgroundTop)
  background.addColorStop(1, palette.backgroundBottom)
  context.fillStyle = background
  context.fillRect(0, 0, width, height)

  const driftX = width * (0.48 + Math.sin(elapsed * 0.07) * 0.1)
  const driftY = height * (0.42 + Math.cos(elapsed * 0.05) * 0.08)
  const haze = context.createRadialGradient(driftX, driftY, width * 0.06, driftX, driftY, width * 0.65)
  haze.addColorStop(0, rgba(palette.haze, 0.16 * controls.brightnessFactor))
  haze.addColorStop(0.5, rgba(palette.accent, 0.04 * controls.brightnessFactor))
  haze.addColorStop(1, 'rgba(0, 0, 0, 0)')
  context.fillStyle = haze
  context.fillRect(0, 0, width, height)

  drawForceFields(context, palette, controls)
  drawBridges(context, palette, controls)
  drawRings(context, palette, controls)
  drawBalls(context, palette, controls, config)
  drawVignette(context)
}

function drawForceFields(
  context: CanvasRenderingContext2D,
  palette: Palette,
  controls: ReturnType<typeof updateControls>,
) {
  context.save()
  context.globalCompositeOperation = 'lighter'
  for (let index = 0; index < forceFields.length; index += 1) {
    const field = forceFields[index]
    const alpha = (field.life / field.maxLife) * 0.1 * controls.brightnessFactor
    const gradient = context.createRadialGradient(field.x, field.y, 0, field.x, field.y, field.radius)
    gradient.addColorStop(0, rgba(palette.accent, alpha * 1.8))
    gradient.addColorStop(0.38, rgba(palette.shell, alpha))
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    context.fillStyle = gradient
    context.beginPath()
    context.arc(field.x, field.y, field.radius, 0, Math.PI * 2)
    context.fill()
  }
  context.restore()
}

function drawRings(
  context: CanvasRenderingContext2D,
  palette: Palette,
  controls: ReturnType<typeof updateControls>,
) {
  context.save()
  context.globalCompositeOperation = 'lighter'
  for (let index = 0; index < rings.length; index += 1) {
    const ring = rings[index]
    const alpha = (ring.life / ring.maxLife) * 0.18 * controls.brightnessFactor * ring.strength
    context.beginPath()
    context.lineWidth = ring.width
    context.strokeStyle = rgba(palette.accent, alpha)
    context.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2)
    context.stroke()
  }
  context.restore()
}

function drawBridges(
  context: CanvasRenderingContext2D,
  palette: Palette,
  controls: ReturnType<typeof updateControls>,
) {
  const idMap = new Map<number, Ball>()
  for (let index = 0; index < balls.length; index += 1) {
    idMap.set(balls[index].id, balls[index])
  }

  context.save()
  context.globalCompositeOperation = 'lighter'
  for (let index = 0; index < balls.length; index += 1) {
    const ball = balls[index]
    if (ball.linkId == null || ball.linkEnergy <= 0 || ball.id > ball.linkId) {
      continue
    }
    const partner = idMap.get(ball.linkId)
    if (!partner) {
      continue
    }

    const distance = Math.hypot(partner.x - ball.x, partner.y - ball.y)
    if (distance > Math.max(width, height) * 0.18) {
      continue
    }

    const gradient = context.createLinearGradient(ball.x, ball.y, partner.x, partner.y)
    const alpha = ball.linkEnergy * 0.1 * controls.brightnessFactor
    gradient.addColorStop(0, rgba(palette.shell, alpha))
    gradient.addColorStop(0.5, rgba(palette.accent, alpha * 1.4))
    gradient.addColorStop(1, rgba(palette.shell, alpha))
    context.strokeStyle = gradient
    context.lineWidth = (ball.radius + partner.radius) * 0.2 + ball.linkEnergy * 6
    context.beginPath()
    context.moveTo(ball.x, ball.y)
    context.lineTo(partner.x, partner.y)
    context.stroke()
  }
  context.restore()
}

function drawBalls(
  context: CanvasRenderingContext2D,
  palette: Palette,
  controls: ReturnType<typeof updateControls>,
  config: ResolvedConfig,
) {
  const ordered = [...balls].sort((left, right) => left.layer - right.layer || left.radius - right.radius)

  context.save()
  context.globalCompositeOperation = 'lighter'

  for (let index = 0; index < ordered.length; index += 1) {
    const ball = ordered[index]
    const auraRadius =
      ball.radius *
      (2.6 + ball.softness * 0.9 + ball.glow * config.glowIntensity * 1.8 + ball.tension * 0.4)
    const aura = context.createRadialGradient(ball.x, ball.y, ball.radius * 0.1, ball.x, ball.y, auraRadius)
    aura.addColorStop(0, rgba(palette.core, ball.opacity * 0.3 + ball.glow * 0.08))
    aura.addColorStop(0.36, rgba(ball.layer === 2 ? palette.accent : palette.shell, ball.opacity * 0.14 + ball.glow * 0.1))
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)')
    context.fillStyle = aura
    context.beginPath()
    context.arc(ball.x, ball.y, auraRadius, 0, Math.PI * 2)
    context.fill()
  }

  context.restore()

  for (let index = 0; index < ordered.length; index += 1) {
    const ball = ordered[index]
    const shellGradient = context.createRadialGradient(
      ball.x - ball.radius * 0.32,
      ball.y - ball.radius * 0.36,
      ball.radius * 0.08,
      ball.x,
      ball.y,
      ball.radius * 1.1,
    )
    shellGradient.addColorStop(0, rgba(palette.core, 0.72 + ball.glow * 0.14))
    shellGradient.addColorStop(0.44, rgba(palette.shell, ball.opacity * 0.9 + ball.glow * 0.1))
    shellGradient.addColorStop(0.8, rgba(palette.deep, ball.opacity * 0.5))
    shellGradient.addColorStop(1, rgba(palette.deep, 0))
    context.fillStyle = shellGradient
    context.beginPath()
    context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
    context.fill()

    if (ball.layer > 0 || ball.glow > 0.22) {
      context.beginPath()
      context.strokeStyle = rgba(palette.core, 0.08 + ball.glow * 0.08)
      context.lineWidth = 0.8 + ball.radius * 0.08
      context.arc(ball.x, ball.y, ball.radius * 0.92, -Math.PI * 0.2, Math.PI * 0.72)
      context.stroke()
    }
  }
}

function drawVignette(context: CanvasRenderingContext2D) {
  const vignette = context.createRadialGradient(width * 0.5, height * 0.5, width * 0.2, width * 0.5, height * 0.5, width * 0.8)
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vignette.addColorStop(1, 'rgba(1, 2, 4, 0.48)')
  context.fillStyle = vignette
  context.fillRect(0, 0, width, height)
}

function spawnRing(x: number, y: number, radius: number, strength: number) {
  rings.push({
    x,
    y,
    radius,
    width: 1.8 + strength * 2.8,
    life: 0.64,
    maxLife: 0.64,
    strength,
  })
}

function emitImageImpulse(token: number) {
  const seedA = Math.abs(Math.sin(token * 12.9898 + 78.233))
  const seedB = Math.abs(Math.sin(token * 42.231 + 15.733))
  const x = width * (0.22 + seedA * 0.56)
  const y = height * (0.18 + seedB * 0.58)
  const direction = token % 2 === 0 ? 1 : -1
  const config = resolveConfig()

  forceFields.push({
    x,
    y,
    radius: Math.min(width, height) * 0.22,
    life: 0.86,
    maxLife: 0.86,
    strength: direction * 160 * config.eventReactionStrength,
  })
  spawnRing(x, y, Math.min(width, height) * 0.03, 0.88)
}

function resolveConfig(): ResolvedConfig {
  const quality = props.config?.quality ?? inferQuality()
  const defaultsByQuality: Record<QualityLevel, Pick<ResolvedConfig, 'ballCount' | 'minRadius' | 'maxRadius'>> = {
    low: { ballCount: 34, minRadius: 2.8, maxRadius: 14 },
    medium: { ballCount: 52, minRadius: 2.8, maxRadius: 16.8 },
    high: { ballCount: 70, minRadius: 2.6, maxRadius: 18.4 },
  }
  const defaults = defaultsByQuality[quality]
  const config = props.config ?? {}
  const maxRadius = config.maxRadius ?? defaults.maxRadius

  return {
    quality,
    ballCount: Math.round(clamp(config.ballCount ?? defaults.ballCount, 18, 96)),
    minRadius: clamp(config.minRadius ?? defaults.minRadius, 1.5, maxRadius - 0.1),
    maxRadius,
    sizePulseStrength: clamp(config.sizePulseStrength ?? 0.5, 0.15, 0.9),
    collisionStrength: clamp(config.collisionStrength ?? 1, 0.3, 1.6),
    glowIntensity: clamp(config.glowIntensity ?? 1, 0.45, 1.7),
    swarmStrength: clamp(config.swarmStrength ?? 1, 0.3, 1.8),
    eventReactionStrength: clamp(config.eventReactionStrength ?? 1, 0.3, 1.8),
    maxBallCount: Math.round(clamp((config.ballCount ?? defaults.ballCount) + 8, 26, 104)),
    cellSize: Math.max(34, maxRadius * 4.2),
  }
}

function inferQuality(): QualityLevel {
  const area = width * height
  const cores = navigator.hardwareConcurrency ?? 4
  if (area > 2300000 && cores >= 8) {
    return 'high'
  }
  if (area < 1100000 || cores <= 4) {
    return 'low'
  }
  return 'medium'
}

function getPalette(colorScheme: VisualizerState['color_scheme'], brightnessFactor: number): Palette {
  const basePalettes: Record<VisualizerState['color_scheme'], Omit<Palette, 'backgroundTop' | 'backgroundBottom'>> = {
    mono: {
      haze: [54, 70, 88],
      shell: [186, 198, 214],
      core: [248, 250, 255],
      accent: [164, 180, 204],
      deep: [88, 102, 118],
    },
    acid: {
      haze: [40, 58, 70],
      shell: [194, 208, 218],
      core: [248, 251, 255],
      accent: [142, 188, 176],
      deep: [92, 112, 118],
    },
    ultraviolet: {
      haze: [46, 48, 70],
      shell: [198, 200, 218],
      core: [248, 249, 255],
      accent: [146, 160, 214],
      deep: [98, 100, 126],
    },
    redline: {
      haze: [56, 48, 44],
      shell: [212, 202, 194],
      core: [255, 248, 245],
      accent: [196, 154, 136],
      deep: [124, 100, 92],
    },
  }

  return {
    backgroundTop: `rgba(5, 7, 11, ${clamp(0.96 + brightnessFactor * 0.02, 0.9, 1)})`,
    backgroundBottom: `rgba(9, 12, 18, ${clamp(0.98 + brightnessFactor * 0.02, 0.92, 1)})`,
    ...basePalettes[colorScheme],
  }
}

function gridKey(x: number, y: number, cellSize: number) {
  return `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function rgba(rgb: [number, number, number], alpha: number) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clamp(alpha, 0, 1)})`
}
</script>

<template>
  <canvas ref="canvasRef" class="swarm-canvas" />
</template>

<style scoped>
.swarm-canvas {
  display: block;
  width: 100vw;
  height: 100vh;
  background: #04070b;
}
</style>
