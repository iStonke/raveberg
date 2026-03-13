import * as THREE from 'three'
import type {
  Container as TsParticlesContainer,
  Engine as TsParticlesEngine,
  ISourceOptions,
} from '@tsparticles/engine'

import type { ColorScheme, VisualizerPreset, VisualizerState } from '../../../services/api'
import { HydraVisualizerRuntime, isHydraVisualizerPreset } from './hydraRenderer'
import type { VisualizerRuntimeController, VisualizerRuntimeOptions } from './runtimeTypes'
import { clamp, normalize } from './runtimeUtils'

export type { VisualizerRuntimeController, VisualizerRuntimeOptions } from './runtimeTypes'

type VantaPreset = Extract<VisualizerPreset, 'nebel' | 'vanta_halo'>
type TsParticlesPreset = Extract<VisualizerPreset, 'particle_swarm'>
type VantaFactory = (options: Record<string, unknown>) => VantaEffect
type VantaEffect = {
  destroy?: () => void
  resize?: () => void
  setOptions?: (options: Record<string, unknown>) => void
}

const EXTERNAL_PRESETS = new Set<VisualizerPreset>([
  'nebel',
  'vanta_halo',
  'hydra_rave',
  'hydra_chromaflow',
  'particle_swarm',
])

const PALETTES: Record<
  ColorScheme,
  {
    nebelBase: number
    nebelLow: number
    nebelMid: number
    nebelHighlight: number
    haloBase: number
    haloAccent: number
    background: number
  }
> = {
  mono: {
    nebelBase: 0x091018,
    nebelLow: 0x122634,
    nebelMid: 0x1d4250,
    nebelHighlight: 0x4d8192,
    haloBase: 0x2e4358,
    haloAccent: 0xa6bbcf,
    background: 0x04090f,
  },
  acid: {
    nebelBase: 0x05121a,
    nebelLow: 0x0d2b36,
    nebelMid: 0x13605c,
    nebelHighlight: 0x54a7a0,
    haloBase: 0x174d8a,
    haloAccent: 0x89dfff,
    background: 0x030811,
  },
  ultraviolet: {
    nebelBase: 0x070f19,
    nebelLow: 0x16253b,
    nebelMid: 0x28495d,
    nebelHighlight: 0x6870ad,
    haloBase: 0x574ea5,
    haloAccent: 0x8ac7ff,
    background: 0x050711,
  },
  redline: {
    nebelBase: 0x0b1017,
    nebelLow: 0x182735,
    nebelMid: 0x25484f,
    nebelHighlight: 0x73584f,
    haloBase: 0x7d263c,
    haloAccent: 0xf08a92,
    background: 0x090507,
  },
}

interface NebelPalette {
  background: number
  deepBlue: number
  petrol: number
  darkTurquoise: number
  violet: number
  cyan: number
  ember: number
}

interface NebelMotionState {
  timeSeconds: number
  breathScale: number
  brightnessPulse: number
  brightnessBoost: number
  turbulence: number
  rotationDeg: number
  driftX: number
  driftY: number
  palette: NebelPalette
}

const NEBEL_PALETTE_SETS: Record<ColorScheme, NebelPalette[]> = {
  mono: [
    {
      background: 0x04090f,
      deepBlue: 0x0a1622,
      petrol: 0x12333f,
      darkTurquoise: 0x1d5663,
      violet: 0x3d3a70,
      cyan: 0x4c8aa1,
      ember: 0x4a3225,
    },
    {
      background: 0x030a10,
      deepBlue: 0x08141f,
      petrol: 0x15303a,
      darkTurquoise: 0x275763,
      violet: 0x50427d,
      cyan: 0x5aa6b4,
      ember: 0x5a3d29,
    },
  ],
  acid: [
    {
      background: 0x030910,
      deepBlue: 0x071a24,
      petrol: 0x0c3640,
      darkTurquoise: 0x147370,
      violet: 0x534487,
      cyan: 0x57d4d7,
      ember: 0x5a331f,
    },
    {
      background: 0x040911,
      deepBlue: 0x091824,
      petrol: 0x0d3946,
      darkTurquoise: 0x1b666c,
      violet: 0x4e4280,
      cyan: 0x67dde3,
      ember: 0x633a20,
    },
  ],
  ultraviolet: [
    {
      background: 0x040811,
      deepBlue: 0x09151f,
      petrol: 0x17313e,
      darkTurquoise: 0x1b5560,
      violet: 0x6d54a8,
      cyan: 0x4ab0cf,
      ember: 0x553122,
    },
    {
      background: 0x050912,
      deepBlue: 0x0a1823,
      petrol: 0x173746,
      darkTurquoise: 0x1d5d70,
      violet: 0x7e62bf,
      cyan: 0x60cbe8,
      ember: 0x613721,
    },
  ],
  redline: [
    {
      background: 0x05080f,
      deepBlue: 0x0b151d,
      petrol: 0x17303a,
      darkTurquoise: 0x215660,
      violet: 0x5c4b87,
      cyan: 0x4f9caf,
      ember: 0x704128,
    },
    {
      background: 0x050810,
      deepBlue: 0x0c161f,
      petrol: 0x173643,
      darkTurquoise: 0x245c6a,
      violet: 0x665091,
      cyan: 0x58bdd1,
      ember: 0x7e492a,
    },
  ],
}

