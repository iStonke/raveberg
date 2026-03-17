import type { ColorScheme, VisualizerPreset } from '../../../services/api'
import type { VisualizerRuntimeController, VisualizerRuntimeOptions } from './runtimeTypes'
import { clamp, lerp, normalize } from './runtimeUtils'

export type MatrixScreenPreset = Extract<VisualizerPreset, 'matrix_screen'>

const MATRIX_SCREEN_PRESETS = new Set<MatrixScreenPreset>(['matrix_screen'])
const STREAM_GLYPHS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&*+-/<>{}[]=@!?'

interface MatrixPalette {
  backgroundTop: string
  backgroundBottom: string
  vignette: string
  hazeA: string
  hazeB: string
  glyphDim: string
  glyphBody: string
  glyphHead: string
  glow: string
  flash: string
}

interface MatrixLayerConfig {
  sizeMultiplier: number
  speedMultiplier: number
  alphaMultiplier: number
  densityMultiplier: number
  blurMultiplier: number
}

interface MatrixStream {
  x: number
  baseFontSize: number
  fontSize: number
  charWidth: number
  fontScale: number
  speed: number
  length: number
  headY: number
  active: boolean
  respawnDelay: number
  glyphs: string[]
  lastCell: number
  mutationTimer: number
  mutationInterval: number
  brightness: number
  alpha: number
  phase: number
  pulseSpeed: number
  zoneIndex: number
  zoneCount: number
  layerIndex: number
  dropout: number
  headGlow: number
  headLength: number
  layer: MatrixLayerConfig
}

const MATRIX_PALETTES: Record<ColorScheme, MatrixPalette> = {
  mono: {
    backgroundTop: '#010201',
    backgroundBottom: '#000000',
    vignette: 'rgba(0, 0, 0, 0.82)',
    hazeA: 'rgba(10, 38, 14, 0.14)',
    hazeB: 'rgba(5, 24, 10, 0.12)',
    glyphDim: '#0d3010',
    glyphBody: '#31c54a',
    glyphHead: '#d8ffdc',
    glow: 'rgba(102, 255, 140, 0.42)',
    flash: 'rgba(164, 255, 184, 0.14)',
  },
  acid: {
    backgroundTop: '#020408',
    backgroundBottom: '#000102',
    vignette: 'rgba(0, 0, 0, 0.84)',
    hazeA: 'rgba(8, 28, 46, 0.16)',
    hazeB: 'rgba(3, 20, 35, 0.14)',
    glyphDim: '#12304a',
    glyphBody: '#57cfff',
    glyphHead: '#e6fbff',
    glow: 'rgba(118, 214, 255, 0.44)',
    flash: 'rgba(208, 240, 255, 0.15)',
  },
  ultraviolet: {
    backgroundTop: '#04020a',
    backgroundBottom: '#010102',
    vignette: 'rgba(0, 0, 0, 0.84)',
    hazeA: 'rgba(34, 14, 64, 0.18)',
    hazeB: 'rgba(17, 10, 36, 0.13)',
    glyphDim: '#2b1851',
    glyphBody: '#9c62ff',
    glyphHead: '#f0e5ff',
    glow: 'rgba(188, 136, 255, 0.42)',
    flash: 'rgba(226, 216, 255, 0.15)',
  },
  redline: {
    backgroundTop: '#020306',
    backgroundBottom: '#010101',
    vignette: 'rgba(0, 0, 0, 0.84)',
    hazeA: 'rgba(18, 54, 30, 0.16)',
    hazeB: 'rgba(36, 10, 56, 0.12)',
    glyphDim: '#17331f',
    glyphBody: '#74ff66',
    glyphHead: '#f6ecff',
    glow: 'rgba(180, 112, 255, 0.36)',
    flash: 'rgba(216, 255, 214, 0.14)',
  },
}

const LAYERS: MatrixLayerConfig[] = [
  { sizeMultiplier: 0.66, speedMultiplier: 0.72, alphaMultiplier: 0.36, densityMultiplier: 0.84, blurMultiplier: 0.56 },
  { sizeMultiplier: 1, speedMultiplier: 1, alphaMultiplier: 0.76, densityMultiplier: 0.94, blurMultiplier: 1 },
  { sizeMultiplier: 1.42, speedMultiplier: 1.24, alphaMultiplier: 1.08, densityMultiplier: 0.68, blurMultiplier: 1.34 },
]

