import * as THREE from 'three'

import type { ColorScheme, VisualizerPreset } from '../../../services/api'
import type { VisualizerRuntimeController, VisualizerRuntimeOptions } from './runtimeTypes'
import { clamp, lerp, normalize, smoothstep } from './runtimeUtils'

export type PipesPreset = Extract<VisualizerPreset, 'retro_pipes'>

const PIPES_PRESETS = new Set<PipesPreset>(['retro_pipes'])
const WORLD_CENTER = new THREE.Vector3()
const GRID_DIRECTIONS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
] as const
const OPPOSITE_DIRECTIONS = [1, 0, 3, 2, 5, 4] as const

interface PipePalette {
  variant: 'classic_pipes' | 'neon_pipes' | 'chrome_pipes'
  background: number
  fog: number
  ambient: number
  keyLight: number
  rimLight: number
  pipeColors: number[]
  metalness: number
  roughness: number
  emissiveStrength: number
}

interface PipeBuilder {
  gridPosition: THREE.Vector3
  directionIndex: number
  straightStepsRemaining: number
  breakoutStepsRemaining: number
  speedMultiplier: number
  colorIndex: number
  colorSegmentsRemaining: number
  accumulator: number
}

interface PipeMeshEntry {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
}

interface GrowingSegment {
  mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>
  start: THREE.Vector3
  direction: THREE.Vector3
  length: number
  progress: number
  speed: number
}

const PIPE_PALETTES: Record<ColorScheme, PipePalette> = {
  mono: {
    variant: 'classic_pipes',
    background: 0x020304,
    fog: 0x06080b,
    ambient: 0xe7edf2,
    keyLight: 0xffffff,
    rimLight: 0xa0b3c2,
    pipeColors: [0xd9dde2, 0x4e86d9, 0x3fb7a8, 0xc98a2e],
    metalness: 0.56,
    roughness: 0.3,
    emissiveStrength: 0.02,
  },
  acid: {
    variant: 'classic_pipes',
    background: 0x020405,
    fog: 0x071015,
    ambient: 0xe9f1f2,
    keyLight: 0xf2fbff,
    rimLight: 0x83b9c7,
    pipeColors: [0x2fc2cf, 0xf0b03b, 0x8dd36a, 0xcfd6dc],
    metalness: 0.48,
    roughness: 0.28,
    emissiveStrength: 0.03,
  },
  ultraviolet: {
    variant: 'chrome_pipes',
    background: 0x020305,
    fog: 0x060910,
    ambient: 0xe8ecf2,
    keyLight: 0xf4f8ff,
    rimLight: 0x8db3d8,
    pipeColors: [0xbfc8d2, 0x6f78d8, 0x54b8d6, 0xd38b3f],
    metalness: 0.72,
    roughness: 0.18,
    emissiveStrength: 0.015,
  },
  redline: {
    variant: 'classic_pipes',
    background: 0x040304,
    fog: 0x0a0809,
    ambient: 0xf2ece5,
    keyLight: 0xfff5ed,
    rimLight: 0xbbaea3,
    pipeColors: [0xc96c34, 0x5f97d8, 0xd8dcd9, 0x8cab4a],
    metalness: 0.5,
    roughness: 0.32,
    emissiveStrength: 0.025,
  },
}

export function isPipesVisualizerPreset(preset: string): preset is PipesPreset {
  return PIPES_PRESETS.has(preset as PipesPreset)
}

export class PipesVisualizerRuntime implements VisualizerRuntimeController {
  private container: HTMLElement | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private pipesGroup: THREE.Group | null = null
  private ambientLight: THREE.AmbientLight | null = null
  private keyLight: THREE.DirectionalLight | null = null
  private rimLight: THREE.PointLight | null = null
  private animationFrameId = 0
  private options: VisualizerRuntimeOptions
  private errorHandler: ((error: Error) => void) | null = null
  private readonly preset: PipesPreset
  private readonly clock = new THREE.Clock()
  private readonly occupiedCells = new Set<string>()
  private readonly occupiedEdges = new Set<string>()
  private readonly layerUsageX = new Map<number, number>()
  private readonly layerUsageY = new Map<number, number>()
  private readonly layerUsageZ = new Map<number, number>()
  private readonly octantUsage = new Map<string, number>()
  private readonly meshes: PipeMeshEntry[] = []
  private readonly materials = new Set<THREE.MeshStandardMaterial>()
  private readonly growingSegments: GrowingSegment[] = []
  private readonly tempVector = new THREE.Vector3()
  private readonly tempVectorB = new THREE.Vector3()
  private readonly tempGridVector = new THREE.Vector3()
  private readonly tempQuaternion = new THREE.Quaternion()
  private readonly unitUp = new THREE.Vector3(0, 1, 0)
  private segmentGeometry = new THREE.CylinderGeometry(1, 1, 1, 16, 1, false)
  private jointGeometry = new THREE.SphereGeometry(1, 18, 16)
  private fadeProgress = 0
  private fadeDirection: 'idle' | 'out' = 'idle'
  private segmentCount = 0
  private elapsedSeconds = 0
  private eventBoost = 0
  private activeBuilder: PipeBuilder | null = null

