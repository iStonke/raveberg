import * as THREE from 'three'
import type {
  Container as TsParticlesContainer,
  Engine as TsParticlesEngine,
  ISourceOptions,
} from '@tsparticles/engine'

import type { ColorScheme, VisualizerPreset, VisualizerState } from '../../../services/api'

export interface VisualizerRuntimeOptions {
  preset: VisualizerPreset
  intensity: number
  speed: number
  brightness: number
  colorScheme: ColorScheme
}

export interface VisualizerRuntimeController {
  init(container: HTMLElement, options: VisualizerRuntimeOptions): Promise<void> | void
  start(): Promise<void> | void
  stop(): void
  destroy(): void
  resize(width: number, height: number): void
  updateOptions(partialOptions: Partial<VisualizerRuntimeOptions>): Promise<void> | void
  triggerEvent(name: string, payload?: unknown): void
  setErrorHandler(handler: ((error: Error) => void) | null): void
}

type VantaPreset = Extract<VisualizerPreset, 'vanta_fog' | 'vanta_halo'>
type HydraPreset = Extract<VisualizerPreset, 'hydra_rave'>
type TsParticlesPreset = Extract<VisualizerPreset, 'particle_swarm'>
type VantaFactory = (options: Record<string, unknown>) => VantaEffect
type VantaEffect = {
  destroy?: () => void
  resize?: () => void
  setOptions?: (options: Record<string, unknown>) => void
}

type HydraFactory = new (options: Record<string, unknown>) => HydraInstance
type HydraInstance = {
  canvas: HTMLCanvasElement
  synth: HydraSynth
  tick: (dt: number) => void
  setResolution: (width: number, height: number) => void
  hush: () => void
  regl?: {
    destroy?: () => void
  }
}

type HydraOutput = Record<string, unknown>
type HydraChain = {
  out: (output?: HydraOutput) => HydraChain
  blend: (source: HydraChain, amount?: number | (() => number)) => HydraChain
  add: (source: HydraChain, amount?: number | (() => number)) => HydraChain
  diff: (source: HydraChain, amount?: number | (() => number)) => HydraChain
  mult: (source: HydraChain, amount?: number | (() => number)) => HydraChain
  modulate: (source: HydraChain, amount?: number | (() => number)) => HydraChain
  modulateScale: (source: HydraChain, amount?: number | (() => number)) => HydraChain
  modulateRotate: (source: HydraChain, amount?: number | (() => number)) => HydraChain
  color: (...args: Array<number | (() => number)>) => HydraChain
  colorama: (amount?: number | (() => number)) => HydraChain
  saturate: (amount?: number | (() => number)) => HydraChain
  contrast: (amount?: number | (() => number)) => HydraChain
  brightness: (amount?: number | (() => number)) => HydraChain
  rotate: (...args: Array<number | (() => number)>) => HydraChain
  scale: (...args: Array<number | (() => number)>) => HydraChain
  scrollX: (...args: Array<number | (() => number)>) => HydraChain
  scrollY: (...args: Array<number | (() => number)>) => HydraChain
  kaleid: (segments?: number | (() => number)) => HydraChain
  posterize: (...args: Array<number | (() => number)>) => HydraChain
  thresh: (...args: Array<number | (() => number)>) => HydraChain
  luma: (...args: Array<number | (() => number)>) => HydraChain
  repeat: (...args: Array<number | (() => number)>) => HydraChain
  pixelate: (...args: Array<number | (() => number)>) => HydraChain
}

type HydraSynth = {
  speed: number
  o0: HydraOutput
  o1: HydraOutput
  o2: HydraOutput
  o3: HydraOutput
  render: (output?: HydraOutput) => void
  osc: (...args: Array<number | (() => number)>) => HydraChain
  noise: (...args: Array<number | (() => number)>) => HydraChain
  voronoi: (...args: Array<number | (() => number)>) => HydraChain
  shape: (...args: Array<number | (() => number)>) => HydraChain
  gradient: (...args: Array<number | (() => number)>) => HydraChain
  solid: (...args: Array<number | (() => number)>) => HydraChain
  src: (source: HydraOutput) => HydraChain
}

const EXTERNAL_PRESETS = new Set<VisualizerPreset>([
  'vanta_fog',
  'vanta_halo',
  'hydra_rave',
  'particle_swarm',
])

const PALETTES: Record<
  ColorScheme,
  {
    fogBase: number
    fogLow: number
    fogMid: number
    fogHighlight: number
    haloBase: number
    haloAccent: number
    background: number
  }