export function isMatrixScreenPreset(preset: string): preset is MatrixScreenPreset {
  return MATRIX_SCREEN_PRESETS.has(preset as MatrixScreenPreset)
}

export class MatrixScreenRuntime implements VisualizerRuntimeController {
  private container: HTMLElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private options: VisualizerRuntimeOptions
  private errorHandler: ((error: Error) => void) | null = null
  private animationFrameId = 0
  private lastFrameAt = 0
  private width = 1
  private height = 1
  private dpr = 1
  private time = 0
  private flash = 0
  private activityBoost = 0
  private readonly streams: MatrixStream[] = []

  constructor(private readonly preset: MatrixScreenPreset) {
    this.options = {
      preset,
      intensity: 65,
      speed: 55,
      brightness: 70,
      colorScheme: 'mono',
      hydraColorfulness: 78,
      hydraSceneChangeRate: 46,
      hydraSymmetryAmount: 38,
      hydraFeedbackAmount: 24,
      hydraQuality: 'medium',
      hydraAudioReactivityEnabled: true,
      hydraPaletteMode: 'auto',
    }
  }

  async init(container: HTMLElement, options: VisualizerRuntimeOptions) {
    this.container = container
    this.options = { ...options }
    this.setupCanvas()
    this.rebuildStreams()
    this.start()
  }

  start() {
    if (!this.canvas || this.animationFrameId) {
      return
    }
    this.lastFrameAt = performance.now()
    this.animationFrameId = window.requestAnimationFrame(this.animate)
  }

  stop() {
    window.cancelAnimationFrame(this.animationFrameId)
    this.animationFrameId = 0
  }

  destroy() {
    this.stop()
    this.streams.length = 0
    this.ctx = null
    this.canvas?.remove()
    this.canvas = null
    this.container = null
  }

  resize(width: number, height: number) {
    this.resizeCanvas(width, height)
    this.rebuildStreams()
  }

  updateOptions(partialOptions: Partial<VisualizerRuntimeOptions>) {
    this.options = { ...this.options, ...partialOptions }
    this.flash = Math.max(this.flash, 0.08 + normalize(this.options.brightness) * 0.06)
    this.activityBoost = Math.max(this.activityBoost, 0.1 + normalize(this.options.intensity) * 0.08)
    this.rebuildStreams()
  }

  triggerEvent(name: string) {
    if (name === 'mode_change' || name === 'upload_created') {
      this.flash = Math.min(1, this.flash + 0.16 + Math.random() * 0.08)
      this.activityBoost = Math.min(1, this.activityBoost + 0.24 + Math.random() * 0.14)
    }
  }

  setErrorHandler(handler: ((error: Error) => void) | null) {
    this.errorHandler = handler
  }