export function isExternalVisualizerPreset(preset: VisualizerPreset) {
  return EXTERNAL_PRESETS.has(preset)
}

export function createVisualizerRuntime(
  visualizer: VisualizerState,
): VisualizerRuntimeController | null {
  if (visualizer.active_preset === 'nebel' || visualizer.active_preset === 'vanta_halo') {
    return new VantaVisualizerRuntime(visualizer.active_preset)
  }
  if (isHydraVisualizerPreset(visualizer.active_preset)) {
    return new HydraVisualizerRuntime(visualizer.active_preset)
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
  private animationFrameId = 0
  private effectStartedAt = 0
  private lastAnimationAt = 0
  private lastNebulaUpdateAt = 0
  private pulseBoost = 0
  private readonly overlayLayers: HTMLDivElement[] = []
  private vignetteLayer: HTMLDivElement | null = null
  private errorHandler: ((error: Error) => void) | null = null

  constructor(preset: VantaPreset) {
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
    if (this.preset === 'nebel') {
      this.effectStartedAt = performance.now()
      this.lastAnimationAt = this.effectStartedAt
      this.lastNebulaUpdateAt = 0
      this.setupNebelLayers()
      this.animationFrameId = window.requestAnimationFrame(this.animateNebel)
    }
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
    if (this.preset === 'nebel') {
      this.updateNebelLayerPalette(resolveNebelMotionState(this.options, performance.now(), this.effectStartedAt))
    }
  }

  triggerEvent(name: string) {
    if (name !== 'mode_change') {
      return
    }

    if (this.preset === 'nebel') {
      this.pulseBoost = Math.min(1, this.pulseBoost + 0.72)
      return
    }

    if (!this.effect?.setOptions) {
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
    window.cancelAnimationFrame(this.animationFrameId)
    this.animationFrameId = 0
    this.clearNebelLayers()
    try {
      this.effect?.destroy?.()
    } finally {
      if (this.container) {
        this.container.querySelectorAll('.vanta-canvas').forEach((node) => node.remove())
        this.container.style.removeProperty('background')
        this.container.style.removeProperty('filter')
      }
    }
    this.effect = null
  }

  private clearBursts() {
    this.burstTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
    this.burstTimeouts.clear()
  }

  private animateNebel = (timestamp: number) => {
    if (this.preset !== 'nebel' || !this.container || !this.effect) {
      return
    }

    const deltaMs = clamp(timestamp - this.lastAnimationAt, 1000 / 120, 1000 / 20)
    this.lastAnimationAt = timestamp
    this.pulseBoost = Math.max(0, this.pulseBoost * Math.exp(-deltaMs / 2400))

    const state = resolveNebelMotionState(this.options, timestamp, this.effectStartedAt, this.pulseBoost)
    const canvas = this.container.querySelector('.vanta-canvas') as HTMLElement | null
    if (canvas) {
      canvas.style.transform = `translate3d(${state.driftX.toFixed(2)}px, ${state.driftY.toFixed(2)}px, 0) rotate(${state.rotationDeg.toFixed(3)}deg) scale(${state.breathScale.toFixed(4)})`
      canvas.style.transformOrigin = '50% 50%'
      canvas.style.opacity = `${(0.9 + state.brightnessBoost * 0.06).toFixed(3)}`
      canvas.style.willChange = 'transform, opacity'
    }

    if (timestamp - this.lastNebulaUpdateAt >= 140) {
      this.effect.setOptions?.(resolveVantaOptions(this.preset, this.options, state))
      this.updateNebelLayerPalette(state)
      this.lastNebulaUpdateAt = timestamp
    }

    this.updateNebelLayerTransforms(state)
    this.container.style.background = `linear-gradient(180deg, ${intToRgba(state.palette.background, 0.96)}, rgba(2, 5, 10, 1))`
    this.container.style.filter = `brightness(${(0.98 + state.brightnessBoost * 0.08).toFixed(3)})`
    this.animationFrameId = window.requestAnimationFrame(this.animateNebel)
  }

  private setupNebelLayers() {
    if (!this.container || this.overlayLayers.length) {
      return
    }

    for (let index = 0; index < 3; index += 1) {
      const layer = document.createElement('div')
      layer.className = `nebel-depth-layer nebel-depth-layer--${index + 1}`
      Object.assign(layer.style, {
        position: 'absolute',
        inset: '-16%',
        pointerEvents: 'none',
        opacity: index === 0 ? '0.22' : index === 1 ? '0.18' : '0.14',
        mixBlendMode: index === 2 ? 'screen' : 'soft-light',
        backgroundRepeat: 'no-repeat',
        willChange: 'transform, opacity, background',
      })
      this.container.appendChild(layer)
      this.overlayLayers.push(layer)
    }

    const vignette = document.createElement('div')
    vignette.className = 'nebel-vignette'
    Object.assign(vignette.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      background:
        'radial-gradient(circle at 50% 48%, rgba(0,0,0,0) 42%, rgba(2,4,8,0.14) 70%, rgba(0,0,0,0.34) 100%)',
      willChange: 'opacity',
    })
    this.container.appendChild(vignette)
    this.vignetteLayer = vignette
    this.updateNebelLayerPalette(resolveNebelMotionState(this.options, performance.now(), this.effectStartedAt))
  }

  private updateNebelLayerPalette(state: NebelMotionState) {
    if (!this.overlayLayers.length) {
      return
    }

    const [backgroundLayer, midLayer, foregroundLayer] = this.overlayLayers
    backgroundLayer.style.background = [
      `radial-gradient(circle at 24% 30%, ${intToRgba(state.palette.deepBlue, 0.24 + state.brightnessPulse * 0.03)}, rgba(0,0,0,0) 56%)`,
      `radial-gradient(circle at 72% 62%, ${intToRgba(state.palette.petrol, 0.18 + state.turbulence * 0.04)}, rgba(0,0,0,0) 60%)`,
      `radial-gradient(circle at 46% 44%, ${intToRgba(state.palette.darkTurquoise, 0.14)}, rgba(0,0,0,0) 68%)`,
    ].join(',')
    midLayer.style.background = [
      `radial-gradient(circle at 34% 52%, ${intToRgba(state.palette.petrol, 0.18 + state.brightnessPulse * 0.04)}, rgba(0,0,0,0) 34%)`,
      `radial-gradient(circle at 68% 38%, ${intToRgba(state.palette.violet, 0.09)}, rgba(0,0,0,0) 28%)`,
      `radial-gradient(circle at 58% 66%, ${intToRgba(state.palette.cyan, 0.1)}, rgba(0,0,0,0) 26%)`,
    ].join(',')
    foregroundLayer.style.background = [
      `radial-gradient(circle at 42% 42%, ${intToRgba(state.palette.cyan, 0.1 + state.brightnessPulse * 0.05)}, rgba(0,0,0,0) 18%)`,
      `radial-gradient(circle at 60% 52%, ${intToRgba(state.palette.darkTurquoise, 0.12)}, rgba(0,0,0,0) 16%)`,
      `radial-gradient(circle at 54% 48%, ${intToRgba(state.palette.ember, 0.055)}, rgba(0,0,0,0) 14%)`,
    ].join(',')
    if (this.vignetteLayer) {
      this.vignetteLayer.style.opacity = `${(0.92 + state.turbulence * 0.05).toFixed(3)}`
    }
  }

  private updateNebelLayerTransforms(state: NebelMotionState) {
    if (this.overlayLayers.length < 3) {
      return
    }

    const t = state.timeSeconds
    this.overlayLayers[0].style.transform = `translate3d(${(Math.sin(t * 0.045) * 18).toFixed(2)}px, ${(Math.cos(t * 0.034) * 14).toFixed(2)}px, 0) scale(${(1.04 + Math.sin(t * 0.022) * 0.03).toFixed(4)})`
    this.overlayLayers[1].style.transform = `translate3d(${(Math.cos(t * 0.074) * 26).toFixed(2)}px, ${(Math.sin(t * 0.062) * 18).toFixed(2)}px, 0) scale(${(1.08 + Math.cos(t * 0.038) * 0.04).toFixed(4)})`
    this.overlayLayers[2].style.transform = `translate3d(${(Math.sin(t * 0.11) * 34).toFixed(2)}px, ${(Math.cos(t * 0.095) * 24).toFixed(2)}px, 0) scale(${(1.12 + Math.sin(t * 0.058) * 0.05).toFixed(4)})`
    this.overlayLayers[0].style.opacity = `${(0.18 + state.brightnessPulse * 0.05).toFixed(3)}`
    this.overlayLayers[1].style.opacity = `${(0.15 + state.turbulence * 0.04).toFixed(3)}`
    this.overlayLayers[2].style.opacity = `${(0.11 + state.brightnessPulse * 0.08).toFixed(3)}`
  }

  private clearNebelLayers() {
    this.overlayLayers.forEach((layer) => layer.remove())
    this.overlayLayers.length = 0
    this.vignetteLayer?.remove()
    this.vignetteLayer = null
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
  nebelState?: NebelMotionState,
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

  const state =
    nebelState ??
    resolveNebelMotionState(options, performance.now(), performance.now())

  return {
    baseColor: state.palette.deepBlue,
    lowlightColor: state.palette.petrol,
    midtoneColor: state.palette.darkTurquoise,
    highlightColor: lerpColorInt(state.palette.cyan, state.palette.violet, 0.22 + state.brightnessPulse * 0.12),
    blurFactor: 0.44 - intensity * 0.08 + state.turbulence * 0.04,
    speed: 0.2 + speed * 0.44 + state.turbulence * 0.08,
    zoom: 0.68 + intensity * 0.12 + (state.breathScale - 1) * 0.42,
    scale: 2.3 - brightness * 0.24,
    scaleMobile: 2.85 - brightness * 0.3,
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
    blurFactor: 0.36 - intensity * 0.08,
    speed: 0.3 + speed * 0.58,
    zoom: 0.72 + intensity * 0.12 + brightness * 0.03,
  }
}

function resolveNebelMotionState(
  options: VisualizerRuntimeOptions,
  timestamp: number,
  startedAt: number,
  pulseBoost = 0,
): NebelMotionState {
  const timeSeconds = Math.max(0, (timestamp - startedAt) / 1000)
  const speed = normalize(options.speed)
  const intensity = normalize(options.intensity)
  const brightness = normalize(options.brightness)
  const breathScale = 1 + Math.sin(timeSeconds * 0.05) * 0.05
  const brightnessPulse =
    Math.pow(Math.max(0, Math.sin(timeSeconds * ((Math.PI * 2) / 7.8) + 0.9)), 4.5) * 0.85
  const brightnessBoost = clamp(brightnessPulse + pulseBoost * 0.65, 0, 1)
  const turbulence = 0.18 + Math.sin(timeSeconds * 0.18) * 0.07 + intensity * 0.14
  const rotationDeg = Math.sin(timeSeconds * 0.07) * (0.8 + speed * 0.8)
  const driftX = Math.cos(timeSeconds * 0.11) * (6 + speed * 10)
  const driftY = Math.sin(timeSeconds * 0.09) * (4 + speed * 8)

  return {
    timeSeconds,
    breathScale,
    brightnessPulse,
    brightnessBoost,
    turbulence,
    rotationDeg,
    driftX,
    driftY,
    palette: resolveNebelPalette(options.colorScheme, timeSeconds, brightness),
  }
}

function resolveNebelPalette(colorScheme: ColorScheme, timeSeconds: number, brightness: number): NebelPalette {
  const sequence = NEBEL_PALETTE_SETS[colorScheme]
  const phase = timeSeconds * 0.032
  const index = Math.floor(phase) % sequence.length
  const nextIndex = (index + 1) % sequence.length
  const mix = smoothMix(phase - Math.floor(phase))
  const from = sequence[index]
  const to = sequence[nextIndex]

  return {
    background: lerpColorInt(from.background, to.background, mix),
    deepBlue: lerpColorInt(from.deepBlue, to.deepBlue, mix),
    petrol: lerpColorInt(from.petrol, to.petrol, mix),
    darkTurquoise: lerpColorInt(from.darkTurquoise, to.darkTurquoise, mix),
    violet: lerpColorInt(from.violet, to.violet, mix),
    cyan: lerpColorInt(from.cyan, to.cyan, mix + brightness * 0.04),
    ember: lerpColorInt(from.ember, to.ember, mix),
  }
}

function lerpColorInt(from: number, to: number, amount: number) {
  const t = clamp(amount, 0, 1)
  const fr = (from >> 16) & 0xff
  const fg = (from >> 8) & 0xff
  const fb = from & 0xff
  const tr = (to >> 16) & 0xff
  const tg = (to >> 8) & 0xff
  const tb = to & 0xff
  const r = Math.round(fr + (tr - fr) * t)
  const g = Math.round(fg + (tg - fg) * t)
  const b = Math.round(fb + (tb - fb) * t)
  return (r << 16) | (g << 8) | b
}

function intToRgba(color: number, alpha: number) {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1).toFixed(3)})`
}

function smoothMix(value: number) {
  const t = clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
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
