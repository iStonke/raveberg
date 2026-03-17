import * as THREE from 'three'

import type { ColorScheme, VisualizerPreset } from '../../../services/api'
import {
  createNebelFogUniforms,
  MAX_NEBEL_CLUSTERS,
  NEBEL_FOG_FRAGMENT_SHADER,
  NEBEL_FOG_VERTEX_SHADER,
} from './nebelFogShader'
import type { VisualizerRuntimeController, VisualizerRuntimeOptions } from './runtimeTypes'
import { clamp, lerp, normalize } from './runtimeUtils'

export type NebelPreset = Extract<VisualizerPreset, 'nebel'>

const NEBEL_PRESETS = new Set<NebelPreset>(['nebel'])
const NEBEL_DEBUG_CONTRAST = false

type NebelFogUniformMap = ReturnType<typeof createNebelFogUniforms>

interface NebelPalette {
  black: number
  low: number
  mid: number
  high: number
}

interface NebelCluster {
  position: THREE.Vector2
  size: THREE.Vector2
  motion: THREE.Vector4
}

const NEBEL_PALETTES: Record<ColorScheme, NebelPalette> = {
  mono: {
    black: 0x020205,
    low: 0x10101c,
    mid: 0x241f36,
    high: 0x4a3771,
  },
  acid: {
    black: 0x020308,
    low: 0x0b1220,
    mid: 0x1d2b46,
    high: 0x415f8a,
  },
  ultraviolet: {
    black: 0x020207,
    low: 0x120c20,
    mid: 0x2b2144,
    high: 0x6d4792,
  },
  redline: {
    black: 0x030205,
    low: 0x150d1a,
    mid: 0x2f1f35,
    high: 0x633256,
  },
}

export function isNebelPreset(preset: string): preset is NebelPreset {
  return NEBEL_PRESETS.has(preset as NebelPreset)
}

export class NebelVisualizerRuntime implements VisualizerRuntimeController {
  private container: HTMLElement | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.OrthographicCamera | null = null
  private fogMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null
  private fogUniforms: NebelFogUniformMap | null = null
  private readonly clock = new THREE.Clock()
  private animationFrameId = 0
  private options: VisualizerRuntimeOptions
  private errorHandler: ((error: Error) => void) | null = null
  private pulseBoost = 0
  private readonly clusters: NebelCluster[] = []

  constructor(private readonly preset: NebelPreset) {
    this.options = {
      preset,
      intensity: 65,
      speed: 55,
      brightness: 70,
      colorScheme: 'ultraviolet',
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
    this.rebuildClusters()
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
    this.fogMesh?.geometry.dispose()
    this.fogMesh?.material.dispose()
    this.fogMesh?.removeFromParent()
    this.fogMesh = null
    this.scene = null
    this.camera = null
    this.fogUniforms = null
    this.clusters.length = 0
    this.renderer?.dispose()
    this.renderer?.domElement.remove()
    this.renderer = null
    this.container = null
  }

  resize(width: number, height: number) {
    if (!this.renderer || !this.fogUniforms) {
      return
    }
    const safeWidth = Math.max(1, width)
    const safeHeight = Math.max(1, height)
    this.renderer.setSize(safeWidth, safeHeight, false)
    this.fogUniforms.uResolution.value.set(safeWidth, safeHeight)
    this.rebuildClusters()
  }

  updateOptions(partialOptions: Partial<VisualizerRuntimeOptions>) {
    this.options = { ...this.options, ...partialOptions }
    this.applyPalette()
    this.rebuildClusters()
  }

  triggerEvent(name: string) {
    if (name === 'mode_change' || name === 'upload_created') {
      this.pulseBoost = Math.min(1, this.pulseBoost + 0.26 + Math.random() * 0.12)
    }
  }

  setErrorHandler(handler: ((error: Error) => void) | null) {
    this.errorHandler = handler
  }

  private setupScene() {
    if (!this.container || this.renderer) {
      return
    }

    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)

    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2)
    this.camera.position.z = 1

    this.fogUniforms = createNebelFogUniforms()
    this.fogUniforms.uResolution.value.set(width, height)
    this.fogUniforms.uIntensity.value = normalize(this.options.intensity)
    this.fogUniforms.uSpeed.value = normalize(this.options.speed)
    this.fogUniforms.uBrightness.value = normalize(this.options.brightness)
    this.fogUniforms.uDebugContrast.value = NEBEL_DEBUG_CONTRAST ? 1 : 0

