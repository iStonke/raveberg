import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

import type { ColorScheme, VisualizerPreset } from '../../../services/api'
import type { VisualizerRuntimeController, VisualizerRuntimeOptions } from './runtimeTypes'
import { clamp, lerp, normalize, smoothstep } from './runtimeUtils'

export type CubePreset = Extract<VisualizerPreset, 'retro_cube'>

const CUBE_PRESETS = new Set<CubePreset>(['retro_cube'])
const CUBE_LOCAL_CORNERS = [
  new THREE.Vector3(-0.5, -0.5, -0.5),
  new THREE.Vector3(0.5, -0.5, -0.5),
  new THREE.Vector3(-0.5, 0.5, -0.5),
  new THREE.Vector3(0.5, 0.5, -0.5),
  new THREE.Vector3(-0.5, -0.5, 0.5),
  new THREE.Vector3(0.5, -0.5, 0.5),
  new THREE.Vector3(-0.5, 0.5, 0.5),
  new THREE.Vector3(0.5, 0.5, 0.5),
]
const MAX_CUBE_TRAIL = 8

interface TrailSample {
  position: THREE.Vector3
  rotation: THREE.Vector3
  scale: THREE.Vector3
}

interface CubePalette {
  variant: 'classic_cube' | 'neon_cube' | 'chrome_cube' | 'rainbow_cube'
  background: number
  fog: number
  ambient: number
  keyLight: number
  fillLight: number
  aura: [number, number]
  edge: number
  faceColors: number[]
  metalness: number
  roughness: number
  emissive: number
}

const CUBE_PALETTES: Record<ColorScheme, CubePalette> = {
  mono: {
    variant: 'classic_cube',
    background: 0x04070d,
    fog: 0x0b1118,
    ambient: 0xe6ecff,
    keyLight: 0xc4d2ff,
    fillLight: 0x7fa8d8,
    aura: [0x1b3152, 0x132033],
    edge: 0xe8f2ff,
    faceColors: [0xff5252, 0x45a3ff, 0xffd34a, 0x62e36d, 0x6ef1ff, 0xc874ff],
    metalness: 0.34,
    roughness: 0.46,
    emissive: 0.12,
  },
  acid: {
    variant: 'neon_cube',
    background: 0x03070a,
    fog: 0x0a1217,
    ambient: 0xf0fff0,
    keyLight: 0xe2ff61,
    fillLight: 0x2cf5ff,
    aura: [0x163d39, 0x131d28],
    edge: 0xe0ff84,
    faceColors: [0x9cff47, 0x22d7ff, 0xffef4d, 0xff8c30, 0xff54de, 0x53ff9f],
    metalness: 0.2,
    roughness: 0.32,
    emissive: 0.2,
  },
  ultraviolet: {
    variant: 'chrome_cube',
    background: 0x030611,
    fog: 0x0a1120,
    ambient: 0xf3f2ff,
    keyLight: 0x8bb1ff,
    fillLight: 0x6cf8ff,
    aura: [0x251d58, 0x141826],
    edge: 0xb8e6ff,
    faceColors: [0x9b7dff, 0x56ccff, 0xff6ef8, 0xb0caff, 0x7af9ff, 0xff7b6f],
    metalness: 0.72,
    roughness: 0.18,
    emissive: 0.15,
  },
  redline: {
    variant: 'rainbow_cube',
    background: 0x060507,
    fog: 0x150d10,
    ambient: 0xffefe2,
    keyLight: 0xffb455,
    fillLight: 0xff4f70,
    aura: [0x4d1a1e, 0x22141d],
    edge: 0xffd6b2,
    faceColors: [0xff5b5b, 0xffa23a, 0xffdf4f, 0x5bc4ff, 0xb76cff, 0x69f07f],
    metalness: 0.28,
    roughness: 0.38,
    emissive: 0.13,
  },
}

export function isCubeVisualizerPreset(preset: string): preset is CubePreset {
  return CUBE_PRESETS.has(preset as CubePreset)
}

