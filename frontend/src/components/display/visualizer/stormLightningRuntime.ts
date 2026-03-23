import * as THREE from 'three'

import type { ColorScheme, VisualizerPreset } from '../../../services/api'
import {
  createStormFogUniforms,
  MAX_STORM_FOG_ISLANDS,
  STORM_FOG_FRAGMENT_SHADER,
  STORM_FOG_VERTEX_SHADER,
} from './stormFogShader'
import type { VisualizerRuntimeController, VisualizerRuntimeOptions } from './runtimeTypes'
import { clamp, lerp, normalize, smoothstep } from './runtimeUtils'

// Inspired by yomboprime/lightning_strike_demo (MIT) and adapted to the
// existing RaveBerg visualizer runtime/lifecycle instead of embedding the demo.

export type StormLightningPreset = Extract<VisualizerPreset, 'storm_lightning'>

const STORM_LIGHTNING_PRESETS = new Set<StormLightningPreset>(['storm_lightning'])
const UP_AXIS = new THREE.Vector3(0, 1, 0)
const FOG_PLANE_DISTANCE = 92
const FOG_PLANE_OVERSCAN = 1.08

interface StormPalette {
  variant: 'classic_storm' | 'cold_storm' | 'deep_thunder'
  background: number
  fog: number
  cloudLow: string
  cloudMid: string
  cloudHigh: string
  flash: string
  core: number
  rim: number
  glow: number
}

interface StrikeBolt {
  coreMesh: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>
  rimMesh: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>
  haloMesh: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial> | null
  drawCount: number
  branchLevel: number
  sourceProgress: number
  baseIntensity: number
  coreGain: number
  rimGain: number
  leaderBias: number
  flickerBias: number
  haloBias: number
  activationOffset: number
  decayBias: number
  tipFalloff: number
  flashScale: number
  afterglowScale: number
  isBranch: boolean
}

interface BranchPath {
  points: THREE.Vector3[]
  sourceProgress: number
}

interface ActiveStrike {
  group: THREE.Group
  bolts: StrikeBolt[]
  flashLight: THREE.PointLight
  originCore: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  originHalo: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  startAt: number
  leaderDuration: number
  mainFlashDuration: number
  afterglowDuration: number
  fadeOutDuration: number
  subFlashes: number[]
  flashPeak: number
  secondary: boolean
}

interface StrikePhase {
  leader: number
  main: number
  flicker: number
  afterglow: number
  sceneFlash: number
}

interface StrikeProfile {
  activationCurve: number
  brokenness: number
  branchRichness: number
  branchSourceBias: number
  branchSpread: number
  gravityBias: number
  trunkPull: number
}

interface StrikePlacement {
  xCenter: number
  zCenter: number
  horizontalSpread: number
  depthSpread: number
  topYMin: number
  topYMax: number
  bottomYMin: number
  bottomYMax: number
}

interface FogCluster {
  el: HTMLDivElement
  layer: 'foreground' | 'background'
  x: number
  y: number
  width: number
  height: number
  scale: number
  opacity: number
  driftX: number
  driftY: number
  speedX: number
  speedY: number
  pulsePhase: number
  pulseSpeed: number
  noiseDriftX: number
  noiseDriftY: number
  hueMix: number
  rotation: number
  rotationSpeed: number
}

interface RainDrop {
  x: number
  y: number
  length: number
  speed: number
  alpha: number
  drift: number
  depth: number
}

type StormFogUniformMap = ReturnType<typeof createStormFogUniforms>

const STORM_PALETTES: Record<ColorScheme, StormPalette> = {
  mono: {
    variant: 'classic_storm',
    background: 0x030508,
    fog: 0x0b1018,
    cloudLow: 'rgba(30, 42, 58, 0.20)',
    cloudMid: 'rgba(14, 22, 33, 0.18)',
    cloudHigh: 'rgba(154, 178, 205, 0.08)',
    flash: 'rgba(234, 242, 255, 0.28)',
    core: 0xfdfeff,
    rim: 0xe4f2ff,
    glow: 0x82addb,
  },
  acid: {
    variant: 'cold_storm',
    background: 0x020507,
    fog: 0x071018,
    cloudLow: 'rgba(20, 35, 41, 0.22)',
    cloudMid: 'rgba(10, 20, 28, 0.18)',
    cloudHigh: 'rgba(151, 204, 224, 0.08)',
    flash: 'rgba(228, 244, 255, 0.27)',
    core: 0xfeffff,
    rim: 0xe3f8ff,
    glow: 0x7db7dc,
  },
  ultraviolet: {
    variant: 'deep_thunder',
    background: 0x02050a,
    fog: 0x09111d,
    cloudLow: 'rgba(19, 29, 47, 0.24)',
    cloudMid: 'rgba(12, 21, 34, 0.19)',
    cloudHigh: 'rgba(144, 168, 206, 0.09)',
    flash: 'rgba(234, 240, 255, 0.24)',
    core: 0xfbfdff,
    rim: 0xeaf1ff,
    glow: 0x8aa8d7,
  },
  redline: {
    variant: 'classic_storm',
    background: 0x030406,
    fog: 0x0d0f14,
    cloudLow: 'rgba(39, 34, 32, 0.18)',
    cloudMid: 'rgba(18, 19, 26, 0.18)',
    cloudHigh: 'rgba(173, 181, 198, 0.08)',
    flash: 'rgba(240, 242, 248, 0.23)',
    core: 0xfffeff,
    rim: 0xe9f1ff,
    glow: 0x8ca6c8,
  },
}

export function isStormLightningPreset(preset: string): preset is StormLightningPreset {
  return STORM_LIGHTNING_PRESETS.has(preset as StormLightningPreset)
}

export class StormLightningRuntime implements VisualizerRuntimeController {
  private container: HTMLElement | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private fogMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null
  private fogUniforms: StormFogUniformMap | null = null
  private stormGroup: THREE.Group | null = null
  private ambientLight: THREE.AmbientLight | null = null
  private animationFrameId = 0
  private readonly clock = new THREE.Clock()
  private options: VisualizerRuntimeOptions
  private errorHandler: ((error: Error) => void) | null = null
  private activeStrikes: ActiveStrike[] = []
  private nextStrikeIn = 1.8
  private elapsedSeconds = 0
  private eventBoost = 0
  private burstStrikesRemaining = 0
  private currentSceneFlash = 0
  private cloudLayer: HTMLDivElement | null = null
  private islandLayer: HTMLDivElement | null = null
  private rainCanvas: HTMLCanvasElement | null = null
  private rainContext: CanvasRenderingContext2D | null = null
  private flashLayer: HTMLDivElement | null = null
  private fogClusters: FogCluster[] = []
  private fogTextureUrl: string | null = null
  private rainDrops: RainDrop[] = []
  private readonly fogIslands = Array.from({ length: MAX_STORM_FOG_ISLANDS }, () => new THREE.Vector4())
  private readonly dominantFlashUv = new THREE.Vector3(0.5, 0.56, 0)

  constructor(preset: StormLightningPreset) {
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
    this.setupScene()
    this.applyPalette()
    this.scheduleNextStrike(true)
    this.start()
  }

  start() {
    if (!this.renderer || this.animationFrameId) {
      return
    }
    this.clock.start()
    this.animationFrameId = window.requestAnimationFrame(this.animate)
  }

  stop() {
    window.cancelAnimationFrame(this.animationFrameId)
    this.animationFrameId = 0
    this.clock.stop()
  }

  destroy() {
    this.stop()
    this.disposeStrike()
    this.disposeScene()
    this.disposeRenderer()
    this.container = null
  }

  resize(width: number, height: number) {
    if (!this.renderer || !this.camera) {
      return
    }
    const safeWidth = Math.max(1, width)
    const safeHeight = Math.max(1, height)
    this.renderer.setSize(safeWidth, safeHeight, false)
    this.camera.aspect = safeWidth / safeHeight
    this.camera.updateProjectionMatrix()
    this.updateFogPlaneScale()
    this.resizeRainCanvas()
  }

  updateOptions(partialOptions: Partial<VisualizerRuntimeOptions>) {
    this.options = { ...this.options, ...partialOptions }
    this.applyPalette()
  }