    const material = new THREE.ShaderMaterial({
      uniforms: this.fogUniforms,
      vertexShader: NEBEL_FOG_VERTEX_SHADER,
      fragmentShader: NEBEL_FOG_FRAGMENT_SHADER,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    })
    const geometry = new THREE.PlaneGeometry(2, 2)
    this.fogMesh = new THREE.Mesh(geometry, material)
    this.scene.add(this.fogMesh)

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.renderer.setSize(width, height, false)
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.pointerEvents = 'none'
    this.container.replaceChildren(this.renderer.domElement)
  }

  private rebuildClusters() {
    if (!this.fogUniforms) {
      return
    }

    this.clusters.length = 0
    const intensity = normalize(this.options.intensity)
    const clusterCount = Math.max(6, Math.min(MAX_NEBEL_CLUSTERS, Math.round(lerp(6, 8, intensity))))
    const slots = Array.from({ length: clusterCount }, (_, index) => index)
    shuffleArray(slots)

    for (let index = 0; index < clusterCount; index += 1) {
      const slot = slots[index]
      const xBase = clusterCount <= 1 ? 0.5 : slot / (clusterCount - 1)
      const x = clamp(0.06 + xBase * 0.88 + (Math.random() * 2 - 1) * 0.06, 0.06, 0.94)
      const y = clamp(0.12 + Math.random() * 0.74, 0.1, 0.9)
      const sizeX = lerp(0.26, 0.5, Math.random()) * lerp(1.02, 1.22, intensity)
      const sizeY = lerp(0.18, 0.38, Math.random()) * lerp(0.98, 1.16, intensity)
      const motion = new THREE.Vector4(
        lerp(0.44, 1.24, Math.random()),
        lerp(0.28, 1.08, Math.random()),
        Math.random() * Math.PI * 2,
        lerp(0.82, 1.34, Math.random()),
      )

      this.clusters.push({
        position: new THREE.Vector2(x, y),
        size: new THREE.Vector2(sizeX, sizeY),
        motion,
      })
    }

    for (let index = 0; index < MAX_NEBEL_CLUSTERS; index += 1) {
      const cluster = this.clusters[index]
      const clusterUniform = this.fogUniforms.uClusters.value[index]
      const motionUniform = this.fogUniforms.uClusterMotion.value[index]
      if (!cluster) {
        clusterUniform.set(0.5, 0.5, 0.24, 0.2)
        motionUniform.set(0.5, 0.5, 0, 0)
        continue
      }
      clusterUniform.set(cluster.position.x, cluster.position.y, cluster.size.x, cluster.size.y)
      motionUniform.copy(cluster.motion)
    }
    this.fogUniforms.uClusterCount.value = this.clusters.length
  }

  private applyPalette() {
    if (!this.scene || !this.renderer || !this.fogUniforms) {
      return
    }
    const palette = NEBEL_PALETTES[this.options.colorScheme]
    this.scene.background = new THREE.Color(palette.black)
    this.renderer.setClearColor(palette.black, 1)
    this.fogUniforms.uColorBlack.value.setHex(palette.black)
    this.fogUniforms.uColorLow.value.setHex(palette.low)
    this.fogUniforms.uColorMid.value.setHex(palette.mid)
    this.fogUniforms.uColorHigh.value.setHex(palette.high)
  }

  private readonly animate = () => {
    if (!this.renderer || !this.scene || !this.camera || !this.fogUniforms) {
      return
    }

    try {
      this.animationFrameId = window.requestAnimationFrame(this.animate)
      const deltaSeconds = clamp(this.clock.getDelta(), 1 / 144, 1 / 20)
      this.pulseBoost = Math.max(0, this.pulseBoost * Math.exp(-deltaSeconds * 1.4))
      this.fogUniforms.uTime.value += deltaSeconds
      this.fogUniforms.uIntensity.value = normalize(this.options.intensity)
      this.fogUniforms.uSpeed.value = normalize(this.options.speed)
      this.fogUniforms.uBrightness.value = normalize(this.options.brightness)
      this.fogUniforms.uPulse.value = this.pulseBoost
      this.fogUniforms.uDebugContrast.value = NEBEL_DEBUG_CONTRAST ? 1 : 0
      this.renderer.render(this.scene, this.camera)
    } catch (error) {
      this.stop()
      const runtimeError = error instanceof Error ? error : new Error('Nebel runtime failed')
      this.errorHandler?.(runtimeError)
    }
  }
}

function shuffleArray(values: number[]) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[values[index], values[swapIndex]] = [values[swapIndex], values[index]]
  }
}