export class CubeVisualizerRuntime implements VisualizerRuntimeController {
  private container: HTMLElement | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private trailGroup: THREE.Group | null = null
  private cubeGroup: THREE.Group | null = null
  private cubeMesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial[]> | null = null
  private auraLayer: HTMLDivElement | null = null
  private ambientLight: THREE.AmbientLight | null = null
  private keyLight: THREE.PointLight | null = null
  private fillLight: THREE.PointLight | null = null
  private animationFrameId = 0
  private readonly clock = new THREE.Clock()
  private options: VisualizerRuntimeOptions
  private errorHandler: ((error: Error) => void) | null = null
  private readonly preset: CubePreset
  private position = new THREE.Vector3()
  private velocity = new THREE.Vector3()
  private targetVelocity = new THREE.Vector3()
  private rotationVelocity = new THREE.Vector3()
  private targetRotationVelocity = new THREE.Vector3()
  private bounceStretch = new THREE.Vector3(1, 1, 1)
  private readonly restStretch = new THREE.Vector3(1, 1, 1)
  private readonly projectedCorner = new THREE.Vector3()
  private readonly savedCubePosition = new THREE.Vector3()
  private readonly trailMeshes: Array<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial[]>> = []
  private readonly trailMaterialSets: THREE.MeshBasicMaterial[][] = []
  private readonly trailSamples: TrailSample[] = []
  private trailSampleClock = 0
  private trailVisibilityTime = 0
  private trailBounceBoost = 0
  private bounceGlow = 0
  private eventBoost = 0
  private readonly materials: THREE.MeshStandardMaterial[] = []

  constructor(preset: CubePreset) {
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
    this.setupScene()
    this.resetCubeState()
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
  }

  updateOptions(partialOptions: Partial<VisualizerRuntimeOptions>) {
    this.options = { ...this.options, ...partialOptions }
    this.applyPalette()
    this.applyCubeScale()
  }