> = {
  mono: {
    fogBase: 0x07111c,
    fogLow: 0x122233,
    fogMid: 0x314a62,
    fogHighlight: 0x7e96ad,
    haloBase: 0x2e4358,
    haloAccent: 0xa6bbcf,
    background: 0x04090f,
  },
  acid: {
    fogBase: 0x04101b,
    fogLow: 0x0d2340,
    fogMid: 0x114f7b,
    fogHighlight: 0x61b6d7,
    haloBase: 0x174d8a,
    haloAccent: 0x89dfff,
    background: 0x030811,
  },
  ultraviolet: {
    fogBase: 0x080817,
    fogLow: 0x1a1740,
    fogMid: 0x23396d,
    fogHighlight: 0x8f93d8,
    haloBase: 0x574ea5,
    haloAccent: 0x8ac7ff,
    background: 0x050711,
  },
  redline: {
    fogBase: 0x12070d,
    fogLow: 0x32101c,
    fogMid: 0x5f2333,
    fogHighlight: 0xc46b80,
    haloBase: 0x7d263c,
    haloAccent: 0xf08a92,
    background: 0x090507,
  },
}

export function isExternalVisualizerPreset(preset: VisualizerPreset) {
  return EXTERNAL_PRESETS.has(preset)
}

export function createVisualizerRuntime(
  visualizer: VisualizerState,
): VisualizerRuntimeController | null {
  if (visualizer.active_preset === 'vanta_fog' || visualizer.active_preset === 'vanta_halo') {
    return new VantaVisualizerRuntime(visualizer.active_preset)
  }
  if (visualizer.active_preset === 'hydra_rave') {
    return new HydraVisualizerRuntime('hydra_rave')
  }
  if (visualizer.active_preset === 'particle_swarm') {
    return new TsParticlesVisualizerRuntime('particle_swarm')
  }
  return null
}

class VantaVisualizerRuntime implements VisualizerRuntimeController {
  private container: HTMLElement | null = null
  private effect: VantaEffect | null = null
  private options: VisualizerRuntimeOptions
  private readonly preset: VantaPreset
  private readonly burstTimeouts = new Set<number>()
  private errorHandler: ((error: Error) => void) | null = null

  constructor(preset: VantaPreset) {
    this.preset = preset
    this.options = {
      preset,
      intensity: 65,
      speed: 55,
      brightness: 70,
      colorScheme: 'acid',
    }
  }

  async init(container: HTMLElement, options: VisualizerRuntimeOptions) {
    this.container = container
    this.options = { ...options }
    await this.start()
  }

  async start() {
    if (!this.container || this.effect) {
      return
    }

    const factory = await loadVantaFactory(this.preset)
    this.effect = factory({
      el: this.container,
      THREE,
      mouseControls: false,
      touchControls: false,
      gyroControls: false,
      mouseEase: false,
      forceAnimate: true,
      ...resolveVantaOptions(this.preset, this.options),
    })
    this.resize(this.container.clientWidth, this.container.clientHeight)
  }

  stop() {
    this.destroyEffect()
  }

  destroy() {
    this.destroyEffect()
    this.clearBursts()
    this.container = null
  }

  resize(_width: number, _height: number) {
    this.effect?.resize?.()
  }

  updateOptions(partialOptions: Partial<VisualizerRuntimeOptions>) {
    this.options = { ...this.options, ...partialOptions }
    if (!this.effect?.setOptions) {
      return
    }
    this.effect.setOptions(resolveVantaOptions(this.preset, this.options))
    this.effect.resize?.()
  }

  triggerEvent(name: string) {
    if (name !== 'mode_change' || !this.effect?.setOptions) {
      return
    }

    const burstOptions = buildVantaBurstOptions(this.preset, this.options)
    this.effect.setOptions(burstOptions)
    const timeoutId = window.setTimeout(() => {
      this.burstTimeouts.delete(timeoutId)
      if (!this.effect?.setOptions) {
        return
      }
      this.effect.setOptions(resolveVantaOptions(this.preset, this.options))
    }, 520)
    this.burstTimeouts.add(timeoutId)
  }

  setErrorHandler(handler: ((error: Error) => void) | null) {
    this.errorHandler = handler
  }

  private destroyEffect() {
    try {
      this.effect?.destroy?.()
    } finally {
      if (this.container) {
        this.container.querySelectorAll('.vanta-canvas').forEach((node) => node.remove())
        this.container.style.removeProperty('background')
      }
    }
    this.effect = null
  }

