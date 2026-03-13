import { HYDRA_QUALITY_PROFILES, HYDRA_PRESETS, type HydraPreset } from './hydraDefaults'
import { configureHydraChromaflowScene, configureHydraRaveScene } from './hydraScenes'
import type { HydraFactory, HydraInstance } from './hydraTypes'
import type { VisualizerRuntimeController, VisualizerRuntimeOptions } from './runtimeTypes'
import { circularDistance, clamp, normalize } from './runtimeUtils'

export function isHydraVisualizerPreset(preset: string): preset is HydraPreset {
  return HYDRA_PRESETS.has(preset as HydraPreset)
}

export class HydraVisualizerRuntime implements VisualizerRuntimeController {
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
  private contextLostHandler: ((event: Event) => void) | null = null

  constructor(preset: HydraPreset) {
    this.preset = preset
    this.options = {
      preset,
      intensity: 65,
      speed: 55,
      brightness: 70,
      colorScheme: 'acid',
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

    this.contextLostHandler = (event: Event) => {
      event.preventDefault()
      this.reportError(new Error('Hydra WebGL-Kontext verloren'))
    }
    canvas.addEventListener('webglcontextlost', this.contextLostHandler, { passive: false })

    try {
      const Hydra = await loadHydraFactory()
      if (this.isDisposed) {
        this.detachCanvasListeners()
        return
      }

      const profile = this.qualityProfile()
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
        precision: profile.precision,
      })

      this.hydra = hydra
      this.configureHydraScene()
      this.resize(cssWidth, cssHeight)
      this.lastFrameAt = performance.now()
      this.frameId = window.requestAnimationFrame(this.loop)
    } catch (error) {
      this.detachCanvasListeners()
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

    const profile = this.qualityProfile()
    const dpr = Math.min(window.devicePixelRatio || 1, profile.maxPixelRatio)
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
    const { cssWidth, cssHeight } = this.resolveSize()
    this.resize(cssWidth, cssHeight)
  }

  triggerEvent(name: string) {
    if (name !== 'mode_change') {
      return
    }
    this.burstLevel = Math.min(1.45, this.burstLevel + 0.9)
  }

  setErrorHandler(handler: ((error: Error) => void) | null) {
    this.errorHandler = handler
  }

  private loop = (timestamp: number) => {
    if (!this.hydra || this.isDisposed) {
      return
    }

    const profile = this.qualityProfile()
    const elapsedMs = timestamp - this.lastFrameAt
    if (elapsedMs < profile.targetFrameMs * 0.72) {
      this.frameId = window.requestAnimationFrame(this.loop)
      return
    }

    const deltaMs = clamp(elapsedMs, profile.targetFrameMs, 1000 / 18)
    this.lastFrameAt = timestamp
    this.sceneClock +=
      (deltaMs / 1000) *
      (0.34 + this.speedFactor() * 0.34 + this.sceneChangeFactor() * 0.24)
    this.burstLevel = Math.max(0, this.burstLevel * Math.exp(-deltaMs / 950))

    try {
      this.hydra.synth.speed = 0.28 + this.speedFactor() * 0.56 + this.sceneChangeFactor() * 0.12
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

    if (this.preset === 'hydra_chromaflow') {
      configureHydraChromaflowScene(this.hydra.synth, this.sceneState())
      return
    }

    configureHydraRaveScene(this.hydra.synth, this.sceneState())
  }

  private sceneState() {
    return {
      options: this.options,
      sceneClock: () => this.sceneClock,
      burstLevel: () => this.burstLevel,
      qualityProfile: this.qualityProfile(),
      phaseWeight: (center: number, width: number) => this.phaseWeight(center, width),
      intensityFactor: () => this.intensityFactor(),
      speedFactor: () => this.speedFactor(),
      brightnessFactor: () => this.brightnessFactor(),
      colorfulnessFactor: () => this.colorfulnessFactor(),
      symmetryFactor: () => this.symmetryFactor(),
      feedbackFactor: () => this.feedbackFactor(),
      sceneChangeFactor: () => this.sceneChangeFactor(),
      reactiveEnergy: () => this.reactiveEnergy(),
      accentCutLevel: () => this.accentCutLevel(),
    }
  }

  private resolveSize() {
    const cssWidth = Math.max(1, this.container?.clientWidth ?? window.innerWidth)
    const cssHeight = Math.max(1, this.container?.clientHeight ?? window.innerHeight)
    const dpr = Math.min(window.devicePixelRatio || 1, this.qualityProfile().maxPixelRatio)
    return {
      cssWidth,
      cssHeight,
      pixelWidth: Math.floor(cssWidth * dpr),
      pixelHeight: Math.floor(cssHeight * dpr),
    }
  }

  private qualityProfile() {
    return HYDRA_QUALITY_PROFILES[this.options.hydraQuality]
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

  private colorfulnessFactor() {
    return normalize(this.options.hydraColorfulness)
  }

  private symmetryFactor() {
    return normalize(this.options.hydraSymmetryAmount)
  }

  private sceneChangeFactor() {
    return normalize(this.options.hydraSceneChangeRate)
  }

  private feedbackFactor() {
    return clamp(
      normalize(this.options.hydraFeedbackAmount) * 0.9 + this.burstLevel * 0.16,
      0,
      1.2,
    )
  }

  private reactiveEnergy() {
    const pulse =
      0.5 +
      0.5 *
        Math.sin(
          this.sceneClock * (0.86 + this.sceneChangeFactor() * 0.46) +
            Math.sin(this.sceneClock * 0.21) * 0.7,
        )
    const smoothedPulse = Math.pow(pulse, 2.1)
    const gain = this.options.hydraAudioReactivityEnabled ? 1 : 0.58
    return clamp(0.08 + smoothedPulse * (0.22 + gain * 0.24) + this.burstLevel * (0.12 + gain * 0.18), 0, 1.3)
  }

  private accentCutLevel() {
    return clamp(
      this.phaseWeight(0.93, 0.065) * (0.18 + this.colorfulnessFactor() * 0.18 + this.reactiveEnergy() * 0.44),
      0,
      1,
    )
  }

  private phaseWeight(center: number, width: number) {
    const cycle = (this.sceneClock / this.sceneCycleDuration()) % 1
    const distance = circularDistance(cycle, center)
    if (distance >= width) {
      return 0
    }
    const normalized = distance / width
    return 0.5 + Math.cos(normalized * Math.PI) * 0.5
  }

  private sceneCycleDuration() {
    return 34 - this.sceneChangeFactor() * 18
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

    this.detachCanvasListeners()

    if (this.canvas) {
      this.canvas.remove()
      this.canvas = null
    }
  }

  private detachCanvasListeners() {
    if (this.canvas && this.contextLostHandler) {
      this.canvas.removeEventListener('webglcontextlost', this.contextLostHandler)
    }
    this.contextLostHandler = null
  }

  private reportError(error: Error) {
    console.error(`[visualizer:${this.preset}]`, error)
    this.errorHandler?.(error)
  }
}

async function loadHydraFactory(): Promise<HydraFactory> {
  const runtimeGlobal = globalThis as typeof globalThis & { global?: typeof globalThis }
  runtimeGlobal.global ??= runtimeGlobal
  const module = await import('hydra-synth')
  return module.default as HydraFactory
}