  private setupCanvas() {
    if (!this.container) {
      return
    }

    const canvas = document.createElement('canvas')
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    canvas.style.pointerEvents = 'none'
    this.container.replaceChildren(canvas)
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false })
    if (!this.ctx) {
      throw new Error('Matrix screen canvas context not available')
    }
    this.resizeCanvas(this.container.clientWidth, this.container.clientHeight)
  }

  private resizeCanvas(width: number, height: number) {
    if (!this.canvas || !this.ctx) {
      return
    }
    this.width = Math.max(1, Math.round(width))
    this.height = Math.max(1, Math.round(height))
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    this.canvas.width = Math.round(this.width * this.dpr)
    this.canvas.height = Math.round(this.height * this.dpr)
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
  }

  private rebuildStreams() {
    if (!this.width || !this.height) {
      return
    }

    this.streams.length = 0
    const intensity = normalize(this.options.intensity)
    const baseFont = lerp(14, 22, clamp(this.width / 1600, 0, 1) * 0.55 + 0.25)

    LAYERS.forEach((layer, layerIndex) => {
      const fontSize = baseFont * layer.sizeMultiplier
      const spacing = fontSize * 0.92
      const laneCount = Math.max(12, Math.round(this.width / spacing))
      const laneWidth = this.width / laneCount
      const jitter = laneWidth * 0.22

      for (let index = 0; index < laneCount; index += 1) {
        const x = laneWidth * (index + 0.5) + (Math.random() * 2 - 1) * jitter
        const stream: MatrixStream = {
          x,
          baseFontSize: fontSize,
          fontSize,
          charWidth: fontSize * 0.7,
          fontScale: 1,
          speed: 0,
          length: 0,
          headY: 0,
          active: false,
          respawnDelay: 0,
          glyphs: [],
          lastCell: 0,
          mutationTimer: 0,
          mutationInterval: 0.12,
          brightness: 1,
          alpha: 1,
          phase: Math.random() * Math.PI * 2,
          pulseSpeed: lerp(0.12, 0.36, Math.random()),
          zoneIndex: index,
          zoneCount: laneCount,
          layerIndex,
          dropout: 0,
          headGlow: 1,
          headLength: 1,
          layer,
        }
        this.respawnStream(stream, true, layerIndex)
        this.streams.push(stream)
      }
    })
  }

  private respawnStream(stream: MatrixStream, initial = false, layerIndex = 1) {
    const density = this.activityLevel
    const speed = normalize(this.options.speed)
    const intensity = normalize(this.options.intensity)
    const zoneActivity = this.zoneActivityFor(stream)
    const activeNeighbors = this.countNearbyActiveStreams(stream)
    const neighborBoost = activeNeighbors === 0 ? 0.18 : activeNeighbors === 1 ? 0.08 : -0.04
    const startChance = clamp(
      (initial ? density * 0.82 : density * 0.68)
        + zoneActivity * 0.24
        + neighborBoost
        + this.activityBoost * 0.12,
      0.18,
      0.96,
    )
    const shouldStartActive = Math.random() < startChance

    stream.active = shouldStartActive
    stream.respawnDelay = shouldStartActive
      ? 0
      : lerp(0.08, 1.9, Math.random()) * lerp(1.12, 0.62, intensity) * lerp(1.08, 0.72, zoneActivity)
    stream.fontScale = lerp(0.82, 1.28, Math.random()) * lerp(0.92, 1.08, zoneActivity)
    stream.fontSize = Math.max(10, stream.baseFontSize * stream.fontScale)
    stream.charWidth = stream.fontSize * 0.7
    stream.speed = lerp(90, 470, speed) * stream.layer.speedMultiplier * lerp(0.72, 1.38, Math.random()) * lerp(0.9, 1.18, zoneActivity)
    stream.length = Math.round(
      lerp(6, 34, intensity) * lerp(0.52, 1.42, Math.random()) * lerp(0.78, 1.22, stream.layer.sizeMultiplier) * lerp(0.82, 1.18, zoneActivity),
    )
    stream.headY = shouldStartActive
      ? lerp(-this.height * 0.15, this.height * 1.04, Math.random())
      : -stream.length * stream.fontSize - Math.random() * this.height * 0.35
    stream.glyphs = Array.from({ length: stream.length + 8 }, () => this.randomGlyph(layerIndex))
    stream.lastCell = Math.floor(stream.headY / stream.fontSize)
    stream.mutationInterval = lerp(0.028, 0.18, Math.random()) / lerp(0.9, 1.18, stream.layer.speedMultiplier)
    stream.mutationTimer = Math.random() * stream.mutationInterval
    stream.brightness = lerp(0.52, 1.34, Math.random()) * lerp(0.86, 1.14, stream.layer.sizeMultiplier) * lerp(0.84, 1.24, zoneActivity)
    stream.alpha = lerp(0.28, 1.08, Math.random()) * stream.layer.alphaMultiplier * lerp(0.78, 1.18, zoneActivity)
    stream.dropout = lerp(0.02, 0.34, Math.random()) * lerp(1.08, 0.78, zoneActivity)
    stream.headGlow = lerp(0.82, 1.4, Math.random()) * lerp(0.92, 1.2, zoneActivity)
    stream.headLength = Math.round(lerp(1, 3.6, Math.random()))
  }

  private randomGlyph(layerIndex: number) {
    const offset = layerIndex * 11 + Math.floor(Math.random() * STREAM_GLYPHS.length)
    return STREAM_GLYPHS[offset % STREAM_GLYPHS.length] ?? '0'
  }

  private readonly animate = (timestamp: number) => {
    if (!this.ctx || !this.canvas) {
      return
    }

    try {
      this.animationFrameId = window.requestAnimationFrame(this.animate)
      const deltaSeconds = clamp((timestamp - this.lastFrameAt) / 1000 || 1 / 60, 1 / 144, 1 / 20)
      this.lastFrameAt = timestamp
      this.time += deltaSeconds
      this.flash = Math.max(0, this.flash * Math.exp(-deltaSeconds * 3.8))
      this.activityBoost = Math.max(0, this.activityBoost * Math.exp(-deltaSeconds * 1.4))

      this.drawBackground()
      this.updateAndDrawStreams(deltaSeconds)
    } catch (error) {
      this.stop()
      const runtimeError = error instanceof Error ? error : new Error('Matrix screen runtime failed')
      this.errorHandler?.(runtimeError)
    }
  }

  private drawBackground() {
    if (!this.ctx) {
      return
    }

    const palette = this.palette
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height)
    gradient.addColorStop(0, palette.backgroundTop)
    gradient.addColorStop(1, palette.backgroundBottom)
    this.ctx.fillStyle = gradient
    this.ctx.fillRect(0, 0, this.width, this.height)

    const driftA = Math.sin(this.time * 0.08) * this.width * 0.08
    const driftB = Math.cos(this.time * 0.06 + 1.3) * this.width * 0.06
    const hazeAlpha = 0.13 + normalize(this.options.brightness) * 0.03 + this.flash * 0.08

    this.ctx.save()
    this.ctx.globalCompositeOperation = 'screen'
    this.ctx.fillStyle = palette.hazeA
    this.ctx.globalAlpha = hazeAlpha
    this.ctx.beginPath()
    this.ctx.ellipse(this.width * 0.28 + driftA, this.height * 0.36, this.width * 0.34, this.height * 0.24, 0.2, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.fillStyle = palette.hazeB
    this.ctx.globalAlpha = hazeAlpha * 0.82
    this.ctx.beginPath()
    this.ctx.ellipse(this.width * 0.74 + driftB, this.height * 0.68, this.width * 0.3, this.height * 0.2, -0.18, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.restore()

    const vignette = this.ctx.createRadialGradient(
      this.width * 0.5,
      this.height * 0.5,
      Math.min(this.width, this.height) * 0.14,
      this.width * 0.5,
      this.height * 0.5,
      Math.max(this.width, this.height) * 0.72,
    )
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
    vignette.addColorStop(1, palette.vignette)
    this.ctx.fillStyle = vignette
    this.ctx.fillRect(0, 0, this.width, this.height)

    if (this.flash > 0.002) {
      this.ctx.fillStyle = palette.flash
      this.ctx.globalAlpha = clamp(this.flash * 0.42, 0, 0.22)
      this.ctx.fillRect(0, 0, this.width, this.height)
      this.ctx.globalAlpha = 1
    }
  }

  private updateAndDrawStreams(deltaSeconds: number) {
    if (!this.ctx) {
      return
    }

    const brightness = normalize(this.options.brightness)
    const palette = this.palette

    for (const stream of this.streams) {
      if (!stream.active) {
        stream.respawnDelay -= deltaSeconds
        if (stream.respawnDelay <= 0) {
          this.respawnStream(stream)
        }
        continue
      }

      stream.headY += stream.speed * deltaSeconds
      stream.mutationTimer -= deltaSeconds

      const currentCell = Math.floor(stream.headY / stream.fontSize)
      const cellDelta = clamp(currentCell - stream.lastCell, 0, 6)
      if (cellDelta > 0) {
        for (let index = 0; index < cellDelta; index += 1) {
          stream.glyphs.unshift(this.randomGlyph(1))
          if (stream.glyphs.length > stream.length + 12) {
            stream.glyphs.pop()
          }
        }
        stream.lastCell = currentCell
      }

      while (stream.mutationTimer <= 0) {
        const mutateIndex = Math.floor(Math.random() * stream.glyphs.length)
        stream.glyphs[mutateIndex] = this.randomGlyph(2)
        stream.mutationTimer += stream.mutationInterval
      }

      if (stream.headY - stream.length * stream.fontSize > this.height + stream.fontSize * 1.5) {
        stream.active = false
        stream.respawnDelay = lerp(0.08, 2.6, Math.random()) * lerp(1.2, 0.72, this.activityLevel)
        continue
      }

      const localPulse = 0.72
        + Math.sin(this.time * stream.pulseSpeed + stream.phase) * 0.1
        + Math.cos(this.time * (stream.pulseSpeed * 0.5) + stream.phase * 1.7) * 0.06
      const zoneActivity = this.zoneActivityFor(stream)
      const streamVisibility = clamp(
        stream.alpha * localPulse * (0.68 + zoneActivity * 0.34 + this.activityBoost * 0.18),
        0.05,
        1.22,
      )

      this.ctx.font = `${Math.round(stream.fontSize)}px 'IBM Plex Mono', 'JetBrains Mono', 'Courier New', monospace`

      for (let tailIndex = stream.length - 1; tailIndex >= 0; tailIndex -= 1) {
        const y = stream.headY - tailIndex * stream.fontSize
        if (y < -stream.fontSize || y > this.height + stream.fontSize) {
          continue
        }

        const glyph = stream.glyphs[tailIndex % stream.glyphs.length] ?? '0'
        const age = tailIndex / Math.max(1, stream.length - 1)
        const fade = Math.pow(1 - age, 1.45)
        const alpha = clamp(fade * streamVisibility * lerp(0.38, 0.94, brightness) * stream.brightness, 0, 1)
        const fragmentThreshold = stream.dropout * age * lerp(0.68, 1.12, 1 - zoneActivity)
        if (
          tailIndex > stream.headLength
          && Math.sin(tailIndex * 0.92 + this.time * (0.65 + stream.pulseSpeed) + stream.phase) > 1 - fragmentThreshold * 2.4
        ) {
          continue
        }

        if (tailIndex < stream.headLength) {
          this.ctx.fillStyle = palette.glyphHead
          this.ctx.globalAlpha = clamp(alpha * (0.96 + this.flash * 0.5 + zoneActivity * 0.08), 0, 1)
          this.ctx.shadowBlur = stream.fontSize * (0.88 + stream.layer.blurMultiplier * 0.52) * stream.headGlow
          this.ctx.shadowColor = palette.glow
        } else if (tailIndex < Math.max(3, stream.headLength + 2)) {
          this.ctx.fillStyle = palette.glyphBody
          this.ctx.globalAlpha = clamp(alpha * lerp(0.72, 0.96, zoneActivity), 0, 0.96)
          this.ctx.shadowBlur = stream.fontSize * 0.2 * stream.layer.blurMultiplier * lerp(0.72, 1.18, stream.headGlow - 0.82)
          this.ctx.shadowColor = palette.glow
        } else {
          this.ctx.fillStyle = tailIndex > stream.length * 0.72 ? palette.glyphDim : palette.glyphBody
          this.ctx.globalAlpha = clamp(alpha * (tailIndex > stream.length * 0.72 ? 0.64 : 0.76), 0, 0.78)
          this.ctx.shadowBlur = 0
        }

        this.ctx.fillText(glyph, stream.x, y)
      }
    }

    this.ctx.shadowBlur = 0
    this.ctx.globalAlpha = 1
  }

  private get activityLevel() {
    const intensity = normalize(this.options.intensity)
    const macro = 0.68
      + Math.sin(this.time * 0.08) * 0.16
      + Math.cos(this.time * 0.031 + 1.4) * 0.12
      + Math.sin(this.time * 0.017 + 2.6) * 0.08
      + this.activityBoost * 0.16
    return clamp(lerp(0.34, 0.9, intensity) * macro, 0.22, 1)
  }

  private zoneActivityFor(stream: MatrixStream) {
    const xNorm = stream.zoneCount <= 1 ? 0.5 : stream.zoneIndex / (stream.zoneCount - 1)
    const bandA = 0.56 + Math.sin(this.time * 0.18 + xNorm * 6.4 + stream.layerIndex * 1.1) * 0.18
    const bandB = 0.52 + Math.cos(this.time * 0.11 - xNorm * 9.1 + stream.layerIndex * 0.7) * 0.16
    const wave = 0.5 + Math.sin(this.time * 0.05 + xNorm * 3.6 + 0.9) * 0.12
    const edgeLift = 0.08 + (1 - Math.abs(xNorm * 2 - 1)) * 0.02
    const rightSideGuard = xNorm > 0.66 ? 0.08 : 0
    return clamp((bandA + bandB + wave) / 3 + edgeLift + rightSideGuard, 0.24, 1)
  }

  private countNearbyActiveStreams(stream: MatrixStream) {
    let active = 0
    for (const candidate of this.streams) {
      if (!candidate.active || candidate.layerIndex !== stream.layerIndex) {
        continue
      }
      if (Math.abs(candidate.zoneIndex - stream.zoneIndex) <= 1) {
        active += 1
      }
    }
    return active
  }

  private get palette() {
    return MATRIX_PALETTES[this.options.colorScheme]
  }
}