  private clearBursts() {
    this.burstTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
    this.burstTimeouts.clear()
  }
}

interface HydraPalette {
  base: [number, number, number]
  secondary: [number, number, number]
  accent: [number, number, number]
  pulse: [number, number, number]
  highlight: [number, number, number]
  glow: [number, number, number]
}

const HYDRA_PALETTES: Record<ColorScheme, HydraPalette> = {
  mono: {
    base: [0.76, 0.82, 0.92],
    secondary: [0.48, 0.63, 0.82],
    accent: [0.31, 0.56, 0.78],
    pulse: [0.7, 0.83, 0.95],
    highlight: [0.9, 0.94, 1],
    glow: [0.36, 0.57, 0.82],
  },
  acid: {
    base: [0.16, 0.82, 1],
    secondary: [0.97, 0.19, 0.82],
    accent: [0.34, 0.47, 1],
    pulse: [0.08, 1, 0.83],
    highlight: [0.98, 0.9, 0.22],
    glow: [0.53, 0.14, 1],
  },
  ultraviolet: {
    base: [0.48, 0.29, 1],
    secondary: [0.07, 0.78, 1],
    accent: [0.94, 0.17, 0.78],
    pulse: [0.24, 0.93, 0.88],
    highlight: [0.84, 0.67, 1],
    glow: [0.22, 0.53, 1],
  },
  redline: {
    base: [1, 0.24, 0.49],
    secondary: [0.4, 0.82, 1],
    accent: [0.89, 0.08, 0.68],
    pulse: [1, 0.54, 0.24],
    highlight: [0.96, 0.91, 0.32],
    glow: [0.46, 0.21, 0.98],
  },
}

class HydraVisualizerRuntime implements VisualizerRuntimeController {
  private container: HTMLElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private hydra: HydraInstance | null = null
  private readonly preset: HydraPreset
  private options: VisualizerRuntimeOptions
  private frameId = 0
  private lastFrameAt = 0
  private burstLevel = 0
  private sceneClock = 0
  private errorHandler: ((error: Error) => void) | null = null
  private isDisposed = false

  constructor(preset: HydraPreset) {
    this.preset = preset
    this.options = {
      preset,
      intensity: 65,
      speed: 55,
      brightness: 70,
      colorScheme: 'acid',
    }
  }

  async init(container: HTMLElement, options: VisualizerRuntimeOptions) {
    this.container = container
    this.options = { ...options }
    this.isDisposed = false
    await this.start()
  }

