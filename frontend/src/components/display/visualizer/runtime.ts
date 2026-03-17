import * as THREE from 'three'

import type { ColorScheme, VisualizerPreset, VisualizerState } from '../../../services/api'
import { CubeVisualizerRuntime, isCubeVisualizerPreset } from './cubeRuntime'
import { DvdBounceRuntime, isDvdBouncePreset } from './dvdBounceRuntime'
import { HydraVisualizerRuntime, isHydraVisualizerPreset } from './hydraRenderer'
import { isMatrixScreenPreset, MatrixScreenRuntime } from './matrixScreenRuntime'
import { PipesVisualizerRuntime, isPipesVisualizerPreset } from './pipesRuntime'
import { isStormLightningPreset, StormLightningRuntime } from './stormLightningRuntime'
import type { VisualizerRuntimeController, VisualizerRuntimeOptions } from './runtimeTypes'
import { clamp, normalize } from './runtimeUtils'

export type { VisualizerRuntimeController, VisualizerRuntimeOptions } from './runtimeTypes'

type VantaPreset = Extract<VisualizerPreset, 'nebel' | 'vanta_halo'>
type VantaFactory = (options: Record<string, unknown>) => VantaEffect
type VantaEffect = {
  destroy?: () => void
  resize?: () => void
  setOptions?: (options: Record<string, unknown>) => void
}

const EXTERNAL_PRESETS = new Set<VisualizerPreset>([
  'storm_lightning',
  'retro_cube',
  'retro_pipes',
  'dvd_bounce',
  'matrix_screen',
  'nebel',
  'vanta_halo',
  'hydra_rave',
  'hydra_chromaflow',
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
  if (isStormLightningPreset(visualizer.active_preset)) {
    return new StormLightningRuntime(visualizer.active_preset)
  }
  if (isCubeVisualizerPreset(visualizer.active_preset)) {
    return new CubeVisualizerRuntime(visualizer.active_preset)
  }
  if (isDvdBouncePreset(visualizer.active_preset)) {
    return new DvdBounceRuntime(visualizer.active_preset)
  }
  if (isMatrixScreenPreset(visualizer.active_preset)) {
    return new MatrixScreenRuntime(visualizer.active_preset)
  }
  if (isPipesVisualizerPreset(visualizer.active_preset)) {
    return new PipesVisualizerRuntime(visualizer.active_preset)
  }
  if (visualizer.active_preset === 'nebel' || visualizer.active_preset === 'vanta_halo') {
    return new VantaVisualizerRuntime(visualizer.active_preset)
  }
  if (isHydraVisualizerPreset(visualizer.active_preset)) {
    return new HydraVisualizerRuntime(visualizer.active_preset)
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
      canvas.style.position = 'absolute'
      canvas.style.left = '0'
      canvas.style.top = '0'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.style.maxWidth = '100%'
      canvas.style.maxHeight = '100%'
      canvas.style.transform = 'none'
      canvas.style.opacity = `${(0.9 + state.brightnessBoost * 0.06).toFixed(3)}`
      canvas.style.willChange = 'opacity'
    }

    if (timestamp - this.lastNebulaUpdateAt >= 90) {
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
        inset: '-26%',
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
    this.overlayLayers[0].style.transform =
      `translate3d(${(Math.sin(t * 0.11) * 48 + Math.cos(t * 0.052) * 18).toFixed(2)}px, ${(Math.cos(t * 0.086) * 34 + Math.sin(t * 0.044) * 16).toFixed(2)}px, 0) rotate(${(Math.sin(t * 0.052) * 1.8 + Math.cos(t * 0.021) * 0.6).toFixed(3)}deg) scale(${(1.12 + Math.sin(t * 0.061) * 0.08 + Math.cos(t * 0.024) * 0.04 + state.turbulence * 0.05).toFixed(4)})`
    this.overlayLayers[1].style.transform =
      `translate3d(${(Math.cos(t * 0.18) * 68 + Math.sin(t * 0.082) * 26).toFixed(2)}px, ${(Math.sin(t * 0.142) * 42 + Math.cos(t * 0.067) * 20).toFixed(2)}px, 0) rotate(${(Math.cos(t * 0.078) * 2.4 + Math.sin(t * 0.031) * 0.9).toFixed(3)}deg) scale(${(1.2 + Math.cos(t * 0.11) * 0.11 + Math.sin(t * 0.047) * 0.05 + state.brightnessPulse * 0.04).toFixed(4)})`
    this.overlayLayers[2].style.transform =
      `translate3d(${(Math.sin(t * 0.26) * 92 + Math.cos(t * 0.11) * 28).toFixed(2)}px, ${(Math.cos(t * 0.214) * 58 + Math.sin(t * 0.094) * 22).toFixed(2)}px, 0) rotate(${(Math.sin(t * 0.11) * 3.1 + Math.cos(t * 0.038) * 1.1).toFixed(3)}deg) scale(${(1.3 + Math.sin(t * 0.16) * 0.14 + Math.cos(t * 0.058) * 0.06 + state.turbulence * 0.07).toFixed(4)})`
    this.overlayLayers[0].style.opacity = `${(0.28 + state.brightnessPulse * 0.1 + state.turbulence * 0.05).toFixed(3)}`
    this.overlayLayers[1].style.opacity = `${(0.24 + state.turbulence * 0.1).toFixed(3)}`
    this.overlayLayers[2].style.opacity = `${(0.2 + state.brightnessPulse * 0.16 + state.turbulence * 0.05).toFixed(3)}`
  }

  private clearNebelLayers() {
    this.overlayLayers.forEach((layer) => layer.remove())
    this.overlayLayers.length = 0
    this.vignetteLayer?.remove()
    this.vignetteLayer = null
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
    blurFactor: 0.34 - intensity * 0.04 + state.turbulence * 0.12,
    speed: 0.42 + speed * 0.92 + state.turbulence * 0.28,
    zoom: 0.82 + intensity * 0.24 + (state.breathScale - 1) * 1.25,
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
    blurFactor: 0.24 - intensity * 0.04,
    speed: 0.56 + speed * 1.04,
    zoom: 0.9 + intensity * 0.24 + brightness * 0.06,
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
  const breathScale =
    1
    + Math.sin(timeSeconds * 0.12) * 0.08
    + Math.cos(timeSeconds * 0.047 + 1.2) * 0.04
  const brightnessPulse =
    Math.pow(Math.max(0, Math.sin(timeSeconds * ((Math.PI * 2) / 7.8) + 0.9)), 4.5) * 0.85
  const brightnessBoost = clamp(brightnessPulse + pulseBoost * 0.65, 0, 1)
  const turbulence =
    0.34
    + Math.sin(timeSeconds * 0.46) * 0.14
    + Math.cos(timeSeconds * 0.18 + 0.7) * 0.07
    + Math.sin(timeSeconds * 0.09 + 1.8) * 0.05
    + intensity * 0.22
  const rotationDeg =
    Math.sin(timeSeconds * 0.14) * (1.4 + speed * 1.4)
    + Math.cos(timeSeconds * 0.06) * 0.8
  const driftX =
    Math.cos(timeSeconds * 0.24) * (14 + speed * 24)
    + Math.sin(timeSeconds * 0.1 + 0.8) * (8 + speed * 12)
  const driftY =
    Math.sin(timeSeconds * 0.19) * (10 + speed * 18)
    + Math.cos(timeSeconds * 0.08 + 1.1) * (4 + speed * 8)

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