  constructor(preset: PipesPreset) {
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
    this.resetWorld()
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
    this.disposeWorld()
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
    this.applyVisualStyle()
  }

  triggerEvent(name: string) {
    if (name === 'mode_change' || name === 'upload_created') {
      this.eventBoost = Math.min(1.2, this.eventBoost + 0.55)
      if (this.activeBuilder) {
        this.activeBuilder.accumulator += 0.75
      }
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
      52,
      Math.max(1, this.container.clientWidth) / Math.max(1, this.container.clientHeight),
      0.1,
      600,
    )
    this.pipesGroup = new THREE.Group()
    this.scene.add(this.pipesGroup)

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.4)
    this.keyLight.position.set(1.4, 1.8, 1.2)
    this.rimLight = new THREE.PointLight(0xffffff, 0.9, 220, 2)
    this.rimLight.position.set(-28, 26, 34)

    this.scene.add(this.ambientLight, this.keyLight, this.rimLight)
    this.scene.fog = new THREE.FogExp2(0x03060b, 0.0038)

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
    this.applyVisualStyle()
  }

  private applyVisualStyle() {
    if (!this.scene || !this.renderer || !this.ambientLight || !this.keyLight || !this.rimLight) {
      return
    }

    const palette = this.palette
    const brightness = normalize(this.options.brightness)
    const lightBoost = 0.72 + brightness * 0.46

    this.scene.background = new THREE.Color(palette.background)
    this.scene.fog = new THREE.FogExp2(palette.fog, lerp(0.0042, 0.003, brightness))
    this.renderer.setClearColor(palette.background, 1)
    this.ambientLight.color.setHex(palette.ambient)
    this.ambientLight.intensity = 0.38 + lightBoost * 0.22
    this.keyLight.color.setHex(palette.keyLight)
    this.keyLight.intensity = 0.94 + lightBoost * 0.52
    this.keyLight.position.set(1.2, 1.9, 1.3)
    this.rimLight.color.setHex(palette.rimLight)
    this.rimLight.intensity = 0.28 + lightBoost * 0.22
    this.rimLight.position.set(-24, 18, 20)

    const emissiveBoost = palette.emissiveStrength + brightness * 0.04
    this.materials.forEach((material) => {
      material.metalness = palette.metalness
      material.roughness = palette.roughness
      material.emissiveIntensity = emissiveBoost
      material.needsUpdate = true
    })
  }

  private resetWorld() {
    this.disposeWorld()
    this.fadeProgress = 0
    this.fadeDirection = 'idle'
    this.segmentCount = 0
    this.elapsedSeconds = 0
    this.eventBoost = 0
    this.spawnBuilder()
  }

  private disposeWorld() {
    this.growingSegments.forEach((segment) => {
      segment.mesh.removeFromParent()
    })
    this.growingSegments.length = 0
    this.activeBuilder = null
    this.occupiedCells.clear()
    this.occupiedEdges.clear()
    this.layerUsageX.clear()
    this.layerUsageY.clear()
    this.layerUsageZ.clear()
    this.octantUsage.clear()
    this.meshes.forEach(({ mesh }) => mesh.removeFromParent())
    this.meshes.length = 0
    this.materials.forEach((material) => material.dispose())
    this.materials.clear()
    this.pipesGroup?.clear()
  }

  private disposeRenderer() {
    this.disposeWorld()
    this.segmentGeometry.dispose()
    this.jointGeometry.dispose()
    if (this.renderer) {
      this.renderer.dispose()
      this.renderer.forceContextLoss?.()
      this.renderer.domElement.remove()
    }
    this.renderer = null
    this.scene = null
    this.camera = null
    this.pipesGroup = null
    this.ambientLight = null
    this.keyLight = null
    this.rimLight = null
  }

  private readonly animate = () => {
    if (!this.renderer || !this.scene || !this.camera || !this.pipesGroup) {
      return
    }

    try {
      this.animationFrameId = window.requestAnimationFrame(this.animate)
      const deltaSeconds = clamp(this.clock.getDelta(), 1 / 120, 1 / 20)
      this.elapsedSeconds += deltaSeconds
      this.eventBoost = Math.max(0, this.eventBoost * Math.exp(-deltaSeconds * 1.2))

      this.advanceBuilders(deltaSeconds)
      this.advanceGrowingSegments(deltaSeconds)
      this.advanceFade(deltaSeconds)
      this.updateCamera()
      this.renderer.render(this.scene, this.camera)
    } catch (error) {
      this.stop()
      const runtimeError = error instanceof Error ? error : new Error('Pipes runtime failed')
      this.errorHandler?.(runtimeError)
    }
  }

  private advanceBuilders(deltaSeconds: number) {
    if (this.fadeDirection === 'idle' && this.occupiedCells.size >= this.targetOccupiedCells) {
      this.fadeDirection = 'out'
      this.fadeProgress = 0
      return
    }

    const baseGrowth = lerp(1.1, 5.2, normalize(this.options.intensity)) + normalize(this.options.speed) * 1.7
    const boost = 1 + this.eventBoost * 0.9

    if (!this.activeBuilder) {
      if (!this.growingSegments.length && this.fadeDirection === 'idle') {
        this.fadeDirection = 'out'
        this.fadeProgress = 0
      }
      return
    }

    this.activeBuilder.accumulator += deltaSeconds * baseGrowth * this.activeBuilder.speedMultiplier * boost

    let safety = 0
    while (this.activeBuilder && this.activeBuilder.accumulator >= 1 && safety < 4 && this.fadeDirection === 'idle') {
      this.activeBuilder.accumulator -= 1
      const advanced = this.extendBuilder(this.activeBuilder)
      if (!advanced) {
        this.activeBuilder = null
        break
      }
      safety += 1
    }
  }

  private advanceGrowingSegments(deltaSeconds: number) {
    for (let index = this.growingSegments.length - 1; index >= 0; index -= 1) {
      const segment = this.growingSegments[index]
      segment.progress = Math.min(1, segment.progress + deltaSeconds * segment.speed)
      const scaledLength = segment.length * segment.progress
      segment.mesh.scale.set(this.pipeRadius, Math.max(0.08, scaledLength), this.pipeRadius)
      segment.mesh.position.copy(segment.start).addScaledVector(segment.direction, scaledLength * 0.5)
      if (segment.progress >= 1) {
        this.growingSegments.splice(index, 1)
      }
    }
  }

  private advanceFade(deltaSeconds: number) {
    if (this.fadeDirection !== 'out') {
      return
    }

    const fadeSeconds = lerp(2.5, 1.6, normalize(this.options.intensity))
    this.fadeProgress = Math.min(1, this.fadeProgress + deltaSeconds / fadeSeconds)
    const opacity = 1 - smoothstep(this.fadeProgress)
    this.materials.forEach((material) => {
      material.opacity = opacity
      material.transparent = opacity < 0.995
      material.needsUpdate = true
    })

    if (this.fadeProgress >= 1) {
      this.resetWorld()
      this.applyVisualStyle()
    }
  }

  private updateCamera() {
    if (!this.camera || !this.rimLight) {
      return
    }

    const intensity = normalize(this.options.intensity)
    const orbitRadius = lerp(56, 44, intensity)
    const cameraHeight = lerp(28, 34, normalize(this.options.brightness))
    this.camera.position.set(
      orbitRadius,
      cameraHeight,
      orbitRadius * 0.82,
    )
    this.camera.lookAt(WORLD_CENTER.x, WORLD_CENTER.y, WORLD_CENTER.z)
    this.rimLight.position.set(-24, 18, 20)
  }

  private spawnBuilder() {
    const attempts = 36
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const gridPosition = new THREE.Vector3(
        randomInt(-this.gridExtent, this.gridExtent),
        randomInt(-this.gridExtent, this.gridExtent),
        randomInt(-this.gridExtent, this.gridExtent),
      )
      const boundaryAxis = randomInt(0, 2)
      if (boundaryAxis === 0) {
        gridPosition.x = Math.random() > 0.5 ? this.gridExtent : -this.gridExtent
      } else if (boundaryAxis === 1) {
        gridPosition.y = Math.random() > 0.5 ? this.gridExtent : -this.gridExtent
      } else {
        gridPosition.z = Math.random() > 0.5 ? this.gridExtent : -this.gridExtent
      }
      const cellKey = this.cellKey(gridPosition)
      if (this.occupiedCells.has(cellKey)) {
        continue
      }

      const directionIndex = this.initialDirectionIndex(gridPosition)
      this.markCellOccupied(gridPosition)
      this.activeBuilder = {
        gridPosition,
        directionIndex,
        straightStepsRemaining: randomInt(8, 16),
        breakoutStepsRemaining: randomInt(6, 12),
        speedMultiplier: lerp(0.9, 1.12, Math.random()),
        colorIndex: randomInt(0, this.palette.pipeColors.length - 1),
        colorSegmentsRemaining: randomInt(4, 10),
        accumulator: Math.random() * 0.8,
      }
      return true
    }
    return false
  }

  private extendBuilder(builder: PipeBuilder) {
    const nextDirectionIndex = this.chooseDirection(builder)
    if (nextDirectionIndex === null) {
      return false
    }

    const startGrid = builder.gridPosition.clone()
    const directionVector = GRID_DIRECTIONS[nextDirectionIndex]
    const nextGrid = builder.gridPosition.clone().add(directionVector)

    const changedDirection = nextDirectionIndex !== builder.directionIndex
    const nextShellReach =
      Math.max(Math.abs(nextGrid.x), Math.abs(nextGrid.y), Math.abs(nextGrid.z)) /
      Math.max(1, this.gridExtent)
    const currentShellReach =
      Math.max(Math.abs(builder.gridPosition.x), Math.abs(builder.gridPosition.y), Math.abs(builder.gridPosition.z)) /
      Math.max(1, this.gridExtent)

    if (changedDirection) {
      this.addJoint(startGrid, builder.colorIndex)
      if (nextShellReach >= currentShellReach + 0.08 || Math.random() < 0.22) {
        builder.breakoutStepsRemaining = randomInt(7, 15)
        builder.straightStepsRemaining = randomInt(8, 16)
      } else {
        builder.breakoutStepsRemaining = Math.max(0, builder.breakoutStepsRemaining - 1)
        builder.straightStepsRemaining = randomInt(5, 12)
      }
    } else {
      builder.breakoutStepsRemaining = Math.max(0, builder.breakoutStepsRemaining - 1)
      builder.straightStepsRemaining = Math.max(0, builder.straightStepsRemaining - 1)
    }

    if (builder.colorSegmentsRemaining <= 0 && changedDirection && Math.random() > 0.35) {
      builder.colorIndex = this.nextSectionColorIndex(builder.colorIndex)
      builder.colorSegmentsRemaining = randomInt(4, 10)
    } else {
      builder.colorSegmentsRemaining = Math.max(0, builder.colorSegmentsRemaining - 1)
    }

    const edgeKey = this.edgeKey(startGrid, nextGrid)
    this.occupiedEdges.add(edgeKey)
    this.markCellOccupied(nextGrid)
    this.addSegment(startGrid, nextGrid, builder.colorIndex, builder.speedMultiplier)
    builder.gridPosition.copy(nextGrid)
    builder.directionIndex = nextDirectionIndex
    this.segmentCount += 1
    return true
  }

  private chooseDirection(builder: PipeBuilder) {
    const validDirections: Array<{ directionIndex: number; score: number; shellReach: number }> = []
    const currentShellReach =
      Math.max(Math.abs(builder.gridPosition.x), Math.abs(builder.gridPosition.y), Math.abs(builder.gridPosition.z)) /
      Math.max(1, this.gridExtent)

    for (let index = 0; index < GRID_DIRECTIONS.length; index += 1) {
      if (index === OPPOSITE_DIRECTIONS[builder.directionIndex]) {
        continue
      }
      const nextGrid = builder.gridPosition.clone().add(GRID_DIRECTIONS[index])
      if (!this.isGridPositionAvailable(builder.gridPosition, nextGrid)) {
        continue
      }
      const shellReach =
        Math.max(Math.abs(nextGrid.x), Math.abs(nextGrid.y), Math.abs(nextGrid.z)) /
        Math.max(1, this.gridExtent)
      validDirections.push({
        directionIndex: index,
        score: this.scoreDirection(builder, index, nextGrid),
        shellReach,
      })
    }

    if (!validDirections.length) {
      return null
    }

    if (builder.breakoutStepsRemaining > 0) {
      const outwardCandidates = validDirections
        .filter((candidate) => candidate.shellReach >= currentShellReach)
        .sort((left, right) => right.score - left.score)
      const preferred = outwardCandidates.find((candidate) => candidate.directionIndex === builder.directionIndex)
      if (preferred && builder.straightStepsRemaining > 0) {
        return preferred.directionIndex
      }
      if (outwardCandidates.length) {
        return outwardCandidates[0].directionIndex
      }
    }

    validDirections.sort((left, right) => right.score - left.score)
    const best = validDirections[0]
    const closeCandidates = validDirections.filter((candidate) => candidate.score >= best.score - 3.4)
    const weightedPool = closeCandidates.length ? closeCandidates : validDirections
    const totalWeight = weightedPool.reduce(
      (sum, candidate) => sum + Math.max(0.35, candidate.score - (best.score - 3.8)),
      0,
    )

    let threshold = Math.random() * totalWeight
    let chosen = weightedPool[weightedPool.length - 1] ?? best
    for (const candidate of weightedPool) {
      threshold -= Math.max(0.25, candidate.score - (best.score - 2.8))
      if (threshold <= 0) {
        chosen = candidate
        break
      }
    }

    return chosen.directionIndex
  }

  private isGridPositionAvailable(startGrid: THREE.Vector3, nextGrid: THREE.Vector3) {
    if (
      Math.abs(nextGrid.x) > this.gridExtent ||
      Math.abs(nextGrid.y) > this.gridExtent ||
      Math.abs(nextGrid.z) > this.gridExtent
    ) {
      return false
    }

    if (this.occupiedCells.has(this.cellKey(nextGrid))) {
      return false
    }

    return !this.occupiedEdges.has(this.edgeKey(startGrid, nextGrid))
  }

  private addSegment(
    startGrid: THREE.Vector3,
    endGrid: THREE.Vector3,
    colorIndex: number,
    speedMultiplier: number,
  ) {
    if (!this.pipesGroup) {
      return
    }

    const startWorld = this.gridToWorld(startGrid)
    const endWorld = this.gridToWorld(endGrid)
    const direction = endWorld.clone().sub(startWorld).normalize()
    const material = this.getMaterial(colorIndex)
    const mesh = new THREE.Mesh(this.segmentGeometry, material)
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.quaternion.copy(this.tempQuaternion.setFromUnitVectors(this.unitUp, direction))
    mesh.scale.set(this.pipeRadius, 0.08, this.pipeRadius)
    mesh.position.copy(startWorld)
    this.pipesGroup.add(mesh)
    this.meshes.push({ mesh })
    this.growingSegments.push({
      mesh,
      start: startWorld,
      direction,
      length: startWorld.distanceTo(endWorld),
      progress: 0,
      speed: lerp(2.1, 4.1, normalize(this.options.speed)) * speedMultiplier,
    })
  }

  private addJoint(gridPosition: THREE.Vector3, colorIndex: number) {
    if (!this.pipesGroup) {
      return
    }

    const material = this.getMaterial(colorIndex)
    const joint = new THREE.Mesh(this.jointGeometry, material)
    const worldPosition = this.gridToWorld(gridPosition)
    const scale = this.pipeRadius * 1.14
    joint.scale.setScalar(scale)
    joint.position.copy(worldPosition)
    joint.castShadow = false
    joint.receiveShadow = false
    this.pipesGroup.add(joint)
    this.meshes.push({ mesh: joint })
  }

  private getMaterial(colorIndex: number) {
    const color = this.palette.pipeColors[colorIndex % this.palette.pipeColors.length]
    const key = `${this.options.colorScheme}:${color.toString(16)}`
    for (const material of this.materials) {
      if (material.name === key) {
        return material
      }
    }

    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(color).multiplyScalar(0.25),
      emissiveIntensity: this.palette.emissiveStrength + normalize(this.options.brightness) * 0.12,
      metalness: this.palette.metalness,
      roughness: this.palette.roughness,
      transparent: true,
      opacity: 1,
    })
    material.name = key
    this.materials.add(material)
    return material
  }

  private markCellOccupied(gridPosition: THREE.Vector3) {
    this.occupiedCells.add(this.cellKey(gridPosition))
    this.layerUsageX.set(gridPosition.x, (this.layerUsageX.get(gridPosition.x) ?? 0) + 1)
    this.layerUsageY.set(gridPosition.y, (this.layerUsageY.get(gridPosition.y) ?? 0) + 1)
    this.layerUsageZ.set(gridPosition.z, (this.layerUsageZ.get(gridPosition.z) ?? 0) + 1)
    const octantKey = this.octantKey(gridPosition)
    this.octantUsage.set(octantKey, (this.octantUsage.get(octantKey) ?? 0) + 1)
  }

  private nextSectionColorIndex(currentIndex: number) {
    const paletteSize = this.palette.pipeColors.length
    if (paletteSize <= 1) {
      return currentIndex
    }
    return (currentIndex + randomInt(1, paletteSize - 1)) % paletteSize
  }

  private initialDirectionIndex(gridPosition: THREE.Vector3) {
    const candidates: number[] = []
    GRID_DIRECTIONS.forEach((direction, index) => {
      const alignment = gridPosition.dot(direction)
      if (alignment < 0) {
        candidates.push(index)
      }
    })
    return candidates[randomInt(0, candidates.length - 1)] ?? randomInt(0, GRID_DIRECTIONS.length - 1)
  }

  private scoreDirection(builder: PipeBuilder, directionIndex: number, nextGrid: THREE.Vector3) {
    const occupancyRatio = this.occupiedCells.size / Math.max(1, this.totalGridCells)
    const corridorFree = this.countFreeRun(nextGrid, directionIndex, 10)
    const localDensity = this.countOccupiedNeighbors(nextGrid, 2)
    const currentDensity = this.countOccupiedNeighbors(builder.gridPosition, 2)
    const densityDrop = currentDensity - localDensity
    const localOpen = this.countOpenNeighbors(nextGrid)
    const layerSpread =
      this.layerPreference(this.layerUsageX, nextGrid.x) +
      this.layerPreference(this.layerUsageY, nextGrid.y) +
      this.layerPreference(this.layerUsageZ, nextGrid.z)
    const octantSpread = this.octantPreference(nextGrid)
    const currentShellReach =
      Math.max(Math.abs(builder.gridPosition.x), Math.abs(builder.gridPosition.y), Math.abs(builder.gridPosition.z)) /
      Math.max(1, this.gridExtent)
    const outerReach =
      (Math.abs(nextGrid.x) + Math.abs(nextGrid.y) + Math.abs(nextGrid.z)) /
      Math.max(1, this.gridExtent * 3)
    const shellReach =
      Math.max(Math.abs(nextGrid.x), Math.abs(nextGrid.y), Math.abs(nextGrid.z)) /
      Math.max(1, this.gridExtent)
    const outwardDelta = shellReach - currentShellReach
    const shellContact = [nextGrid.x, nextGrid.y, nextGrid.z].reduce((count, coordinate) => (
      Math.abs(coordinate) >= this.gridExtent - 1 ? count + 1 : count
    ), 0)
    const centerPenalty = (1 - shellReach) * lerp(2.2, 0.45, occupancyRatio)
    const breakoutBias = builder.breakoutStepsRemaining > 0 ? Math.max(0, outwardDelta) * 8.2 + shellReach * 1.8 : 0
    const straightBonus =
      directionIndex === builder.directionIndex
        ? 2.8 + builder.straightStepsRemaining * 0.28 + builder.breakoutStepsRemaining * 0.34
        : 0

    return (
      corridorFree * 4.8 +
      localOpen * 0.12 +
      layerSpread * 3.4 +
      octantSpread * 2.8 +
      outerReach * lerp(3.6, 1.4, occupancyRatio) +
      shellReach * 3.4 +
      outwardDelta * lerp(8.5, 2.8, occupancyRatio) +
      shellContact * 1.45 +
      breakoutBias +
      densityDrop * 1.7 +
      straightBonus -
      localDensity * 1.35 -
      centerPenalty +
      Math.random() * 1.6
    )
  }

  private countFreeRun(startGrid: THREE.Vector3, directionIndex: number, maxSteps: number) {
    let freeSteps = 0
    const probe = startGrid.clone()
    for (let step = 0; step < maxSteps; step += 1) {
      if (
        Math.abs(probe.x) > this.gridExtent ||
        Math.abs(probe.y) > this.gridExtent ||
        Math.abs(probe.z) > this.gridExtent ||
        this.occupiedCells.has(this.cellKey(probe))
      ) {
        break
      }
      freeSteps += 1
      probe.add(GRID_DIRECTIONS[directionIndex])
    }
    return freeSteps
  }

  private countOpenNeighbors(centerGrid: THREE.Vector3) {
    let openCount = 0
    for (let index = 0; index < GRID_DIRECTIONS.length; index += 1) {
      const candidate = this.tempGridVector.copy(centerGrid).add(GRID_DIRECTIONS[index])
      if (
        Math.abs(candidate.x) <= this.gridExtent &&
        Math.abs(candidate.y) <= this.gridExtent &&
        Math.abs(candidate.z) <= this.gridExtent &&
        !this.occupiedCells.has(this.cellKey(candidate))
      ) {
        openCount += 1
      }
    }
    return openCount
  }

  private countOccupiedNeighbors(centerGrid: THREE.Vector3, radius: number) {
    let occupied = 0
    for (let x = -radius; x <= radius; x += 1) {
      for (let y = -radius; y <= radius; y += 1) {
        for (let z = -radius; z <= radius; z += 1) {
          if (x === 0 && y === 0 && z === 0) {
            continue
          }
          const candidate = this.tempGridVector.set(
            centerGrid.x + x,
            centerGrid.y + y,
            centerGrid.z + z,
          )
          if (
            Math.abs(candidate.x) <= this.gridExtent &&
            Math.abs(candidate.y) <= this.gridExtent &&
            Math.abs(candidate.z) <= this.gridExtent &&
            this.occupiedCells.has(this.cellKey(candidate))
          ) {
            occupied += 1
          }
        }
      }
    }
    return occupied
  }

  private layerPreference(layerUsage: Map<number, number>, coordinate: number) {
    const usage = layerUsage.get(coordinate) ?? 0
    const maxLayerFill = Math.max(1, Math.round(this.totalGridCells / Math.max(1, this.gridExtent * 2 + 1)))
    return 1 - usage / maxLayerFill
  }

  private octantPreference(gridPosition: THREE.Vector3) {
    const usage = this.octantUsage.get(this.octantKey(gridPosition)) ?? 0
    const maxOctantFill = Math.max(1, Math.round(this.totalGridCells / 8))
    return 1 - usage / maxOctantFill
  }

  private octantKey(gridPosition: THREE.Vector3) {
    return [
      gridPosition.x >= 0 ? 'p' : 'n',
      gridPosition.y >= 0 ? 'p' : 'n',
      gridPosition.z >= 0 ? 'p' : 'n',
    ].join('')
  }

  private gridToWorld(gridPosition: THREE.Vector3) {
    return this.tempVectorB
      .set(gridPosition.x * this.gridStep, gridPosition.y * this.gridStep, gridPosition.z * this.gridStep)
      .clone()
  }

  private cellKey(vector: THREE.Vector3) {
    return `${vector.x}|${vector.y}|${vector.z}`
  }

  private edgeKey(startVector: THREE.Vector3, endVector: THREE.Vector3) {
    const startKey = this.cellKey(startVector)
    const endKey = this.cellKey(endVector)
    return startKey < endKey ? `${startKey}>${endKey}` : `${endKey}>${startKey}`
  }

  private get gridExtent() {
    return Math.round(lerp(4, 8, normalize(this.options.intensity)))
  }

  private get gridStep() {
    return lerp(4.6, 3.8, normalize(this.options.intensity))
  }

  private get pipeRadius() {
    return lerp(0.62, 0.82, normalize(this.options.brightness))
  }

  private get totalGridCells() {
    const side = this.gridExtent * 2 + 1
    return side * side * side
  }

  private get targetOccupiedCells() {
    return Math.round(this.totalGridCells * lerp(0.76, 0.92, normalize(this.options.intensity)))
  }

  private get palette() {
    return PIPE_PALETTES[this.options.colorScheme]
  }
}

function randomInt(min: number, max: number) {
  return Math.floor(lerp(min, max + 1, Math.random()))
}