  async start() {
    if (!this.container || this.hydra) {
      return
    }

    const canvas = document.createElement('canvas')
    canvas.className = 'hydra-canvas'
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      display: 'block',
      pointerEvents: 'none',
    })
    this.container.appendChild(canvas)
    this.canvas = canvas

    const handleContextLost = (event: Event) => {
      event.preventDefault()
      this.reportError(new Error('Hydra WebGL-Kontext verloren'))
    }
    canvas.addEventListener('webglcontextlost', handleContextLost, { passive: false })

    try {
      const Hydra = await loadHydraFactory()
      if (this.isDisposed) {
        canvas.removeEventListener('webglcontextlost', handleContextLost)
        return
      }

      const { cssWidth, cssHeight, pixelWidth, pixelHeight } = this.resolveSize()
      const hydra = new Hydra({
        canvas,
        width: pixelWidth,
        height: pixelHeight,
        autoLoop: false,
        makeGlobal: false,
        detectAudio: false,
        enableStreamCapture: false,
        numSources: 4,
        numOutputs: 4,
        precision: 'mediump',
      })

      this.hydra = hydra
      this.configureHydraScene()
      this.resize(cssWidth, cssHeight)
      this.lastFrameAt = performance.now()
      this.frameId = window.requestAnimationFrame(this.loop)
    } catch (error) {
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      throw error
    }
  }

  stop() {
    this.cleanupHydra()
  }

  destroy() {
    this.isDisposed = true
    this.cleanupHydra()
    this.container = null
  }

  resize(width: number, height: number) {
    if (!this.hydra || !this.canvas) {
      return
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const scaledWidth = Math.max(1, Math.floor(width * dpr))
    const scaledHeight = Math.max(1, Math.floor(height * dpr))
    this.canvas.width = scaledWidth
    this.canvas.height = scaledHeight
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.hydra.setResolution(scaledWidth, scaledHeight)
  }

  updateOptions(partialOptions: Partial<VisualizerRuntimeOptions>) {
    this.options = { ...this.options, ...partialOptions }
    if (!this.hydra) {
      return
    }
    this.configureHydraScene()
  }

  triggerEvent(name: string) {
    if (name !== 'mode_change') {
      return
    }
    this.burstLevel = Math.min(1.4, this.burstLevel + 0.92)
  }

  setErrorHandler(handler: ((error: Error) => void) | null) {
    this.errorHandler = handler
  }

  private loop = (timestamp: number) => {
    if (!this.hydra || this.isDisposed) {
      return
    }

    const deltaMs = clamp(timestamp - this.lastFrameAt, 1000 / 120, 1000 / 20)
    this.lastFrameAt = timestamp
    this.sceneClock += (deltaMs / 1000) * (0.72 + this.speedFactor() * 0.68)
    this.burstLevel = Math.max(0, this.burstLevel * Math.exp(-deltaMs / 950))

    try {
      this.hydra.synth.speed = 0.62 + this.speedFactor() * 0.95
      this.hydra.tick(deltaMs)
      this.frameId = window.requestAnimationFrame(this.loop)
    } catch (error) {
      this.reportError(error instanceof Error ? error : new Error('Hydra tick fehlgeschlagen'))
    }
  }

  private configureHydraScene() {
    if (!this.hydra) {
      return
    }

    const h = this.hydra.synth
    const palette = HYDRA_PALETTES[this.options.colorScheme]

    const mirrorScene = h
      .osc(
        () => 8 + this.speedFactor() * 20 + this.phaseWeight(0.12, 0.2) * 6,
        () => 0.04 + this.phaseWeight(0.12, 0.2) * 0.035,
        () => 0.28 + this.burstLevel * 0.12,
      )
      .kaleid(() => 5 + Math.floor(this.intensityFactor() * 5 + this.phaseWeight(0.12, 0.2) * 8))
      .rotate(
        () => this.sceneClock * 0.08 + this.burstLevel * 0.05,
        () => 0.012 + this.speedFactor() * 0.028,
      )
      .modulate(
        h.noise(() => 2.4 + this.intensityFactor() * 2.6, () => 0.08 + this.speedFactor() * 0.14),
        () => 0.05 + this.intensityFactor() * 0.16,
      )
      .color(...palette.base)
      .saturate(() => 1.2 + this.brightnessFactor() * 0.4)
      .contrast(() => 1.18 + this.intensityFactor() * 0.28)

    const latticeScene = h
      .voronoi(
        () => 3.2 + this.intensityFactor() * 9 + this.burstLevel * 4,
        () => 0.16 + this.speedFactor() * 0.38,
        () => 0.22 + this.phaseWeight(0.38, 0.22) * 0.48,
      )
      .thresh(
        () => 0.38 + this.phaseWeight(0.38, 0.22) * 0.16,
        () => 0.05 + this.burstLevel * 0.03,
      )
      .posterize(
        () => 3 + this.intensityFactor() * 2 + this.phaseWeight(0.38, 0.22) * 2,
        () => 0.24 + this.brightnessFactor() * 0.3,
      )
      .rotate(() => -this.sceneClock * 0.04, () => 0.01 + this.speedFactor() * 0.03)
      .modulateScale(
        h.osc(() => 6 + this.speedFactor() * 6, () => 0.03, () => 0.6).kaleid(3),
        () => 0.08 + this.intensityFactor() * 0.15,
      )
      .color(...palette.secondary)
      .brightness(() => -0.06 + this.brightnessFactor() * 0.08)

    const waveScene = h
      .gradient(() => 0.12 + this.speedFactor() * 0.22)
      .color(...palette.accent)
      .colorama(() => 0.001 + this.phaseWeight(0.64, 0.2) * 0.012 + this.burstLevel * 0.01)
      .modulate(
        h.osc(() => 4 + this.speedFactor() * 5, () => 0.04, () => 0.1 + this.intensityFactor() * 0.22),
        () => 0.08 + this.phaseWeight(0.64, 0.2) * 0.12,
      )
      .scrollY(() => Math.sin(this.sceneClock * 0.22) * 0.03, () => 0.02 + this.speedFactor() * 0.02)
      .contrast(() => 1.06 + this.brightnessFactor() * 0.16)

    const surgeScene = h
      .shape(
        () => 4 + Math.floor(this.phaseWeight(0.86, 0.16) * 6),
        () => 0.34 + this.phaseWeight(0.86, 0.16) * 0.12,
        () => 0.001 + this.burstLevel * 0.004,
      )
      .repeat(
        () => 1 + this.phaseWeight(0.86, 0.16) * 2,
        () => 1 + this.phaseWeight(0.86, 0.16) * 2,
      )
      .rotate(() => this.sceneClock * 0.11, () => 0.025 + this.speedFactor() * 0.035)
      .modulateRotate(
        h.voronoi(() => 5 + this.burstLevel * 5, () => 0.15, () => 0.2 + this.intensityFactor() * 0.18),
        () => 0.16 + this.burstLevel * 0.18,
      )
      .color(...palette.pulse)
      .luma(() => 0.18 + this.phaseWeight(0.86, 0.16) * 0.2, 0.12)
      .saturate(() => 1.22 + this.intensityFactor() * 0.48)

    mirrorScene
      .blend(latticeScene, () => 0.18 + this.phaseWeight(0.38, 0.22) * 0.74)
      .blend(waveScene, () => 0.12 + this.phaseWeight(0.64, 0.2) * 0.62)
      .add(surgeScene, () => 0.06 + this.phaseWeight(0.86, 0.16) * 0.52 + this.burstLevel * 0.12)
      .blend(
        h
          .src(h.o1)
          .scale(() => 0.996 - this.feedbackFactor() * 0.012)
          .rotate(() => this.feedbackFactor() * 0.08)
          .color(...palette.highlight),
        () => 0.04 + this.feedbackFactor() * 0.16,
      )
      .brightness(() => -0.12 + this.brightnessFactor() * 0.18)
      .contrast(() => 1.18 + this.intensityFactor() * 0.34)
      .saturate(() => 1.24 + this.brightnessFactor() * 0.38)
      .out(h.o0)

    h.src(h.o0)
      .blend(
        h
          .src(h.o1)
          .scale(() => 0.998 - this.feedbackFactor() * 0.01)
          .rotate(() => -0.015 - this.feedbackFactor() * 0.05)
          .color(...palette.glow),
        () => 0.08 + this.feedbackFactor() * 0.24,
      )
      .modulate(
        h.noise(() => 2.1 + this.intensityFactor() * 2.2, () => 0.02 + this.speedFactor() * 0.05),
        () => 0.01 + this.burstLevel * 0.035,
      )
      .brightness(() => -0.08 + this.brightnessFactor() * 0.14)
      .contrast(() => 1.06 + this.intensityFactor() * 0.18)
      .out(h.o1)

    h.render(h.o1)
  }

  private resolveSize() {
    const cssWidth = Math.max(1, this.container?.clientWidth ?? window.innerWidth)
    const cssHeight = Math.max(1, this.container?.clientHeight ?? window.innerHeight)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    return {
      cssWidth,
      cssHeight,
      pixelWidth: Math.floor(cssWidth * dpr),
      pixelHeight: Math.floor(cssHeight * dpr),
    }
  }

  private intensityFactor() {
    return normalize(this.options.intensity)
  }

  private speedFactor() {
    return normalize(this.options.speed)
  }

  private brightnessFactor() {
    return normalize(this.options.brightness)
  }

  private feedbackFactor() {
    return 0.08 + this.intensityFactor() * 0.18 + this.burstLevel * 0.12
  }

  private phaseWeight(center: number, width: number) {
    const cycle = (this.sceneClock / 28) % 1
    const distance = circularDistance(cycle, center)
    if (distance >= width) {
      return 0
    }
    const normalized = distance / width
    return 0.5 + Math.cos(normalized * Math.PI) * 0.5
  }

  private cleanupHydra() {
    window.cancelAnimationFrame(this.frameId)
    this.frameId = 0

    if (this.hydra) {
      try {
        this.hydra.hush()
      } catch {
        // ignore cleanup failures while tearing down external visualizers
      }
      this.hydra.regl?.destroy?.()
      this.hydra = null
    }

    if (this.canvas) {
      this.canvas.remove()
      this.canvas = null
    }
  }

  private reportError(error: Error) {
    this.errorHandler?.(error)
  }
}