  triggerEvent(name: string) {
    if (name === 'mode_change' || name === 'upload_created') {
      this.eventBoost = Math.min(1.4, this.eventBoost + 0.85)
      this.burstStrikesRemaining = Math.max(this.burstStrikesRemaining, 1 + Math.floor(Math.random() * 2))
      this.nextStrikeIn = Math.min(this.nextStrikeIn, 0.18)
    }
  }

  setErrorHandler(handler: ((error: Error) => void) | null) {
    this.errorHandler = handler
  }

  private setupScene() {
    if (!this.container || this.renderer) {
      return
    }

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(
      48,
      Math.max(1, this.container.clientWidth) / Math.max(1, this.container.clientHeight),
      0.1,
      300,
    )
    this.camera.position.set(0, 0.4, 24)
    this.camera.lookAt(0, 0, 0)

    this.fogUniforms = createStormFogUniforms()
    const fogGeometry = new THREE.PlaneGeometry(1, 1, 1, 1)
    const fogMaterial = new THREE.ShaderMaterial({
      uniforms: this.fogUniforms,
      vertexShader: STORM_FOG_VERTEX_SHADER,
      fragmentShader: STORM_FOG_FRAGMENT_SHADER,
      depthWrite: false,
      depthTest: false,
      fog: false,
      transparent: false,
    })
    this.fogMesh = new THREE.Mesh(fogGeometry, fogMaterial)
    this.fogMesh.position.set(0, 0.2, -58)
    this.fogMesh.renderOrder = -20
    this.scene.add(this.fogMesh)

    this.stormGroup = new THREE.Group()
    this.scene.add(this.stormGroup)

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.035)
    this.scene.add(this.ambientLight)

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35))
    this.renderer.setSize(
      Math.max(1, this.container.clientWidth),
      Math.max(1, this.container.clientHeight),
      false,
    )
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.pointerEvents = 'none'
    this.container.replaceChildren(this.renderer.domElement)
    this.seedFogIslands()
    this.updateFogPlaneScale()
    this.setupOverlays()
  }

  private setupOverlays() {
    if (!this.container) {
      return
    }

    if (!this.rainCanvas) {
      const rainCanvas = document.createElement('canvas')
      Object.assign(rainCanvas.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: '0.32',
        mixBlendMode: 'screen',
      })
      this.container.appendChild(rainCanvas)
      this.rainCanvas = rainCanvas
      this.rainContext = rainCanvas.getContext('2d')
      this.resizeRainCanvas()
      this.seedRainDrops()
    }

    if (!this.flashLayer) {
      const flashLayer = document.createElement('div')
      Object.assign(flashLayer.style, {
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        opacity: '0',
        willChange: 'opacity, background',
      })
      this.container.appendChild(flashLayer)
      this.flashLayer = flashLayer
    }

  }

  private applyPalette() {
    if (!this.scene || !this.renderer || !this.ambientLight) {
      return
    }
    const palette = this.palette
    const brightness = normalize(this.options.brightness)
    this.scene.background = new THREE.Color(palette.background)
    this.scene.fog = null
    this.renderer.setClearColor(palette.background, 1)
    this.ambientLight.intensity = 0.028 + brightness * 0.042
    this.updateFogPalette()
    if (this.flashLayer) {
      this.flashLayer.style.background = [
        `radial-gradient(ellipse at 14% 22%, ${palette.flash} 0%, rgba(255,255,255,0) 28%)`,
        `radial-gradient(ellipse at 82% 29%, rgba(226,238,255,0.16) 0%, rgba(255,255,255,0) 24%)`,
        `radial-gradient(ellipse at 68% 82%, rgba(214,228,248,0.12) 0%, rgba(255,255,255,0) 26%)`,
        `radial-gradient(ellipse at 24% 74%, rgba(210,224,244,0.10) 0%, rgba(255,255,255,0) 24%)`,
        `linear-gradient(180deg, rgba(228,236,248,0.10), rgba(255,255,255,0))`,
      ].join(',')
    }
  }

  private readonly animate = () => {
    if (!this.renderer || !this.scene || !this.camera) {
      return
    }

    try {
      this.animationFrameId = window.requestAnimationFrame(this.animate)
      const deltaSeconds = clamp(this.clock.getDelta(), 1 / 144, 1 / 18)
      this.elapsedSeconds += deltaSeconds
      this.eventBoost = Math.max(0, this.eventBoost * Math.exp(-deltaSeconds * 1.25))

      this.nextStrikeIn -= deltaSeconds
      if (this.nextStrikeIn <= 0) {
        this.createStrikeCluster()
        this.scheduleNextStrike(false)
      }

      this.updateStrikes()
      this.updateFogLayer()
      this.updateRain(deltaSeconds)
      this.renderer.render(this.scene, this.camera)
    } catch (error) {
      this.stop()
      const runtimeError = error instanceof Error ? error : new Error('Storm lightning runtime failed')
      this.errorHandler?.(runtimeError)
    }
  }

  private updateStrikes() {
    if (!this.flashLayer || !this.ambientLight) {
      return
    }

    if (!this.activeStrikes.length) {
      this.currentSceneFlash = 0
      this.flashLayer.style.opacity = '0'
      this.ambientLight.intensity = 0.028 + normalize(this.options.brightness) * 0.042
      return
    }

    let flashSum = 0
    let flashMax = 0
    let dominantFlash = 0

    for (let index = this.activeStrikes.length - 1; index >= 0; index -= 1) {
      const strike = this.activeStrikes[index]
      const time = this.elapsedSeconds - strike.startAt
      if (time < 0) {
        strike.flashLight.intensity = 0
        continue
      }

      const phase = this.computeStrikePhase(strike, time)
      const fadeStartAt = strike.leaderDuration + strike.mainFlashDuration + strike.afterglowDuration
      const fadeProgress = strike.fadeOutDuration <= 0
        ? 1
        : clamp((time - fadeStartAt) / strike.fadeOutDuration, 0, 1)
      const fadeMultiplier = 1 - smoothstep(fadeProgress)

      strike.bolts.forEach((bolt) => {
        const branchAttenuation = bolt.isBranch ? lerp(0.88, 1.06, 1 - Math.min(1, bolt.branchLevel / 3)) : 1
        const leaderStart = strike.leaderDuration * (bolt.isBranch ? bolt.activationOffset : 0)
        const leaderWindow = Math.max(
          0.012,
          strike.leaderDuration * (bolt.isBranch ? lerp(0.38, 0.62, bolt.leaderBias) : 1),
        )
        const leaderTime = clamp((time - leaderStart) / leaderWindow, 0, 1)
        const leaderFlash = smoothstep(leaderTime) * lerp(0.18, 0.52, bolt.leaderBias) * (bolt.isBranch ? 0.44 : 0.58)
        const revealProgress = bolt.isBranch
          ? clamp(Math.pow(leaderTime, 1.08), 0, 1)
          : clamp(Math.pow(clamp(time / Math.max(0.001, strike.leaderDuration), 0, 1), 0.9), 0, 1)
        this.applyBoltReveal(bolt, time >= leaderStart ? revealProgress : 0)

        const mainWindowTime = time - strike.leaderDuration - bolt.activationOffset * strike.mainFlashDuration * 0.42
        const mainFlash = mainWindowTime >= 0
          ? Math.exp(-Math.pow(mainWindowTime / Math.max(0.024, strike.mainFlashDuration * bolt.decayBias), 1.78))
            * bolt.baseIntensity
            * branchAttenuation
            * bolt.flashScale
            * bolt.tipFalloff
          : 0
        const flickerFlash = phase.flicker * bolt.flickerBias * branchAttenuation
        const afterglowFlash = phase.afterglow * bolt.baseIntensity * bolt.afterglowScale
        const boltDominance = bolt.isBranch ? lerp(1.02, 1.18, 1 - Math.min(1, bolt.branchLevel / 3)) : 1.18

        const coreOpacity = clamp(
          (leaderFlash * (bolt.isBranch ? 0.18 : 0.26) + mainFlash * 1.92 + flickerFlash * 0.34 + afterglowFlash * 0.12)
            * bolt.coreGain
            * boltDominance
            * fadeMultiplier,
          0,
          1,
        )
        const rimOpacity = clamp(
          (leaderFlash * (bolt.isBranch ? 0.34 : 0.48) + mainFlash * 0.52 + flickerFlash * 0.18 + afterglowFlash * 0.08)
            * bolt.rimGain
            * boltDominance
            * fadeMultiplier,
          0,
          bolt.isBranch ? 0.52 : 0.72,
        )
        const haloOpacity = bolt.haloMesh
          ? clamp(
            (phase.main * 0.18 * bolt.haloBias + phase.flicker * 0.08 * bolt.haloBias + phase.afterglow * 0.03)
              * fadeMultiplier,
            0,
            bolt.isBranch ? 0.14 : 0.24,
          )
          : 0

        bolt.coreMesh.material.opacity = coreOpacity
        bolt.rimMesh.material.opacity = rimOpacity
        if (bolt.haloMesh) {
          bolt.haloMesh.material.opacity = haloOpacity
        }
      })

      const strikeFlash = phase.sceneFlash * fadeMultiplier
      strike.flashLight.intensity = strikeFlash * strike.flashPeak * (strike.secondary ? 0.86 : 1.18)
      const originCoreOpacity = clamp(phase.main * 1.42 + phase.flicker * 0.46 + phase.afterglow * 0.06, 0, 1) * fadeMultiplier
      const originHaloOpacity = clamp(phase.main * 0.52 + phase.flicker * 0.22 + phase.afterglow * 0.04, 0, 0.48) * fadeMultiplier
      const originScale = 1 + phase.main * 0.48 + phase.flicker * 0.18
      strike.originCore.material.opacity = originCoreOpacity
      strike.originHalo.material.opacity = originHaloOpacity
      strike.originCore.scale.setScalar(originScale)
      strike.originHalo.scale.setScalar(1 + phase.main * 0.72 + phase.flicker * 0.26)
      flashSum += strikeFlash * (strike.secondary ? 0.48 : 1.12)
      flashMax = Math.max(flashMax, strikeFlash * (strike.secondary ? 0.86 : 1.08))
      if (strikeFlash > dominantFlash && this.camera) {
        const projected = strike.originCore.position.clone().project(this.camera)
        this.dominantFlashUv.set(
          clamp(projected.x * 0.5 + 0.5, 0, 1),
          clamp(projected.y * 0.5 + 0.5, 0, 1),
          clamp(strikeFlash, 0, 1),
        )
        dominantFlash = strikeFlash
      }

      const strikeEndAt = fadeStartAt + strike.fadeOutDuration
      if (time > strikeEndAt) {
        this.disposeStrike(strike)
        this.activeStrikes.splice(index, 1)
      }
    }

    this.currentSceneFlash = clamp(flashMax * 1.08 + flashSum * 0.24, 0, 1.28)
    this.ambientLight.intensity = 0.026 + normalize(this.options.brightness) * 0.04 + this.currentSceneFlash * 0.08
    this.flashLayer.style.opacity = `${clamp(this.currentSceneFlash * 0.46, 0, 0.38).toFixed(3)}`
  }

  private applyBoltReveal(bolt: StrikeBolt, progress: number) {
    const clamped = clamp(progress, 0, 1)
    const revealedCount = clamped <= 0
      ? 0
      : Math.max(6, Math.floor((bolt.drawCount * clamped) / 3) * 3)

    bolt.coreMesh.geometry.setDrawRange(0, revealedCount)
    bolt.rimMesh.geometry.setDrawRange(0, revealedCount)
    if (bolt.haloMesh) {
      bolt.haloMesh.geometry.setDrawRange(0, revealedCount)
    }
  }

  private computeStrikePhase(strike: ActiveStrike, time: number): StrikePhase {
    const leaderProgress = strike.leaderDuration > 0 ? clamp(time / strike.leaderDuration, 0, 1) : 1
    const leader = time < strike.leaderDuration ? smoothstep(leaderProgress) * 0.62 : 0

    const mainTime = time - strike.leaderDuration
    const main = mainTime >= 0
      ? Math.exp(-Math.pow(mainTime / Math.max(0.022, strike.mainFlashDuration), 1.76))
      : 0

    const flicker = strike.subFlashes.reduce((level, flashAt) => {
      const dt = time - flashAt
      if (dt < 0 || dt > 0.15) {
        return level
      }
      return Math.max(level, Math.exp(-Math.pow(dt / 0.03, 1.55)) * 1.04)
    }, 0)

    const afterglowStart = strike.leaderDuration + strike.mainFlashDuration
    const afterglow = time > afterglowStart
      ? Math.exp(-(time - afterglowStart) / Math.max(0.05, strike.afterglowDuration * 0.74)) * 0.24
      : 0

    const sceneFlash = clamp(main * 1.38 + flicker * 0.62 + afterglow * 0.1 + leader * 0.08, 0, 1.18)

    return {
      leader,
      main,
      flicker,
      afterglow,
      sceneFlash,
    }
  }

  private scheduleNextStrike(initial: boolean) {
    const intensity = normalize(this.options.intensity)
    const speed = normalize(this.options.speed)
    let baseDelay = lerp(4.8, 1.4, intensity + speed * 0.16)

    if (!initial) {
      if (this.burstStrikesRemaining > 0) {
        this.burstStrikesRemaining -= 1
        baseDelay = lerp(0.55, 1.25, Math.pow(Math.random(), 1.8))
      } else {
        const roll = Math.random()
        const burstChance = 0.08 + intensity * 0.16 + this.eventBoost * 0.12
        const mediumChance = 0.42 + speed * 0.12

        if (roll < burstChance) {
          this.burstStrikesRemaining = 1 + Math.floor(Math.random() * (1 + Math.round(intensity * 1.4)))
          baseDelay = lerp(0.85, 1.65, Math.pow(Math.random(), 2))
        } else if (roll < burstChance + mediumChance) {
          baseDelay = lerp(1.4, 3.6, Math.pow(Math.random(), 1.45))
        } else {
          baseDelay = lerp(3.4, 6.1, Math.pow(Math.random(), 0.62))
        }
      }
    }

    const irregularJitter = lerp(-0.48, 0.72, Math.random()) * lerp(0.36, 1, intensity + speed * 0.2)
    this.nextStrikeIn = Math.max(0.5, baseDelay + irregularJitter - speed * 0.42 - this.eventBoost * 0.68)
  }

  private get maxConcurrentStrikes() {
    return 3
  }

  private createStrikeCluster() {
    if (!this.stormGroup) {
      return
    }
    const available = this.maxConcurrentStrikes - this.activeStrikes.length
    if (available <= 0) {
      return
    }

    const intensity = normalize(this.options.intensity)
    const clusterRoll = Math.random()
    let strikeCount = 1
    if (clusterRoll < 0.04 + intensity * 0.04 + this.eventBoost * 0.04) {
      strikeCount = 3
    } else if (clusterRoll < 0.18 + intensity * 0.08 + this.eventBoost * 0.06) {
      strikeCount = 2
    }
    strikeCount = Math.min(strikeCount, available)

    const clusterCenterX = lerp(-4.8, 4.8, Math.random())
    const clusterCenterZ = lerp(-2.8, 2.8, Math.random())
    const placementBase: StrikePlacement = {
      xCenter: clusterCenterX,
      zCenter: clusterCenterZ,
      horizontalSpread: lerp(4.8, 8.4, Math.random()),
      depthSpread: lerp(2.4, 5.2, Math.random()),
      topYMin: 10.8,
      topYMax: 14.2,
      bottomYMin: -10.8,
      bottomYMax: -6.8,
    }

    this.activeStrikes.push(this.createStrike(false, placementBase, 1, 1, 1, 0))

    for (let index = 1; index < strikeCount; index += 1) {
      const direction = index % 2 === 0 ? 1 : -1
      const spreadScale = 1 + index * lerp(0.42, 0.7, Math.random())
      const placement: StrikePlacement = {
        xCenter: clusterCenterX + direction * lerp(3.4, 8.6, Math.random()) * spreadScale,
        zCenter: clusterCenterZ + lerp(-4.8, 4.8, Math.random()),
        horizontalSpread: lerp(2.4, 5.2, Math.random()),
        depthSpread: lerp(1.4, 3.8, Math.random()),
        topYMin: 8.8 + Math.random() * 3.6,
        topYMax: 12.4 + Math.random() * 2.8,
        bottomYMin: -9.8 - Math.random() * 1.8,
        bottomYMax: -5.6 - Math.random() * 1.4,
      }
      this.activeStrikes.push(
        this.createStrike(
          true,
          placement,
          lerp(0.46, 0.82, Math.random()),
          lerp(0.76, 0.96, Math.random()),
          lerp(0.72, 0.9, Math.random()),
          lerp(0.03, 0.22, Math.random()) * index,
        ),
      )
    }
  }

  private createStrike(
    secondary: boolean,
    placement: StrikePlacement,
    intensityScale: number,
    widthScale: number,
    brightnessScale: number,
    startDelay: number,
  ) {
    if (!this.stormGroup) {
      throw new Error('Storm group not initialized')
    }

    const strikeGroup = new THREE.Group()
    const intensity = normalize(this.options.intensity)
    const speed = normalize(this.options.speed)
    const brightness = normalize(this.options.brightness)
    const strikeProfile: StrikeProfile = {
      activationCurve: lerp(0.72, 1.9, Math.random()),
      brokenness: lerp(0.16, 0.88, Math.random()),
      branchRichness: lerp(0.58, 1.46, Math.random()),
      branchSourceBias: lerp(0.24, 0.86, Math.random()),
      branchSpread: lerp(0.62, 1.72, Math.random()),
      gravityBias: lerp(0.32, 1.08, Math.random()),
      trunkPull: lerp(0.14, 0.62, Math.random()),
    }
    const mainPoints = this.createBoltPoints(
      lerp(secondary ? 0.52 : 0.74, secondary ? 0.9 : 1.08, intensity) * intensityScale,
      secondary ? 4 + Math.floor(Math.random() * 2) : 5 + Math.floor(Math.random() * 3),
      lerp(secondary ? 1.6 : 2.6, secondary ? 4.6 : 7.2, Math.random()) * (0.82 + intensity * 0.72) * intensityScale,
      strikeProfile,
      placement,
    )
    const mainWidthFactor = (Math.random() > 0.45 ? lerp(1.18, 1.95, Math.random()) : lerp(0.96, 1.22, Math.random())) * widthScale
    const mainBolt = this.createBolt(mainPoints, false, mainWidthFactor, strikeProfile, 0)
    mainBolt.activationOffset = 0
    mainBolt.leaderBias = 1
    const bolts: StrikeBolt[] = [mainBolt]

    const primaryBranchTarget = secondary
      ? 1 + Math.floor(lerp(0, 2, intensity + Math.random() * 0.2))
      : 3 + Math.floor(lerp(1, 3, intensity + this.eventBoost * 0.18))
    const primaryBranchSeeds = this.createBranchSourceProgresses(primaryBranchTarget)
    const spawnedPrimaryBranches: BranchPath[] = []

    primaryBranchSeeds.forEach((seed) => {
      const branchPath = this.createBranchPoints(mainPoints, strikeProfile, 1, seed)
      if (!branchPath) {
        return
      }

      const branchBolt = this.createBolt(
        branchPath.points,
        true,
        lerp(1.02, 1.54, Math.random()),
        strikeProfile,
        1,
        branchPath.sourceProgress,
      )
      branchBolt.activationOffset = clamp(branchPath.sourceProgress + lerp(-0.01, 0.03, Math.random()), 0.08, 0.94)
      branchBolt.leaderBias *= 1.08
      bolts.push(branchBolt)
      spawnedPrimaryBranches.push(branchPath)
    })

    spawnedPrimaryBranches.forEach((parentBranch) => {
      if (Math.random() > lerp(0.26, 0.48, strikeProfile.branchRichness)) {
        return
      }

      const subBranch = this.createBranchPoints(parentBranch.points, strikeProfile, 2)
      if (!subBranch) {
        return
      }

      const branchBolt = this.createBolt(
        subBranch.points,
        true,
        lerp(0.7, 1.02, Math.random()),
        strikeProfile,
        2,
        clamp(parentBranch.sourceProgress + subBranch.sourceProgress * 0.22, 0.14, 0.98),
      )
      branchBolt.activationOffset = clamp(branchBolt.sourceProgress + lerp(0.02, 0.08, Math.random()), 0.14, 0.98)
      branchBolt.leaderBias *= 0.92
      bolts.push(branchBolt)
    })

    bolts.forEach((bolt) => {
      if (bolt.haloMesh) {
        strikeGroup.add(bolt.haloMesh)
      }
      strikeGroup.add(bolt.rimMesh)
      strikeGroup.add(bolt.coreMesh)
    })

    const flashLight = new THREE.PointLight(this.palette.core, 0, 130, 1.85)
    const originPoint = mainPoints[0] ?? new THREE.Vector3()
    flashLight.position.copy(originPoint)
    strikeGroup.add(flashLight)

    const originCore = new THREE.Mesh(
      new THREE.SphereGeometry(secondary ? 0.06 : 0.09, 12, 12),
      new THREE.MeshBasicMaterial({
        color: this.palette.core,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    originCore.position.copy(originPoint)
    strikeGroup.add(originCore)

    const originHalo = new THREE.Mesh(
      new THREE.SphereGeometry(secondary ? 0.22 : 0.34, 14, 14),
      new THREE.MeshBasicMaterial({
        color: this.palette.glow,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    originHalo.position.copy(originPoint)
    strikeGroup.add(originHalo)

    this.stormGroup.add(strikeGroup)

    const lingerFactor = lerp(secondary ? 0.8 : 1.18, secondary ? 1.18 : 1.72, Math.random())
    const leaderDuration = lerp(secondary ? 0.024 : 0.04, secondary ? 0.07 : 0.1, 1 - speed * 0.38) * lerp(0.96, 1.18, Math.random())
    const mainFlashDuration = lerp(secondary ? 0.022 : 0.03, secondary ? 0.044 : 0.068, 1 - speed * 0.12) * lingerFactor
    const firstFlickerAt = leaderDuration + mainFlashDuration + lerp(0.034, 0.085, Math.random())
    const subFlashes = Array.from(
      { length: Math.floor((secondary ? 1 : 2) + Math.random() * (1 + Math.round(intensity * (secondary ? 1.2 : 2.4)))) },
      (_, index) => firstFlickerAt + index * lerp(0.04, 0.11, Math.random()) * lerp(1, 1.24, lingerFactor),
    )

    return {
      group: strikeGroup,
      bolts,
      flashLight,
      originCore,
      originHalo,
      startAt: this.elapsedSeconds + startDelay,
      leaderDuration,
      mainFlashDuration,
      afterglowDuration: lerp(secondary ? 0.08 : 0.14, secondary ? 0.18 : 0.28, brightness * brightnessScale) * lingerFactor,
      fadeOutDuration: lerp(secondary ? 0.06 : 0.1, secondary ? 0.14 : 0.22, brightness * brightnessScale) * lerp(0.88, 1.18, lingerFactor),
      subFlashes,
      flashPeak: lerp(secondary ? 1.6 : 7.2, secondary ? 3.8 : 14.6, brightness * brightnessScale + intensity * 0.28 + this.eventBoost * 0.26),
      secondary,
    }
  }

  private createBolt(
    points: THREE.Vector3[],
    isBranch: boolean,
    widthFactor: number,
    profile: StrikeProfile,
    branchLevel: number,
    sourceProgress = 0,
  ): StrikeBolt {
    const brightness = normalize(this.options.brightness)
    const brokenness = clamp(profile.brokenness * lerp(0.82, 1.24, Math.random()), 0, 1)
    const branchyLook = Math.random()
    const renderPath = this.createRenderPath(points, isBranch)
    const curve = new THREE.CatmullRomCurve3(renderPath, false, 'centripetal', 0.08)
    const tubularSegments = Math.max(84, renderPath.length * 11)

    const boltLength = points.reduce((sum, point, index) => {
      if (index === 0) {
        return 0
      }
      return sum + point.distanceTo(points[index - 1])
    }, 0)
    const branchScale = Math.pow(0.72, branchLevel)
    const pathStretch = clamp(boltLength / (isBranch ? 7.2 : 18), 0.72, 1.28)
    const baseRadius = (isBranch ? 0.03 : 0.054)
      * widthFactor
      * branchScale
      * pathStretch
      * lerp(0.94, 1.16, Math.random())

    const coreMesh = this.createTubeBoltMesh(curve, baseRadius * (isBranch ? 0.42 : 0.34), this.palette.core, 6, tubularSegments)
    const rimMesh = this.createTubeBoltMesh(curve, baseRadius * (isBranch ? 0.66 : 0.58), this.palette.rim, 7, tubularSegments)
    const haloEnabled = branchLevel === 0
      ? Math.random() > lerp(0.14, 0.42, brokenness)
      : Math.random() > lerp(0.32, 0.68, brokenness)
    const haloMesh = haloEnabled
      ? this.createTubeBoltMesh(curve, baseRadius * lerp(isBranch ? 0.92 : 1.14, isBranch ? 1.22 : 1.6, brightness), this.palette.glow, 8, tubularSegments)
      : null

    coreMesh.material.opacity = 0
    rimMesh.material.opacity = 0
    coreMesh.geometry.setDrawRange(0, 0)
    rimMesh.geometry.setDrawRange(0, 0)
    if (haloMesh) {
      haloMesh.material.opacity = 0
      haloMesh.geometry.setDrawRange(0, 0)
    }

    const drawCount = coreMesh.geometry.index?.count ?? coreMesh.geometry.attributes.position.count

    return {
      coreMesh,
      rimMesh,
      haloMesh,
      drawCount,
      branchLevel,
      sourceProgress,
      baseIntensity: lerp(0.94, 1.42, Math.random()) * (isBranch ? (branchLevel === 1 ? 0.96 : 0.7) * branchScale : 1.08),
      coreGain: lerp(1.08, 1.62, Math.random()) * (isBranch ? (branchLevel === 1 ? 1.12 : 0.9) : 1.08),
      rimGain: lerp(0.14, 0.42, Math.random()) * lerp(0.82, 1.14, branchyLook) * (isBranch ? (branchLevel === 1 ? 1.02 : 0.82) : 1.08),
      leaderBias: lerp(0.56, 1.08, Math.random()) * (isBranch ? 0.96 : 1),
      flickerBias: lerp(0.4, 0.88, Math.random()) * (isBranch ? 0.62 : 1),
      haloBias: haloEnabled ? lerp(isBranch ? 0.22 : 0.42, isBranch ? 0.54 : 0.84, Math.random()) : 0,
      activationOffset: clamp(
        Math.pow(Math.random(), profile.activationCurve) * lerp(isBranch ? 0.44 : 0.22, isBranch ? 1.08 : 0.92, Math.random())
          + branchLevel * lerp(0.06, 0.14, Math.random()),
        0,
        1,
      ),
      decayBias: lerp(isBranch ? 0.42 : 0.56, isBranch ? 0.94 : 1.32, Math.random()),
      tipFalloff: lerp(1, isBranch ? 0.68 : 0.76, Math.random()),
      flashScale: isBranch
        ? lerp(branchLevel === 1 ? 0.92 : 0.58, branchLevel === 1 ? 1.26 : 0.8, Math.random()) * branchScale
        : lerp(1.08, 1.34, Math.random()),
      afterglowScale: isBranch ? lerp(0.08, 0.16, Math.random()) * branchScale : lerp(0.16, 0.24, Math.random()),
      isBranch,
    }
  }

  private createTubeBoltMesh(
    curve: THREE.CatmullRomCurve3,
    radius: number,
    color: number,
    radialSegments: number,
    tubularSegments: number,
  ) {
    const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false)
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    })
    return new THREE.Mesh(geometry, material)
  }

  private ensureFogClusters() {
    if (!this.cloudLayer || !this.islandLayer) {
      return
    }
    if (!this.fogTextureUrl) {
      this.fogTextureUrl = this.createFogTextureUrl(160)
    }
    if (this.fogClusters.length > 0) {
      return
    }

    const clusterCount = 7 + Math.floor(Math.random() * 3)
    for (let index = 0; index < clusterCount; index += 1) {
      const foreground = index < Math.ceil(clusterCount * 0.42)
      const layer = foreground ? this.cloudLayer : this.islandLayer
      const el = document.createElement('div')
      const width = foreground ? lerp(280, 520, Math.random()) : lerp(420, 760, Math.random())
      const height = width * lerp(0.52, 0.86, Math.random())
      const cluster: FogCluster = {
        el,
        layer: foreground ? 'foreground' : 'background',
        ...this.randomFogPosition(8, 92, 10, 88, 50, 50, foreground ? 26 : 22),
        width,
        height,
        scale: lerp(0.92, 1.28, Math.random()),
        opacity: foreground ? lerp(0.09, 0.18, Math.random()) : lerp(0.05, 0.11, Math.random()),
        driftX: lerp(-24, 24, Math.random()),
        driftY: lerp(-18, 18, Math.random()),
        speedX: foreground ? lerp(0.004, 0.011, Math.random()) : lerp(0.002, 0.006, Math.random()),
        speedY: foreground ? lerp(0.003, 0.009, Math.random()) : lerp(0.0015, 0.005, Math.random()),
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: foreground ? lerp(0.18, 0.34, Math.random()) : lerp(0.1, 0.22, Math.random()),
        noiseDriftX: lerp(-18, 18, Math.random()),
        noiseDriftY: lerp(-18, 18, Math.random()),
        hueMix: Math.random(),
        rotation: lerp(-18, 18, Math.random()),
        rotationSpeed: foreground ? lerp(0.05, 0.11, Math.random()) : lerp(0.02, 0.06, Math.random()),
      }

      Object.assign(el.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        backgroundRepeat: 'repeat',
        backgroundSize: foreground
          ? '100% 100%, 100% 100%, 100% 100%, 180px 180px, 240px 240px'
          : '100% 100%, 100% 100%, 100% 100%, 220px 220px, 300px 300px',
        backgroundBlendMode: 'screen, screen, screen, normal, normal',
        filter: foreground ? 'blur(46px)' : 'blur(72px)',
        borderRadius: `${lerp(24, 58, Math.random())}% ${lerp(34, 70, Math.random())}% ${lerp(22, 62, Math.random())}% ${lerp(30, 68, Math.random())}% / ${lerp(20, 64, Math.random())}% ${lerp(28, 66, Math.random())}% ${lerp(24, 70, Math.random())}% ${lerp(18, 60, Math.random())}%`,
        transformOrigin: '50% 50%',
        willChange: 'transform, opacity, background-position',
      })

      layer.appendChild(el)
      this.fogClusters.push(cluster)
    }
    this.updateFogClusterStyles()
  }

  private randomFogPosition(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    centerX: number,
    centerY: number,
    deadzoneRadius: number,
  ) {
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const x = lerp(minX, maxX, Math.random())
      const y = lerp(minY, maxY, Math.random())
      const dx = x - centerX
      const dy = y - centerY
      if (Math.sqrt(dx * dx + dy * dy) > deadzoneRadius) {
        return { x, y }
      }
    }
    return Math.random() > 0.5
      ? { x: minX + deadzoneRadius * 0.55, y: minY + deadzoneRadius * 0.35 }
      : { x: maxX - deadzoneRadius * 0.55, y: maxY - deadzoneRadius * 0.35 }
  }

  private createFogTextureUrl(size: number) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return null
    }

    const image = ctx.createImageData(size, size)
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        let value = 0
        let amplitude = 1
        let totalAmplitude = 0
        let frequency = 1 / 18

        for (let octave = 0; octave < 4; octave += 1) {
          const noise = Math.sin((x + 17.13 * octave) * frequency) * Math.cos((y - 11.37 * octave) * frequency)
            + Math.sin((x + y) * frequency * 0.63 + octave * 1.7) * 0.5
          value += ((noise + 1.5) / 3) * amplitude
          totalAmplitude += amplitude
          amplitude *= 0.56
          frequency *= 1.92
        }

        const normalizedValue = Math.pow(clamp(value / totalAmplitude, 0, 1), 1.65)
        const alpha = Math.round(normalizedValue * 255)
        const offset = (y * size + x) * 4
        image.data[offset] = 255
        image.data[offset + 1] = 255
        image.data[offset + 2] = 255
        image.data[offset + 3] = alpha
      }
    }

    ctx.putImageData(image, 0, 0)
    return canvas.toDataURL('image/png')
  }

  private updateFogClusterStyles() {
    if (!this.fogClusters.length || !this.fogTextureUrl) {
      return
    }
    const palette = this.palette
    this.fogClusters.forEach((cluster) => {
      const primary = cluster.layer === 'foreground'
        ? `rgba(118, 142, 168, ${lerp(0.11, 0.2, cluster.hueMix).toFixed(3)})`
        : `rgba(86, 110, 134, ${lerp(0.06, 0.12, cluster.hueMix).toFixed(3)})`
      const secondary = cluster.layer === 'foreground'
        ? palette.cloudHigh.replace(/0\.\d+\)/, `${lerp(0.1, 0.18, 1 - cluster.hueMix).toFixed(3)})`)
        : palette.cloudMid.replace(/0\.\d+\)/, `${lerp(0.07, 0.14, 1 - cluster.hueMix).toFixed(3)})`)
      const tertiary = cluster.layer === 'foreground'
        ? `rgba(164, 186, 215, ${lerp(0.04, 0.09, cluster.hueMix).toFixed(3)})`
        : `rgba(112, 132, 158, ${lerp(0.03, 0.07, cluster.hueMix).toFixed(3)})`
      cluster.el.style.backgroundImage = [
        `radial-gradient(ellipse at 24% 38%, ${primary} 0%, rgba(0,0,0,0) 56%)`,
        `radial-gradient(ellipse at 74% 62%, ${secondary} 0%, rgba(0,0,0,0) 52%)`,
        `linear-gradient(148deg, rgba(0,0,0,0) 18%, ${tertiary} 44%, rgba(0,0,0,0) 78%)`,
        `url("${this.fogTextureUrl}")`,
        `url("${this.fogTextureUrl}")`,
      ].join(', ')
      cluster.el.style.opacity = cluster.opacity.toFixed(3)
    })
  }

  private createRenderPath(points: THREE.Vector3[], isBranch: boolean) {
    if (points.length <= 3) {
      return points.map((point) => point.clone())
    }

    if (isBranch) {
      const shaped: THREE.Vector3[] = [points[0].clone(), points[1].clone()]

      for (let index = 2; index < points.length - 1; index += 1) {
        const prev = points[index - 1]
        const current = points[index]
        const next = points[index + 1]
        const tangent = next.clone().sub(prev).normalize()
        const bendAxis = this.randomPerpendicular(tangent)
        const localSpan = Math.min(prev.distanceTo(current), current.distanceTo(next))
        const shapedPoint = prev.clone().multiplyScalar(0.12)
          .add(current.clone().multiplyScalar(0.72))
          .add(next.clone().multiplyScalar(0.16))

        shapedPoint.addScaledVector(
          bendAxis,
          lerp(-1, 1, Math.random()) * localSpan * 0.01,
        )

        shaped.push(shapedPoint)
      }

      shaped.push(points[points.length - 1].clone())
      return shaped
    }

    const shaped: THREE.Vector3[] = [points[0].clone()]

    for (let index = 1; index < points.length - 1; index += 1) {
      const prev = points[index - 1]
      const current = points[index]
      const next = points[index + 1]
      const tangent = next.clone().sub(prev).normalize()
      const bendAxis = this.randomPerpendicular(tangent)
      const localSpan = Math.min(prev.distanceTo(current), current.distanceTo(next))
      const shapedPoint = prev.clone().multiplyScalar(0.16)
        .add(current.clone().multiplyScalar(0.68))
        .add(next.clone().multiplyScalar(0.16))

      shapedPoint.addScaledVector(
        bendAxis,
        lerp(-1, 1, Math.random()) * localSpan * (isBranch ? 0.012 : 0.02),
      )

      shaped.push(shapedPoint)
    }

    shaped.push(points[points.length - 1].clone())
    return shaped
  }

  private createBranchSourceProgresses(count: number) {
    return Array.from({ length: count }, (_, index) => {
      const slot = (index + 0.6) / (count + 0.45)
      return clamp(lerp(0.44, 0.9, slot) + lerp(-0.04, 0.04, Math.random()), 0.4, 0.92)
    }).sort((left, right) => left - right)
  }

  private createBoltPoints(
    lengthFactor: number,
    subdivisions: number,
    displacement: number,
    profile: StrikeProfile,
    placement?: StrikePlacement,
  ) {
    const xCenter = placement?.xCenter ?? 0
    const zCenter = placement?.zCenter ?? 0
    const horizontalSpread = placement?.horizontalSpread ?? 11
    const depthSpread = placement?.depthSpread ?? 3.8
    const start = new THREE.Vector3(
      xCenter + lerp(-horizontalSpread, horizontalSpread, Math.random()),
      lerp(placement?.topYMin ?? 11, placement?.topYMax ?? 14.2, Math.random()),
      zCenter + lerp(-depthSpread, depthSpread, Math.random()),
    )
    const end = new THREE.Vector3(
      xCenter + lerp(-horizontalSpread * 0.92, horizontalSpread * 0.92, Math.random()),
      lerp(placement?.bottomYMin ?? -10.8, placement?.bottomYMax ?? -6.8, Math.random()),
      zCenter + lerp(-depthSpread * 1.45, depthSpread * 1.45, Math.random()) * lengthFactor,
    )
    return this.buildDischargePath(start, end, subdivisions, displacement, profile.gravityBias, profile.trunkPull)
  }

  private createBranchPoints(
    mainPoints: THREE.Vector3[],
    profile: StrikeProfile,
    branchLevel: number,
    sourceProgressHint?: number,
  ): BranchPath | null {
    if (mainPoints.length < 6) {
      return null
    }

    const lowerBias = Math.pow(Math.random(), lerp(0.34, 0.76, profile.branchSourceBias))
    const sourceProgress = sourceProgressHint == null
      ? clamp(0.5 + (1 - lowerBias) * 0.34 + branchLevel * 0.03, 0.4, 0.93)
      : clamp(sourceProgressHint + lerp(-0.025, 0.025, Math.random()), 0.4, 0.93)
    const sourceIndex = Math.min(mainPoints.length - 2, Math.max(1, Math.floor(sourceProgress * (mainPoints.length - 1))))
    const source = mainPoints[sourceIndex]
    const localDirection = mainPoints[Math.min(mainPoints.length - 1, sourceIndex + 1)]
      .clone()
      .sub(mainPoints[Math.max(0, sourceIndex - 1)])
      .normalize()
    const sideAxis = this.randomPerpendicular(localDirection)
    const branchSide = Math.random() > 0.5 ? 1 : -1
    const elbow = source.clone()
      .add(sideAxis.clone().multiplyScalar(lerp(0.3, branchLevel === 1 ? 0.96 : 0.58, Math.random()) * Math.pow(0.84, branchLevel - 1) * branchSide))
      .add(new THREE.Vector3(
        0,
        -lerp(0.08, 0.28, Math.random()) * profile.gravityBias + lerp(0.04, 0.22, Math.random()) * Math.pow(0.86, branchLevel - 1),
        lerp(-0.12, 0.12, Math.random()) * profile.branchSpread,
      ))
    const branchDirection = localDirection
      .clone()
      .multiplyScalar(0.08 + Math.random() * 0.12)
      .add(sideAxis.clone().multiplyScalar(lerp(1.24, 2.64, Math.random()) * profile.branchSpread * branchSide))
      .add(new THREE.Vector3(0, -lerp(0.46, 1.08, Math.random()) * profile.gravityBias, lerp(-0.58, 0.58, Math.random()) * profile.branchSpread))
      .normalize()

    const branchLength = lerp(branchLevel === 1 ? 2.6 : 1.4, branchLevel === 1 ? 7.8 : 4.2, Math.pow(Math.random(), 0.66))
      * Math.pow(0.72, branchLevel - 1)
      * (0.9 + normalize(this.options.intensity) * 0.48)
      * profile.branchRichness
    const end = elbow.clone().add(branchDirection.multiplyScalar(branchLength))
    const points = this.buildDischargePath(
      elbow,
      end,
      1 + Math.floor(Math.random() * (branchLevel === 1 ? 3 : 2)),
      (0.72 + Math.random() * 1.6) * Math.pow(0.76, branchLevel - 1),
      profile.gravityBias * lerp(0.52, 0.72, Math.random()),
      profile.trunkPull * lerp(0.18, 0.34, Math.random()),
      true,
    )
    const truncateAt = Math.max(4, Math.floor(points.length * lerp(0.46, 0.88, Math.random())))
    return {
      points: [source.clone(), elbow, ...points.slice(1, truncateAt)],
      sourceProgress,
    }
  }

  private buildDischargePath(
    start: THREE.Vector3,
    end: THREE.Vector3,
    subdivisions: number,
    displacement: number,
    gravityBias: number,
    trunkPull: number,
    isBranch = false,
  ) {
    let points = [start.clone(), end.clone()]
    let offset = displacement
    const mainBendDirection = Math.random() > 0.5 ? 1 : -1
    const coarseSubdivisions = isBranch ? subdivisions : Math.max(2, subdivisions - 1)

    for (let level = 0; level < coarseSubdivisions; level += 1) {
      const next: THREE.Vector3[] = [points[0]]

      for (let index = 0; index < points.length - 1; index += 1) {
        const left = points[index]
        const right = points[index + 1]
        const midpoint = left.clone().lerp(right, lerp(0.42, 0.58, Math.random()))
        const direction = right.clone().sub(left).normalize()
        const sideAxis = this.randomPerpendicular(direction)
        const depthAxis = direction.clone().cross(sideAxis).normalize()
        const displacementScale = offset * lerp(isBranch ? 0.82 : 0.74, isBranch ? 1.18 : 1.02, Math.random())
        const lateralSign = Math.random() > (isBranch ? 0.44 : 0.24) ? mainBendDirection : (Math.random() > 0.5 ? 1 : -1)

        midpoint.addScaledVector(sideAxis, lateralSign * displacementScale * lerp(isBranch ? 0.42 : 0.56, isBranch ? 1.04 : 0.94, Math.random()))
        midpoint.addScaledVector(depthAxis, lerp(-1, 1, Math.random()) * displacementScale * (isBranch ? 0.28 : 0.18))
        midpoint.y -= displacementScale * lerp(0.14, isBranch ? 0.3 : 0.26, Math.random()) * lerp(0.85, 1.42, gravityBias)

        next.push(midpoint, right)
      }

      points = next
      offset *= isBranch ? 0.7 : 0.62
    }

    const fractured: THREE.Vector3[] = [points[0]]
    for (let index = 0; index < points.length - 1; index += 1) {
      const left = points[index]
      const right = points[index + 1]
      const direction = right.clone().sub(left)
      const segmentLength = direction.length()
      const normalizedDirection = direction.clone().normalize()
      const sideAxis = this.randomPerpendicular(normalizedDirection)
      const depthAxis = normalizedDirection.clone().cross(sideAxis).normalize()
      const fractureScale = Math.min(segmentLength * (isBranch ? 0.26 : 0.18), displacement * (isBranch ? 0.28 : 0.18))

      if (segmentLength > 0.45) {
        const first = left.clone().lerp(right, lerp(0.26, 0.44, Math.random()))
        first.addScaledVector(sideAxis, (Math.random() > (isBranch ? 0.36 : 0.22) ? mainBendDirection : lerp(-1, 1, Math.random())) * fractureScale)
        first.addScaledVector(depthAxis, lerp(-1, 1, Math.random()) * fractureScale * (isBranch ? 0.32 : 0.18))
        fractured.push(first)

        if (Math.random() < (isBranch ? 0.34 : 0.18)) {
          const second = left.clone().lerp(right, lerp(0.58, 0.82, Math.random()))
          second.addScaledVector(sideAxis, lerp(-1, 1, Math.random()) * fractureScale * (isBranch ? 0.58 : 0.42))
          second.addScaledVector(depthAxis, lerp(-1, 1, Math.random()) * fractureScale * (isBranch ? 0.22 : 0.12))
          fractured.push(second)
        }
      }

      fractured.push(right)
    }

    points = fractured

    for (let index = 1; index < points.length - 1; index += 1) {
      const t = index / (points.length - 1)
      points[index].x = lerp(points[index].x, end.x, Math.pow(t, 1.72) * trunkPull * 0.26)
      points[index].z = lerp(points[index].z, end.z, Math.pow(t, 1.66) * trunkPull * 0.22)
      points[index].y -= Math.pow(t, 1.34) * displacement * 0.06 * gravityBias
      if (Math.random() < (isBranch ? 0.2 : 0.12)) {
        const prev = points[index - 1]
        const next = points[index + 1]
        const direction = next.clone().sub(prev).normalize()
        const bendAxis = this.randomPerpendicular(direction)
        const depthAxis = direction.clone().cross(bendAxis).normalize()
        points[index].addScaledVector(bendAxis, lerp(-0.44, 0.44, Math.random()) * displacement * (isBranch ? 0.14 : 0.08))
        points[index].addScaledVector(depthAxis, lerp(-0.24, 0.24, Math.random()) * displacement * (isBranch ? 0.08 : 0.04))
      }
    }

    return points
  }

  private randomPerpendicular(direction: THREE.Vector3) {
    const reference = Math.abs(direction.dot(UP_AXIS)) > 0.82
      ? new THREE.Vector3(1, 0, 0)
      : UP_AXIS
    return direction.clone().cross(reference).normalize()
  }

  private seedFogIslands() {
    this.fogIslands.forEach((island, index) => {
      island.set(
        lerp(0.14, 0.86, Math.random()),
        lerp(0.16, 0.84, Math.random()),
        lerp(index < 2 ? 0.16 : 0.12, index < 2 ? 0.24 : 0.2, Math.random()),
        lerp(index < 2 ? 0.14 : 0.1, index < 2 ? 0.22 : 0.18, Math.random()),
      )
    })
    if (this.fogUniforms) {
      this.fogUniforms.uIslands.value = this.fogIslands
      this.fogUniforms.uIslandCount.value = 4 + Math.floor(Math.random() * 2)
    }
  }

  private updateFogPlaneScale() {
    if (!this.camera || !this.fogMesh || !this.container || !this.fogUniforms) {
      return
    }
    const distance = FOG_PLANE_DISTANCE
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) * distance
    const width = height * this.camera.aspect
    const cameraDirection = new THREE.Vector3()
    this.camera.getWorldDirection(cameraDirection)

    this.fogMesh.position.copy(this.camera.position).addScaledVector(cameraDirection, distance)
    this.fogMesh.quaternion.copy(this.camera.quaternion)
    this.fogMesh.scale.set(width * FOG_PLANE_OVERSCAN, height * FOG_PLANE_OVERSCAN, 1)
    this.fogUniforms.uResolution.value.set(
      Math.max(1, this.container.clientWidth),
      Math.max(1, this.container.clientHeight),
    )
  }

  private updateFogPalette() {
    if (!this.fogUniforms) {
      return
    }
    const palette = this.palette
    const low = new THREE.Color(palette.background).lerp(new THREE.Color(palette.fog), 0.52)
    const mid = new THREE.Color(palette.fog).lerp(new THREE.Color(palette.rim), 0.2)
    const high = new THREE.Color(palette.rim).lerp(new THREE.Color(palette.core), 0.12)
    this.fogUniforms.uColorLow.value.copy(low)
    this.fogUniforms.uColorMid.value.copy(mid)
    this.fogUniforms.uColorHigh.value.copy(high)
  }

  private updateFogLayer() {
    if (!this.fogUniforms) {
      return
    }
    this.fogUniforms.uTime.value = this.elapsedSeconds
    this.fogUniforms.uIntensity.value = normalize(this.options.intensity)
    this.fogUniforms.uSpeed.value = normalize(this.options.speed)
    this.fogUniforms.uBrightness.value = normalize(this.options.brightness)
    this.fogUniforms.uFlash.value = this.currentSceneFlash
    this.fogUniforms.uLocalFlash.value.copy(this.dominantFlashUv)
  }

  private updateClouds() {
    if (!this.cloudLayer) {
      return
    }
    this.ensureFogClusters()
    const t = this.elapsedSeconds
    const baseCloudPulse = 0.1 + Math.sin(t * 0.052) * 0.014 + Math.cos(t * 0.031) * 0.012
    this.cloudLayer.style.opacity = `${clamp(baseCloudPulse + this.currentSceneFlash * 0.12, 0.08, 0.24).toFixed(3)}`
    this.cloudLayer.style.transform = `translate3d(${(Math.sin(t * 0.01) * 5).toFixed(2)}px, ${(Math.cos(t * 0.008) * 4).toFixed(2)}px, 0)`
    if (this.islandLayer) {
      this.islandLayer.style.opacity = `${clamp(0.08 + Math.cos(t * 0.037) * 0.01 + this.currentSceneFlash * 0.16, 0.06, 0.22).toFixed(3)}`
      this.islandLayer.style.transform = `translate3d(${(Math.cos(t * 0.007) * 6).toFixed(2)}px, ${(Math.sin(t * 0.006) * 5).toFixed(2)}px, 0)`
    }

    this.fogClusters.forEach((cluster, index) => {
      const phase = cluster.pulsePhase + t * cluster.pulseSpeed
      const depthScale = cluster.layer === 'foreground' ? 1.08 : 0.92
      const translateX = cluster.driftX + Math.sin(phase * cluster.speedX * 90 + index) * (cluster.layer === 'foreground' ? 20 : 12)
      const translateY = cluster.driftY + Math.cos(phase * cluster.speedY * 90 + index * 0.63) * (cluster.layer === 'foreground' ? 14 : 9)
      const scale = cluster.scale + Math.sin(phase) * (cluster.layer === 'foreground' ? 0.04 : 0.025)
      const flashLift = this.currentSceneFlash * (cluster.layer === 'foreground' ? 0.12 : 0.08)
      const rotation = cluster.rotation + Math.sin(phase * cluster.rotationSpeed) * (cluster.layer === 'foreground' ? 6 : 3.5)
      cluster.el.style.opacity = `${clamp(cluster.opacity + flashLift + Math.sin(phase * 0.7) * 0.012, 0.025, cluster.layer === 'foreground' ? 0.34 : 0.2).toFixed(3)}`
      cluster.el.style.transform = `translate3d(calc(${cluster.x.toFixed(2)}% - ${Math.round(cluster.width / 2)}px + ${translateX.toFixed(2)}px), calc(${cluster.y.toFixed(2)}% - ${Math.round(cluster.height / 2)}px + ${translateY.toFixed(2)}px), 0) scale(${(scale * depthScale).toFixed(4)}) rotate(${rotation.toFixed(3)}deg)`
      cluster.el.style.backgroundPosition = [
        `${(50 + Math.sin(phase * 0.42 + index * 0.31) * cluster.noiseDriftX).toFixed(2)}% ${(48 + Math.cos(phase * 0.36 + index * 0.22) * cluster.noiseDriftY).toFixed(2)}%`,
        `${(42 + Math.cos(phase * 0.28 + index * 0.44) * cluster.noiseDriftY * 0.55).toFixed(2)}% ${(54 + Math.sin(phase * 0.31 + index * 0.37) * cluster.noiseDriftX * 0.55).toFixed(2)}%`,
        `${(35 + Math.sin(phase * 0.64 + index * 0.18) * 18).toFixed(2)}% ${(44 + Math.cos(phase * 0.58 + index * 0.27) * 18).toFixed(2)}%`,
        `${(66 + Math.cos(phase * 0.49 + index * 0.34) * 14).toFixed(2)}% ${(58 + Math.sin(phase * 0.53 + index * 0.15) * 14).toFixed(2)}%`,
      ].join(', ')
    })
  }

  private resizeRainCanvas() {
    if (!this.container || !this.rainCanvas || !this.rainContext) {
      return
    }
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25)
    this.rainCanvas.width = Math.round(width * pixelRatio)
    this.rainCanvas.height = Math.round(height * pixelRatio)
    this.rainContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    this.seedRainDrops()
  }

  private seedRainDrops() {
    if (!this.container) {
      return
    }
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    const dropCount = Math.max(48, Math.min(128, Math.round((width * height) / 24000)))
    this.rainDrops = Array.from({ length: dropCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      length: lerp(10, 26, Math.random()),
      speed: lerp(320, 760, Math.random()),
      alpha: lerp(0.08, 0.22, Math.random()),
      drift: lerp(-46, -18, Math.random()),
      depth: lerp(0.72, 1.18, Math.random()),
    }))
  }

  private updateRain(deltaSeconds: number) {
    if (!this.container || !this.rainCanvas || !this.rainContext) {
      return
    }

    const ctx = this.rainContext
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    const brightness = normalize(this.options.brightness)
    const intensity = normalize(this.options.intensity)
    const flashBoost = this.currentSceneFlash
    const rainOpacity = 0.14 + intensity * 0.08 + flashBoost * 0.12

    ctx.clearRect(0, 0, width, height)
    ctx.lineCap = 'round'

    this.rainDrops.forEach((drop) => {
      drop.x += drop.drift * deltaSeconds * drop.depth
      drop.y += drop.speed * deltaSeconds * drop.depth

      if (drop.y - drop.length > height || drop.x < -40) {
        drop.x = Math.random() * (width + 80) - 20
        drop.y = -Math.random() * height * 0.3 - drop.length
        drop.length = lerp(10, 26, Math.random())
        drop.speed = lerp(320, 760, Math.random())
        drop.alpha = lerp(0.08, 0.22, Math.random())
        drop.drift = lerp(-46, -18, Math.random())
        drop.depth = lerp(0.72, 1.18, Math.random())
      }

      const strokeAlpha = clamp(drop.alpha * rainOpacity * (0.82 + brightness * 0.28), 0.04, 0.32)
      ctx.strokeStyle = `rgba(198, 218, 240, ${strokeAlpha.toFixed(3)})`
      ctx.lineWidth = 1.1 * drop.depth
      ctx.beginPath()
      ctx.moveTo(drop.x, drop.y)
      ctx.lineTo(drop.x + drop.drift * 0.05, drop.y + drop.length)
      ctx.stroke()
    })
  }

  private disposeStrike(strike?: ActiveStrike) {
    if (strike) {
      strike.bolts.forEach((bolt) => {
        bolt.coreMesh.geometry.dispose()
        bolt.coreMesh.material.dispose()
        bolt.rimMesh.geometry.dispose()
        bolt.rimMesh.material.dispose()
        bolt.haloMesh?.geometry.dispose()
        bolt.haloMesh?.material.dispose()
      })
      strike.originCore.geometry.dispose()
      strike.originCore.material.dispose()
      strike.originHalo.geometry.dispose()
      strike.originHalo.material.dispose()
      strike.flashLight.removeFromParent()
      strike.group.removeFromParent()
      return
    }
    this.activeStrikes.forEach((activeStrike) => this.disposeStrike(activeStrike))
    this.activeStrikes = []
    this.currentSceneFlash = 0
  }

  private disposeScene() {
    this.disposeStrike()
    this.rainCanvas?.remove()
    this.flashLayer?.remove()
    this.rainCanvas = null
    this.rainContext = null
    this.flashLayer = null
    this.rainDrops = []
    this.fogMesh?.geometry.dispose()
    this.fogMesh?.material.dispose()
    this.fogMesh?.removeFromParent()
    this.fogMesh = null
    this.fogUniforms = null
    this.stormGroup?.clear()
    this.stormGroup?.removeFromParent()
    this.stormGroup = null
    this.ambientLight = null
    this.scene = null
    this.camera = null
  }

  private disposeRenderer() {
    if (!this.renderer) {
      return
    }
    this.renderer.dispose()
    this.renderer.forceContextLoss?.()
    this.renderer.domElement.remove()
    this.renderer = null
  }

  private get palette() {
    return STORM_PALETTES[this.options.colorScheme]
  }
}