  triggerEvent(name: string) {
    if (name === 'mode_change' || name === 'upload_created') {
      this.eventBoost = Math.min(1, this.eventBoost + 0.65)
      this.targetRotationVelocity.multiplyScalar(1.06)
      this.targetVelocity.multiplyScalar(1.03)
      this.bounceGlow = Math.max(this.bounceGlow, 0.75)
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
      46,
      Math.max(1, this.container.clientWidth) / Math.max(1, this.container.clientHeight),
      0.1,
      300,
    )
    this.camera.position.set(0, 0, 24)
    this.camera.lookAt(0, 0, 0)

    this.trailGroup = new THREE.Group()
    this.scene.add(this.trailGroup)

    this.cubeGroup = new THREE.Group()
    this.scene.add(this.cubeGroup)

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    this.keyLight = new THREE.PointLight(0xffffff, 2.2, 120, 2)
    this.keyLight.position.set(14, 12, 16)
    this.fillLight = new THREE.PointLight(0xffffff, 1.4, 140, 2)
    this.fillLight.position.set(-18, -14, 20)
    this.scene.add(this.ambientLight, this.keyLight, this.fillLight)

    const boxGeometry = new RoundedBoxGeometry(1, 1, 1, 4, 0.16)
    const materials = Array.from({ length: 6 }, () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.18,
        metalness: 0.24,
        roughness: 0.42,
      }),
    )
    this.materials.push(...materials)
    this.cubeMesh = new THREE.Mesh(boxGeometry, materials)
    this.cubeGroup.add(this.cubeMesh)
    this.createTrailMeshes(boxGeometry)

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
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

    this.createAuraLayer()
    this.applyPalette()
    this.applyCubeScale()
  }

  private createAuraLayer() {
    if (!this.container || this.auraLayer) {
      return
    }
    const layer = document.createElement('div')
    layer.className = 'retro-cube-aura'
    Object.assign(layer.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      mixBlendMode: 'screen',
      opacity: '0.82',
      willChange: 'opacity, transform, background',
    })
    this.container.appendChild(layer)
    this.auraLayer = layer
  }

  private resetCubeState() {
    this.position.set(0, 0, 0)
    this.targetVelocity.set(0.18, 0.13, 0).normalize().multiplyScalar(this.movementSpeed)
    this.velocity.copy(this.targetVelocity)
    this.targetRotationVelocity.set(0.82, 1.02, 0.64)
    this.rotationVelocity.copy(this.targetRotationVelocity)
    this.bounceStretch.set(1, 1, 1)
    this.trailSampleClock = 0
    this.trailVisibilityTime = 0
    this.trailBounceBoost = 0
    this.bounceGlow = 0
    this.eventBoost = 0
    this.trailSamples.length = 0
    this.applyCubeScale()
    if (this.cubeGroup) {
      this.cubeGroup.position.copy(this.position)
      this.cubeGroup.rotation.set(0.55, 0.35, 0.14)
    }
    this.updateTrail(true)
  }

  private disposeScene() {
    this.auraLayer?.remove()
    this.auraLayer = null
    this.trailMaterialSets.forEach((set) => set.forEach((material) => material.dispose()))
    this.trailMaterialSets.length = 0
    this.trailMeshes.length = 0
    this.trailSamples.length = 0
    this.trailGroup?.clear()
    this.trailGroup?.removeFromParent()
    this.trailGroup = null
    this.cubeMesh?.geometry.dispose()
    this.materials.forEach((material) => material.dispose())
    this.materials.length = 0
    this.cubeMesh = null
    this.cubeGroup?.clear()
    this.cubeGroup?.removeFromParent()
    this.cubeGroup = null
    this.scene = null
    this.camera = null
    this.ambientLight = null
    this.keyLight = null
    this.fillLight = null
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

  private readonly animate = () => {
    if (!this.renderer || !this.scene || !this.camera || !this.cubeGroup) {
      return
    }

    try {
      this.animationFrameId = window.requestAnimationFrame(this.animate)
      const deltaSeconds = clamp(this.clock.getDelta(), 1 / 120, 1 / 20)
      this.eventBoost = Math.max(0, this.eventBoost * Math.exp(-deltaSeconds * 1.8))
      this.bounceGlow = Math.max(0, this.bounceGlow * Math.exp(-deltaSeconds * 3.2))
      this.trailBounceBoost = Math.max(0, this.trailBounceBoost * Math.exp(-deltaSeconds * 2.4))
      this.trailSampleClock += deltaSeconds
      this.trailVisibilityTime += deltaSeconds
      this.bounceStretch.lerp(this.restStretch, 1 - Math.exp(-deltaSeconds * 5.2))
      this.velocity.lerp(this.targetVelocity, 1 - Math.exp(-deltaSeconds * 6.5))
      this.rotationVelocity.lerp(this.targetRotationVelocity, 1 - Math.exp(-deltaSeconds * 4.2))

      const previousPosition = this.position.clone()
      this.position.addScaledVector(this.velocity, deltaSeconds)

      const rotationBoost = 1 + this.eventBoost * 0.4
      this.cubeGroup.rotation.x += this.rotationVelocity.x * deltaSeconds * rotationBoost
      this.cubeGroup.rotation.y += this.rotationVelocity.y * deltaSeconds * rotationBoost
      this.cubeGroup.rotation.z += this.rotationVelocity.z * deltaSeconds * rotationBoost

      const squashScale = this.baseCubeScale
      this.cubeGroup.scale.set(
        squashScale * this.bounceStretch.x,
        squashScale * this.bounceStretch.y,
        squashScale * this.bounceStretch.z,
      )
      this.cubeGroup.position.copy(this.position)
      this.handleBounces(previousPosition)
      this.cubeGroup.position.copy(this.position)
      this.cubeGroup.scale.set(
        squashScale * this.bounceStretch.x,
        squashScale * this.bounceStretch.y,
        squashScale * this.bounceStretch.z,
      )

      const orbit = performance.now() * 0.00018
      this.camera.position.x = Math.sin(orbit) * 1.4
      this.camera.position.y = Math.cos(orbit * 0.8) * 0.9
      this.camera.lookAt(0, 0, 0)
      this.updateTrail()
      this.updateAura()
      this.updateLighting()

      this.renderer.render(this.scene, this.camera)
    } catch (error) {
      this.stop()
      const runtimeError = error instanceof Error ? error : new Error('Retro cube runtime failed')
      this.errorHandler?.(runtimeError)
    }
  }

  private handleBounces(previousPosition: THREE.Vector3) {
    const limit = this.boundsLimit
    const nextStretch = new THREE.Vector3(1, 1, 1)
    let bounced = false

    if (Math.abs(this.position.x) >= limit.x) {
      this.position.x = Math.sign(this.position.x || 1) * limit.x
      this.targetVelocity.x *= -1
      this.velocity.x = this.targetVelocity.x * 0.82
      nextStretch.set(0.92, 1.05, 1.05)
      bounced = true
    }
    if (Math.abs(this.position.y) >= limit.y) {
      this.position.y = Math.sign(this.position.y || 1) * limit.y
      this.targetVelocity.y *= -1
      this.velocity.y = this.targetVelocity.y * 0.82
      nextStretch.set(1.05, 0.92, 1.05)
      bounced = true
    }
    const projectedBounds = this.getProjectedBoundsAt(this.position)
    if (projectedBounds) {
      if (projectedBounds.maxX > 1) {
        this.position.x = this.findAxisFit('x', previousPosition.x, 0, (bounds) => bounds.maxX <= 1)
        this.targetVelocity.x = -Math.abs(this.targetVelocity.x)
        this.velocity.x = this.targetVelocity.x * 0.82
        nextStretch.set(0.92, 1.05, 1.05)
        bounced = true
      } else if (projectedBounds.minX < -1) {
        this.position.x = this.findAxisFit('x', previousPosition.x, 0, (bounds) => bounds.minX >= -1)
        this.targetVelocity.x = Math.abs(this.targetVelocity.x)
        this.velocity.x = this.targetVelocity.x * 0.82
        nextStretch.set(0.92, 1.05, 1.05)
        bounced = true
      }

      const horizontalAdjustedBounds = this.getProjectedBoundsAt(this.position)
      if (horizontalAdjustedBounds?.maxY != null && horizontalAdjustedBounds.maxY > 1) {
        this.position.y = this.findAxisFit('y', previousPosition.y, 0, (bounds) => bounds.maxY <= 1)
        this.targetVelocity.y = -Math.abs(this.targetVelocity.y)
        this.velocity.y = this.targetVelocity.y * 0.82
        nextStretch.set(1.05, 0.92, 1.05)
        bounced = true
      } else if (horizontalAdjustedBounds?.minY != null && horizontalAdjustedBounds.minY < -1) {
        this.position.y = this.findAxisFit('y', previousPosition.y, 0, (bounds) => bounds.minY >= -1)
        this.targetVelocity.y = Math.abs(this.targetVelocity.y)
        this.velocity.y = this.targetVelocity.y * 0.82
        nextStretch.set(1.05, 0.92, 1.05)
        bounced = true
      }

    }

    if (!bounced) {
      return
    }

    this.targetRotationVelocity.x = lerp(this.targetRotationVelocity.x, 0.72 + Math.random() * 0.65, 0.2)
    this.targetRotationVelocity.y = lerp(this.targetRotationVelocity.y, 0.74 + Math.random() * 0.68, 0.2)
    this.targetRotationVelocity.z = lerp(this.targetRotationVelocity.z, 0.42 + Math.random() * 0.46, 0.2)
    this.targetVelocity.z = 0
    this.velocity.z = 0
    this.targetVelocity.normalize().multiplyScalar(this.movementSpeed * (1 + this.eventBoost * 0.05))
    this.bounceStretch.copy(nextStretch)
    this.bounceGlow = Math.min(1, this.bounceGlow + 0.62)
    this.trailBounceBoost = Math.min(1, this.trailBounceBoost + lerp(0.24, 0.52, Math.random()))
  }

  private createTrailMeshes(sharedGeometry: THREE.BufferGeometry) {
    if (!this.trailGroup) {
      return
    }

    for (let index = 0; index < MAX_CUBE_TRAIL; index += 1) {
      const materials = Array.from({ length: 6 }, () =>
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          toneMapped: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const mesh = new THREE.Mesh(sharedGeometry, materials)
      mesh.visible = false
      this.trailMaterialSets.push(materials)
      this.trailMeshes.push(mesh)
      this.trailGroup.add(mesh)
    }
  }

  private updateTrail(force = false) {
    if (!this.cubeGroup || !this.trailMeshes.length) {
      return
    }

    if (force || this.trailSamples.length === 0 || this.trailSampleClock >= 0.028) {
      this.trailSamples.push({
        position: this.position.clone(),
        rotation: new THREE.Vector3(this.cubeGroup.rotation.x, this.cubeGroup.rotation.y, this.cubeGroup.rotation.z),
        scale: this.cubeGroup.scale.clone(),
      })
      if (this.trailSamples.length > MAX_CUBE_TRAIL) {
        this.trailSamples.shift()
      }
      this.trailSampleClock = 0
    }

    const t = this.trailVisibilityTime
    const organicWave = 0.36
      + Math.sin(t * 0.52) * 0.24
      + Math.cos(t * 0.23 + 0.8) * 0.16
      + Math.sin(t * 0.11 + 2.3) * 0.1
    const fadeWindow = smoothstep(clamp((organicWave - 0.14) / 0.24, 0, 1))
    const organicVisibility = clamp(Math.pow(fadeWindow, 1.4) * 0.96, 0, 0.96)
    const motionVisibility = clamp(this.velocity.length() / Math.max(0.001, this.movementSpeed) - 0.9, 0, 0.22)
    const trailVisibilityFactor = clamp(
      organicVisibility + motionVisibility * 0.24 + this.trailBounceBoost * 0.42,
      0,
      1,
    )

    this.trailMeshes.forEach((mesh, index) => {
      const sample = this.trailSamples[this.trailSamples.length - 1 - index]
      if (!sample) {
        mesh.visible = false
        return
      }

      const normalized = 1 - index / Math.max(1, MAX_CUBE_TRAIL - 1)
      const segmentVariance = clamp(
        lerp(0.88, 1.04, normalized) + Math.sin(t * (0.42 + index * 0.05) + index * 0.7) * (0.02 + (1 - normalized) * 0.035),
        0.72,
        1.08,
      )
      const opacity = (lerp(0.045, 0.24, Math.pow(normalized, 1.15)) + this.bounceGlow * 0.045)
        * trailVisibilityFactor
        * segmentVariance
      mesh.visible = opacity > 0.006
      mesh.position.copy(sample.position)
      mesh.rotation.set(sample.rotation.x, sample.rotation.y, sample.rotation.z)
      mesh.scale.copy(sample.scale).multiplyScalar(lerp(0.88, 0.98, normalized))

      this.trailMaterialSets[index]?.forEach((material) => {
        material.opacity = clamp(opacity, 0, 0.28)
      })
    })
  }

  private getProjectedBoundsAt(position: THREE.Vector3) {
    if (!this.camera || !this.cubeGroup) {
      return null
    }

    this.savedCubePosition.copy(this.cubeGroup.position)
    this.cubeGroup.position.copy(position)
    this.cubeGroup.updateMatrixWorld(true)

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    CUBE_LOCAL_CORNERS.forEach((corner) => {
      this.projectedCorner.copy(corner).applyMatrix4(this.cubeGroup!.matrixWorld).project(this.camera!)
      minX = Math.min(minX, this.projectedCorner.x)
      maxX = Math.max(maxX, this.projectedCorner.x)
      minY = Math.min(minY, this.projectedCorner.y)
      maxY = Math.max(maxY, this.projectedCorner.y)
    })

    this.cubeGroup.position.copy(this.savedCubePosition)
    this.cubeGroup.updateMatrixWorld(true)

    return { minX, maxX, minY, maxY }
  }

  private findAxisFit(
    axis: 'x' | 'y' | 'z',
    previousValue: number,
    fallbackValue: number,
    fits: (bounds: { minX: number; maxX: number; minY: number; maxY: number }) => boolean,
  ) {
    const currentValue = this.position[axis]
    let safeValue = previousValue
    let safeBounds = this.getProjectedBoundsAt(this.position.clone().setComponent(axis === 'x' ? 0 : axis === 'y' ? 1 : 2, safeValue))

    if (!safeBounds || !fits(safeBounds)) {
      safeValue = fallbackValue
      safeBounds = this.getProjectedBoundsAt(this.position.clone().setComponent(axis === 'x' ? 0 : axis === 'y' ? 1 : 2, safeValue))
    }

    if (!safeBounds || !fits(safeBounds)) {
      return safeValue
    }

    let low = Math.min(currentValue, safeValue)
    let high = Math.max(currentValue, safeValue)
    let best = safeValue

    for (let iteration = 0; iteration < 18; iteration += 1) {
      const mid = (low + high) * 0.5
      const candidate = this.position.clone()
      candidate.setComponent(axis === 'x' ? 0 : axis === 'y' ? 1 : 2, mid)
      const bounds = this.getProjectedBoundsAt(candidate)
      if (bounds && fits(bounds)) {
        best = mid
        if (currentValue > safeValue) {
          low = mid
        } else {
          high = mid
        }
      } else if (currentValue > safeValue) {
        high = mid
      } else {
        low = mid
      }
    }

    return best
  }

  private applyPalette() {
    if (!this.scene || !this.ambientLight || !this.keyLight || !this.fillLight) {
      return
    }

    const brightness = normalize(this.options.brightness)
    const palette = this.palette
    this.scene.background = new THREE.Color(palette.background)
    this.scene.fog = new THREE.FogExp2(palette.fog, lerp(0.028, 0.017, brightness))
    this.ambientLight.color.setHex(palette.ambient)
    this.ambientLight.intensity = 0.52 + brightness * 0.48
    this.keyLight.color.setHex(palette.keyLight)
    this.fillLight.color.setHex(palette.fillLight)

    this.materials.forEach((material, index) => {
      const color = palette.faceColors[index] ?? palette.faceColors[0]
      material.color.setHex(color)
      material.emissive.setHex(color)
      material.metalness = palette.metalness
      material.roughness = palette.roughness
      material.emissiveIntensity = palette.emissive + brightness * 0.16 + this.bounceGlow * 0.12
      material.needsUpdate = true
    })

    this.trailMaterialSets.forEach((set) => {
      set.forEach((material, index) => {
        material.color.setHex(palette.faceColors[index] ?? palette.faceColors[0])
      })
    })
    this.updateAura()
    this.updateLighting()
  }

  private applyCubeScale() {
    if (!this.cubeGroup) {
      return
    }
    const scale = this.baseCubeScale
    this.cubeGroup.scale.setScalar(scale)
  }

  private updateLighting() {
    if (!this.keyLight || !this.fillLight) {
      return
    }
    const brightness = normalize(this.options.brightness)
    const pulse = this.bounceGlow * 0.35 + this.eventBoost * 0.18
    this.keyLight.intensity = 1.5 + brightness * 1.8 + pulse
    this.fillLight.intensity = 0.9 + brightness * 1.15 + pulse * 0.7
  }

  private updateAura() {
    if (!this.auraLayer) {
      return
    }
    const palette = this.palette
    const brightness = normalize(this.options.brightness)
    const glowAlpha = 0.1 + brightness * 0.08 + this.bounceGlow * 0.12 + this.eventBoost * 0.08
    const outerAlpha = 0.05 + brightness * 0.04
    this.auraLayer.style.background = [
      `radial-gradient(circle at 50% 50%, ${hexToRgba(palette.aura[0], glowAlpha)} 0%, rgba(0,0,0,0) 28%)`,
      `radial-gradient(circle at 50% 50%, ${hexToRgba(palette.aura[1], outerAlpha)} 0%, rgba(0,0,0,0) 58%)`,
      'linear-gradient(180deg, rgba(3,6,12,0.14), rgba(2,4,8,0.38))',
    ].join(',')
    this.auraLayer.style.opacity = `${(0.78 + this.bounceGlow * 0.08).toFixed(3)}`
    this.auraLayer.style.transform = `scale(${(1 + this.bounceGlow * 0.04 + this.eventBoost * 0.03).toFixed(4)})`
  }

  private get movementSpeed() {
    const speed = normalize(this.options.speed)
    return lerp(4.5, 10.2, speed)
  }

  private get boundsLimit() {
    if (this.camera) {
      const distance = Math.max(8, Math.abs(this.camera.position.z - this.position.z))
      const halfFovRadians = THREE.MathUtils.degToRad(this.camera.fov * 0.5)
      const halfVisibleHeight = Math.tan(halfFovRadians) * distance
      const halfVisibleWidth = halfVisibleHeight * this.camera.aspect
      const cubeRadius = this.baseCubeScale * 0.56
      const xLimit = Math.max(cubeRadius, halfVisibleWidth - cubeRadius * 0.18)
      const yLimit = Math.max(cubeRadius, halfVisibleHeight - cubeRadius * 0.18)
      const depth = lerp(6.6, 9.4, normalize(this.options.intensity))
      return new THREE.Vector3(xLimit, yLimit, depth)
    }

    const intensity = normalize(this.options.intensity)
    const depth = lerp(5.4, 7.8, intensity)
    const lateral = lerp(7.4, 9.8, intensity)
    return new THREE.Vector3(lateral, lateral * 0.56, depth)
  }

  private get baseCubeScale() {
    const intensity = normalize(this.options.intensity)
    return lerp(2.4, 3.5, intensity)
  }

  private get palette() {
    return CUBE_PALETTES[this.options.colorScheme]
  }
}

function hexToRgba(color: number, alpha: number) {
  const red = (color >> 16) & 255
  const green = (color >> 8) & 255
  const blue = color & 255
  return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`
}