interface TsParticlesPalette {
  particleColors: string[]
  linkColors: string[]
  burstColors: string[]
}

const TSPARTICLES_PALETTES: Record<ColorScheme, TsParticlesPalette> = {
  mono: {
    particleColors: ['#d6e4ff', '#9cb9ff', '#74a4ff', '#c7f2ff'],
    linkColors: ['#aac7ff', '#80b5ff', '#d8ecff'],
    burstColors: ['#f0f7ff', '#9fd2ff', '#7caeff'],
  },
  acid: {
    particleColors: ['#12f3ff', '#ff4fd8', '#6e73ff', '#4ef7d8', '#ac63ff'],
    linkColors: ['#29e7ff', '#ff6bdd', '#7a92ff'],
    burstColors: ['#fef96f', '#33f0ff', '#ff73e5', '#6fffd0'],
  },
  ultraviolet: {
    particleColors: ['#ad63ff', '#4dbbff', '#ff62d8', '#5ef1ff', '#7b8dff'],
    linkColors: ['#8d73ff', '#54c6ff', '#ef84ff'],
    burstColors: ['#d7a5ff', '#82f3ff', '#ff8de5'],
  },
  redline: {
    particleColors: ['#ff4d8f', '#59d3ff', '#8f67ff', '#ff7d63', '#43eed9'],
    linkColors: ['#ff78ac', '#65d8ff', '#9c87ff'],
    burstColors: ['#ffd36d', '#ff8cb7', '#75eeff', '#b28aff'],
  },
}

class TsParticlesVisualizerRuntime implements VisualizerRuntimeController {
  private container: HTMLElement | null = null
  private instance: TsParticlesContainer | null = null
  private readonly preset: TsParticlesPreset
  private options: VisualizerRuntimeOptions
  private errorHandler: ((error: Error) => void) | null = null
  private resizeTimeoutId = 0
  private burstTimeoutId = 0
  private dimensions = { width: 0, height: 0 }
  private destroyed = false

  constructor(preset: TsParticlesPreset) {
    this.preset = preset
    this.options = {
      preset,
      intensity: 65,
      speed: 55,
      brightness: 70,
      colorScheme: 'acid',
    }
  }

  async init(container: HTMLElement, options: VisualizerRuntimeOptions) {
    this.container = container
    this.options = { ...options }
    this.destroyed = false
    this.syncDimensions()
    await this.start()
  }

  async start() {
    if (!this.container || this.instance) {
      return
    }

    const engine = await loadTsParticlesEngine()
    if (this.destroyed || !this.container) {
      return
    }

    this.syncDimensions()
    const instance = await engine.load({
      id: `raveberg-particle-swarm-${Math.round(performance.now() * 1000)}`,
      element: this.container,
      options: resolveTsParticlesOptions(this.options, this.dimensions),
    })

    if (!instance) {
      throw new Error('tsParticles konnte nicht initialisiert werden')
    }

    if (this.destroyed) {
      instance.destroy(true)
      return
    }

    this.instance = instance
    this.instance.play(true)
  }

  stop() {
    this.clearTimers()
    this.instance?.pause()
  }

  destroy() {
    this.destroyed = true
    this.clearTimers()
    try {
      this.instance?.destroy(true)
    } catch {
      // ignore teardown failures while cleaning up external visualizers
    }
    this.instance = null
    this.container?.querySelectorAll('canvas').forEach((node) => node.remove())
    this.container = null
  }

  resize(width: number, height: number) {
    this.dimensions = {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    }

    if (!this.instance) {
      return
    }

    window.clearTimeout(this.resizeTimeoutId)
    this.resizeTimeoutId = window.setTimeout(() => {
      if (!this.instance || this.destroyed) {
        return
      }
      void this.instance.refresh().catch((error) => {
        this.reportError(
          error instanceof Error ? error : new Error('tsParticles-Resize fehlgeschlagen'),
        )
      })
    }, 120)
  }

  async updateOptions(partialOptions: Partial<VisualizerRuntimeOptions>) {
    this.options = { ...this.options, ...partialOptions }
    if (!this.instance) {
      return
    }
    await this.instance.reset(resolveTsParticlesOptions(this.options, this.dimensions))
    this.instance.play(true)
  }

  triggerEvent(name: string) {
    if (name !== 'mode_change' || !this.instance) {
      return
    }

    const mouseData = {
      clicking: false,
      inside: true,
      position: {
        x: this.dimensions.width * 0.5,
        y: this.dimensions.height * 0.48,
      },
    }

    const pushCount = Math.round(12 + normalize(this.options.intensity) * 18)
    this.instance.particles.push(
      pushCount,
      mouseData,
      resolveTsParticlesBurstParticles(this.options) as never,
    )

    window.clearTimeout(this.burstTimeoutId)
    this.burstTimeoutId = window.setTimeout(() => {
      this.burstTimeoutId = 0
      if (!this.instance || this.destroyed) {
        return
      }
      this.instance.particles.push(
        Math.round(7 + normalize(this.options.intensity) * 10),
        {
          clicking: false,
          inside: true,
          position: {
            x: this.dimensions.width * 0.34,
            y: this.dimensions.height * 0.56,
          },
        },
        resolveTsParticlesBurstParticles(this.options, true) as never,
      )
    }, 220)
  }

  setErrorHandler(handler: ((error: Error) => void) | null) {
    this.errorHandler = handler
  }

  private syncDimensions() {
    this.dimensions = {
      width: Math.max(1, Math.round(this.container?.clientWidth ?? window.innerWidth)),
      height: Math.max(1, Math.round(this.container?.clientHeight ?? window.innerHeight)),
    }
  }

  private clearTimers() {
    window.clearTimeout(this.resizeTimeoutId)
    window.clearTimeout(this.burstTimeoutId)
    this.resizeTimeoutId = 0
    this.burstTimeoutId = 0
  }

  private reportError(error: Error) {
    this.errorHandler?.(error)
  }
}

async function loadVantaFactory(preset: VantaPreset): Promise<VantaFactory> {
  const runtimeWindow = window as Window & { THREE?: typeof THREE }
  runtimeWindow.THREE = THREE

  if (preset === 'vanta_halo') {
    const module = await import('vanta/dist/vanta.halo.min')
    return module.default as VantaFactory
  }

  const module = await import('vanta/dist/vanta.fog.min')
  return module.default as VantaFactory
}

async function loadHydraFactory(): Promise<HydraFactory> {
  const runtimeGlobal = globalThis as typeof globalThis & { global?: typeof globalThis }
  runtimeGlobal.global ??= runtimeGlobal
  const module = await import('hydra-synth')
  return module.default as HydraFactory
}

let tsParticlesEnginePromise: Promise<TsParticlesEngine> | null = null

async function loadTsParticlesEngine(): Promise<TsParticlesEngine> {
  if (!tsParticlesEnginePromise) {
    tsParticlesEnginePromise = Promise.all([
      import('@tsparticles/engine'),
      import('tsparticles'),
    ]).then(async ([engineModule, tsParticlesModule]) => {
      const engine = engineModule.tsParticles as TsParticlesEngine
      await tsParticlesModule.loadFull(engine, false)
      return engine
    })
  }

  return tsParticlesEnginePromise
}

function resolveVantaOptions(
  preset: VantaPreset,
  options: VisualizerRuntimeOptions,
): Record<string, unknown> {
  const palette = PALETTES[options.colorScheme]
  const intensity = normalize(options.intensity)
  const speed = normalize(options.speed)
  const brightness = normalize(options.brightness)

  if (preset === 'vanta_halo') {
    return {
      baseColor: palette.haloBase,
      color2: palette.haloAccent,
      backgroundColor: palette.background,
      amplitudeFactor: 0.22 + intensity * 0.52,
      ringFactor: 0.38 + brightness * 0.28,
      rotationFactor: 0.28 + speed * 0.42,
      size: 0.84 + intensity * 0.22,
      speed: 0.14 + speed * 0.34,
      xOffset: 0,
      yOffset: 0.025,
      scale: 1.08 + (1 - brightness) * 0.16,
      scaleMobile: 1.18 + (1 - brightness) * 0.2,
    }
  }

  return {
    baseColor: palette.fogBase,
    lowlightColor: palette.fogLow,
    midtoneColor: palette.fogMid,
    highlightColor: palette.fogHighlight,
    blurFactor: 0.52 - intensity * 0.18,
    speed: 0.12 + speed * 0.42,
    zoom: 0.74 + intensity * 0.18,
    scale: 2.8 - brightness * 0.45,
    scaleMobile: 3.8 - brightness * 0.55,
  }
}

function buildVantaBurstOptions(
  preset: VantaPreset,
  options: VisualizerRuntimeOptions,
): Record<string, unknown> {
  const intensity = normalize(options.intensity)
  const speed = normalize(options.speed)
  const brightness = normalize(options.brightness)

  if (preset === 'vanta_halo') {
    return {
      amplitudeFactor: 0.34 + intensity * 0.6,
      ringFactor: 0.48 + brightness * 0.34,
      rotationFactor: 0.34 + speed * 0.46,
    }
  }

  return {
    blurFactor: 0.44 - intensity * 0.16,
    speed: 0.18 + speed * 0.5,
    zoom: 0.82 + intensity * 0.2,
  }
}

function resolveTsParticlesOptions(
  options: VisualizerRuntimeOptions,
  dimensions: { width: number; height: number },
): ISourceOptions {
  const intensity = normalize(options.intensity)
  const speed = normalize(options.speed)
  const brightness = normalize(options.brightness)
  const palette = TSPARTICLES_PALETTES[options.colorScheme]
  const particleCount = Math.round(120 + intensity * 160)
  const moveSpeed = 0.42 + speed * 0.92
  const linkDistance = 112 + intensity * 82
  const linkOpacity = 0.09 + brightness * 0.16
  const sizeMin = 1.8 + brightness * 0.4
  const sizeMax = 8.8 + intensity * 6.2

  return {
    fullScreen: {
      enable: false,
      zIndex: 0,
    },
    background: {
      color: {
        value: 'transparent',
      },
    },
    detectRetina: false,
    autoPlay: true,
    fpsLimit: 50,
    pauseOnBlur: false,
    pauseOnOutsideViewport: false,
    particles: {
      number: {
        value: particleCount,
        density: {
          enable: true,
          width: Math.max(320, dimensions.width),
          height: Math.max(320, dimensions.height),
        },
      },
      color: {
        value: palette.particleColors,
      },
      shape: {
        type: 'circle',
      },
      opacity: {
        value: {
          min: 0.22 + brightness * 0.1,
          max: 0.54 + brightness * 0.24,
        },
        animation: {
          enable: true,
          speed: 0.36 + speed * 0.36,
          sync: false,
        },
      },
      size: {
        value: {
          min: sizeMin,
          max: sizeMax,
        },
        animation: {
          enable: true,
          speed: 0.08 + brightness * 0.12,
          sync: false,
          mode: 'auto',
          startValue: 'random',
          destroy: 'none',
        },
      },
      links: {
        enable: true,
        color: palette.linkColors,
        distance: linkDistance,
        opacity: linkOpacity,
        width: 1,
      },
      collisions: {
        enable: false,
        mode: 'bounce',
        maxSpeed: moveSpeed * 1.8,
      },
      move: {
        enable: true,
        speed: moveSpeed,
        random: false,
        straight: false,
        direction: 'none',
        outModes: {
          default: 'out',
        },
        attract: {
          enable: false,
          distance: 0,
          rotate: {
            x: 0,
            y: 0,
          },
        },
        drift: 0,
      },
      twinkle: {
        particles: {
          enable: brightness > 0.2,
          frequency: 0.018 + brightness * 0.04,
          opacity: 0.82 + brightness * 0.18,
        },
      },
      wobble: {
        enable: false,
        distance: 0,
        speed: {
          min: 0,
          max: 0,
        },
      },
    },
    interactivity: {
      events: {
        resize: {
          enable: true,
          delay: 0.15,
        },
      },
    },
  } as ISourceOptions
}

function resolveTsParticlesBurstParticles(
  options: VisualizerRuntimeOptions,
  secondaryBurst = false,
) {
  const intensity = normalize(options.intensity)
  const speed = normalize(options.speed)
  const brightness = normalize(options.brightness)
  const palette = TSPARTICLES_PALETTES[options.colorScheme]

  return {
    color: {
      value: secondaryBurst ? palette.linkColors : palette.burstColors,
    },
    size: {
      value: {
        min: 2.4,
        max: 5.2 + intensity * 2.2,
      },
    },
    opacity: {
      value: {
        min: 0.4 + brightness * 0.12,
        max: 0.82 + brightness * 0.18,
      },
    },
    links: {
      enable: true,
      color: secondaryBurst ? palette.particleColors : palette.burstColors,
      distance: 132 + intensity * 54,
      opacity: 0.18 + brightness * 0.14,
      width: 1.2,
    },
    move: {
      enable: true,
      speed: 0.42 + speed * 0.92,
      random: false,
      straight: false,
      direction: 'none',
      outModes: {
        default: 'out',
      },
      drift: 0,
    },
    twinkle: {
      particles: {
        enable: true,
        frequency: 0.09 + brightness * 0.1,
        opacity: 0.96,
      },
    },
  }
}

function normalize(value: number) {
  return Math.max(0, Math.min(value, 100)) / 100
}

function circularDistance(value: number, target: number) {
  const rawDistance = Math.abs(value - target)
  return Math.min(rawDistance, 1 - rawDistance)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
