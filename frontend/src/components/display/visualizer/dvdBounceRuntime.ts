import * as THREE from 'three'

import type { ColorScheme, VisualizerPreset } from '../../../services/api'
import type { VisualizerRuntimeController, VisualizerRuntimeOptions } from './runtimeTypes'
import { clamp, lerp, normalize, smoothstep } from './runtimeUtils'

export type DvdBouncePreset = Extract<VisualizerPreset, 'dvd_bounce'>

const DVD_BOUNCE_PRESETS = new Set<DvdBouncePreset>(['dvd_bounce'])
const MAX_TRAIL_GHOSTS = 0
const BADGE_ASPECT = 2.7
const BASE_VIEW_HEIGHT = 100
const EDGE_PADDING = 0

interface DvdPalette {
  background: number
  vignette: string
  glowCloudA: string
  glowCloudB: string
  flash: string
  badgeColors: number[]
}

interface TrailSample {
  position: THREE.Vector3
  scale: number
  color: THREE.Color
}

interface GhostBadge {
  group: THREE.Group
  glow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  badge: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
}

const DVD_PALETTES: Record<ColorScheme, DvdPalette> = {
  mono: {
    background: 0x020205,
    vignette: 'rgba(4, 5, 10, 0.84)',
    glowCloudA: 'rgba(28, 18, 58, 0.18)',
    glowCloudB: 'rgba(14, 24, 52, 0.14)',
    flash: 'rgba(220, 236, 255, 0.16)',
    badgeColors: [0xff4fb9, 0x4ef0ff, 0x5f7dff, 0x9a5cff, 0xff8c42, 0xf1f45d],
  },
  acid: {
    background: 0x020306,
    vignette: 'rgba(4, 7, 12, 0.84)',
    glowCloudA: 'rgba(32, 12, 70, 0.22)',
    glowCloudB: 'rgba(10, 35, 62, 0.15)',
    flash: 'rgba(230, 244, 255, 0.18)',
    badgeColors: [0xff4fd3, 0x3bf2ff, 0x4d82ff, 0xa85cff, 0xff9f33, 0xe7ff54],
  },
  ultraviolet: {
    background: 0x020207,
    vignette: 'rgba(6, 6, 14, 0.86)',
    glowCloudA: 'rgba(46, 12, 88, 0.24)',
    glowCloudB: 'rgba(22, 28, 78, 0.18)',
    flash: 'rgba(222, 233, 255, 0.17)',
    badgeColors: [0xff5fb8, 0x57e8ff, 0x6284ff, 0xb16bff, 0xff9258, 0xf1ea63],
  },
  redline: {
    background: 0x030204,
    vignette: 'rgba(8, 6, 12, 0.86)',
    glowCloudA: 'rgba(62, 18, 70, 0.2)',
    glowCloudB: 'rgba(20, 26, 58, 0.15)',
    flash: 'rgba(236, 232, 255, 0.15)',
    badgeColors: [0xff649f, 0x50e8ff, 0x5476ff, 0xa25cff, 0xffa041, 0xeeef67],
  },
}

export function isDvdBouncePreset(preset: string): preset is DvdBouncePreset {
  return DVD_BOUNCE_PRESETS.has(preset as DvdBouncePreset)
}

export class DvdBounceRuntime implements VisualizerRuntimeController {
  private container: HTMLElement | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.OrthographicCamera | null = null
  private badgeGroup: THREE.Group | null = null
  private badgeMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null
  private glowMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null
  private trailGroup: THREE.Group | null = null
  private backgroundLayer: HTMLDivElement | null = null
  private flashLayer: HTMLDivElement | null = null
  private readonly ghosts: GhostBadge[] = []
  private readonly trailSamples: TrailSample[] = []
  private readonly clock = new THREE.Clock()
  private animationFrameId = 0
  private options: VisualizerRuntimeOptions
  private errorHandler: ((error: Error) => void) | null = null
  private readonly preset: DvdBouncePreset
  private readonly position = new THREE.Vector3()
  private readonly velocity = new THREE.Vector3()
  private currentColor = new THREE.Color(0xff4fb9)
  private colorIndex = 0
  private trailSampleClock = 0
  private trailVisibilityTime = 0
  private trailBounceBoost = 0
  private glowImpulse = 0
  private cornerFlash = 0
  private badgeTexture: THREE.CanvasTexture | null = null

  constructor(preset: DvdBouncePreset) {
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
    this.resetMotion()
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
    this.updateCameraFrustum(safeWidth, safeHeight)
  }

  updateOptions(partialOptions: Partial<VisualizerRuntimeOptions>) {
    this.options = { ...this.options, ...partialOptions }
    this.applyPalette()
  }

  triggerEvent(name: string) {
    if (name === 'mode_change' || name === 'upload_created') {
      this.trailBounceBoost = Math.min(1, this.trailBounceBoost + 0.24 + Math.random() * 0.14)
      this.glowImpulse = Math.min(1, this.glowImpulse + 0.16)
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
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10)
    this.updateCameraFrustum(width, height)
    this.camera.position.set(0, 0, 5)

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

    this.createBackgroundLayers()
    this.createBadgeTexture()
    this.createBadgeMeshes()
    this.applyPalette()
  }

  private createBackgroundLayers() {
    if (!this.container) {
      return
    }

    const backgroundLayer = document.createElement('div')
    Object.assign(backgroundLayer.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      mixBlendMode: 'screen',
      opacity: '0.85',
      willChange: 'transform, opacity, background-position',
    })
    this.container.prepend(backgroundLayer)
    this.backgroundLayer = backgroundLayer

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

  private createBadgeTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = Math.round(canvas.width / BADGE_ASPECT)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('DVD badge canvas context not available')
    }

    const width = canvas.width
    const height = canvas.height

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.save()
    ctx.translate(width * 0.5, height * 0.35)
    ctx.scale(1.1, 1)
    ctx.font = 'italic 900 272px Arial Black, sans-serif'
    ctx.fillText('DVD', 0, 0)
    ctx.restore()

    ctx.save()
    ctx.translate(width * 0.5, height * 0.79)
    ctx.beginPath()
    ctx.ellipse(0, 0, width * 0.43, height * 0.17, 0, 0, Math.PI * 2)
    ctx.ellipse(0, 0, width * 0.11, height * 0.055, 0, 0, Math.PI * 2, true)
    ctx.fill('evenodd')
    ctx.restore()

    this.badgeTexture = new THREE.CanvasTexture(canvas)
    this.badgeTexture.colorSpace = THREE.SRGBColorSpace
    this.badgeTexture.needsUpdate = true
  }

  private createBadgeMeshes() {
    if (!this.scene || !this.badgeTexture) {
      return
    }

    const width = this.badgeSize.x
    const height = this.badgeSize.y
    const geometry = new THREE.PlaneGeometry(width, height)

    this.badgeGroup = new THREE.Group()
    this.scene.add(this.badgeGroup)

    this.glowMesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        map: this.badgeTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    this.glowMesh.scale.setScalar(1.14)
    this.badgeGroup.add(this.glowMesh)

    this.badgeMesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        map: this.badgeTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    this.badgeGroup.add(this.badgeMesh)

    this.trailGroup = new THREE.Group()
    this.scene.add(this.trailGroup)

    for (let index = 0; index < MAX_TRAIL_GHOSTS; index += 1) {
      const group = new THREE.Group()
      const glow = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          map: this.badgeTexture,
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          toneMapped: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      glow.scale.setScalar(1.12)
      const badge = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          map: this.badgeTexture,
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          toneMapped: false,
        }),
      )
      group.visible = false
      group.add(glow, badge)
      this.trailGroup.add(group)
      this.ghosts.push({ group, glow, badge })
    }
  }

  private resetMotion() {
    this.position.set(0, 0, 0)
    const diagonal = new THREE.Vector3(1, 0.72, 0).normalize().multiplyScalar(this.motionSpeed)
    this.velocity.copy(diagonal)
    this.trailSamples.length = 0
    this.trailSampleClock = 0
    this.trailVisibilityTime = 0
    this.trailBounceBoost = 0
    this.glowImpulse = 0
    this.cornerFlash = 0
    this.colorIndex = Math.floor(Math.random() * this.palette.badgeColors.length)
    this.currentColor.setHex(this.palette.badgeColors[this.colorIndex] ?? 0xff4fb9)
    this.badgeGroup?.position.copy(this.position)
    this.updateBadgeVisuals()
    this.updateTrail(true)
    this.updateBackground()
  }

  private disposeScene() {
    this.backgroundLayer?.remove()
    this.flashLayer?.remove()
    this.backgroundLayer = null
    this.flashLayer = null

    this.ghosts.forEach((ghost) => {
      ghost.glow.material.dispose()
      ghost.badge.material.dispose()
      ghost.group.clear()
      ghost.group.removeFromParent()
    })
    this.ghosts.length = 0
    this.trailSamples.length = 0

    this.glowMesh?.material.dispose()
    this.badgeMesh?.material.dispose()
    this.badgeMesh?.geometry.dispose()
    this.badgeGroup?.clear()
    this.badgeGroup?.removeFromParent()
    this.badgeGroup = null
    this.badgeMesh = null
    this.glowMesh = null
    this.trailGroup?.clear()
    this.trailGroup?.removeFromParent()
    this.trailGroup = null

    this.badgeTexture?.dispose()
    this.badgeTexture = null
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

  private readonly animate = () => {
    if (!this.renderer || !this.scene || !this.camera || !this.badgeGroup) {
      return
    }

    try {
      this.animationFrameId = window.requestAnimationFrame(this.animate)
      const deltaSeconds = clamp(this.clock.getDelta(), 1 / 144, 1 / 20)
      this.trailSampleClock += deltaSeconds
      this.trailVisibilityTime += deltaSeconds
      this.trailBounceBoost = Math.max(0, this.trailBounceBoost * Math.exp(-deltaSeconds * 2.2))
      this.glowImpulse = Math.max(0, this.glowImpulse * Math.exp(-deltaSeconds * 5.2))
      this.cornerFlash = Math.max(0, this.cornerFlash * Math.exp(-deltaSeconds * 6.4))

      this.position.addScaledVector(this.velocity, deltaSeconds)
      this.handleBounces()
      this.badgeGroup.position.copy(this.position)
      this.updateBadgeVisuals()
      this.updateTrail()
      this.updateBackground()

      this.renderer.render(this.scene, this.camera)
    } catch (error) {
      this.stop()
      const runtimeError = error instanceof Error ? error : new Error('DVD bounce runtime failed')
      this.errorHandler?.(runtimeError)
    }
  }

  private handleBounces() {
    const bounds = this.viewportBounds
    const halfWidth = this.badgeSize.x * this.currentBadgeScale * 0.5
    const halfHeight = this.badgeSize.y * this.currentBadgeScale * 0.5
    let hitX = false
    let hitY = false

    if (this.position.x + halfWidth >= bounds.right) {
      this.position.x = bounds.right - halfWidth
      this.velocity.x = -Math.abs(this.velocity.x)
      hitX = true
    } else if (this.position.x - halfWidth <= bounds.left) {
      this.position.x = bounds.left + halfWidth
      this.velocity.x = Math.abs(this.velocity.x)
      hitX = true
    }

    if (this.position.y + halfHeight >= bounds.top) {
      this.position.y = bounds.top - halfHeight
      this.velocity.y = -Math.abs(this.velocity.y)
      hitY = true
    } else if (this.position.y - halfHeight <= bounds.bottom) {
      this.position.y = bounds.bottom + halfHeight
      this.velocity.y = Math.abs(this.velocity.y)
      hitY = true
    }

    if (!hitX && !hitY) {
      return
    }

    const cornerHit = hitX && hitY
    this.advanceColor(cornerHit)
    this.glowImpulse = Math.min(1, this.glowImpulse + (cornerHit ? 0.95 : 0.42))
    this.trailBounceBoost = Math.min(1, this.trailBounceBoost + (cornerHit ? 0.85 : 0.32) + Math.random() * 0.08)
    if (cornerHit) {
      this.cornerFlash = Math.min(1, this.cornerFlash + 1)
    }
  }

  private advanceColor(cornerHit: boolean) {
    const paletteSize = this.palette.badgeColors.length
    if (paletteSize <= 1) {
      return
    }
    const jump = cornerHit ? Math.max(2, Math.floor(Math.random() * (paletteSize - 1))) : 1 + Math.floor(Math.random() * (paletteSize - 1))
    this.colorIndex = (this.colorIndex + jump) % paletteSize
    this.currentColor.setHex(this.palette.badgeColors[this.colorIndex] ?? this.palette.badgeColors[0] ?? 0xffffff)
  }

  private updateBadgeVisuals() {
    if (!this.badgeMesh || !this.glowMesh || !this.badgeGroup) {
      return
    }

    const brightness = normalize(this.options.brightness)
    const intensity = normalize(this.options.intensity)
    const scale = this.currentBadgeScale
    this.badgeGroup.scale.setScalar(scale)
    this.badgeMesh.material.color.copy(this.currentColor)
    this.badgeMesh.material.opacity = 0.96 + brightness * 0.04
    this.glowMesh.material.color.copy(this.currentColor)
    this.glowMesh.material.opacity = 0.08 + intensity * 0.08 + this.glowImpulse * 0.2 + this.cornerFlash * 0.16
    this.glowMesh.scale.setScalar(1.1 + this.glowImpulse * 0.08 + this.cornerFlash * 0.06)
  }

  private updateTrail(force = false) {
    if (!this.badgeGroup || !this.ghosts.length) {
      return
    }

    if (force || this.trailSamples.length === 0 || this.trailSampleClock >= 0.028) {
      this.trailSamples.push({
        position: this.position.clone(),
        scale: this.currentBadgeScale,
        color: this.currentColor.clone(),
      })
      if (this.trailSamples.length > MAX_TRAIL_GHOSTS) {
        this.trailSamples.shift()
      }
      this.trailSampleClock = 0
    }

    const t = this.trailVisibilityTime
    const wave = 0.42
      + Math.sin(t * 0.58) * 0.24
      + Math.cos(t * 0.21 + 0.8) * 0.16
      + Math.sin(t * 0.12 + 2.1) * 0.08
    const visibility = clamp(0.08 + smoothstep((wave + 0.42) * 0.64) * 0.9 + this.trailBounceBoost * 0.36, 0.04, 1)

    this.ghosts.forEach((ghost, index) => {
      const sample = this.trailSamples[this.trailSamples.length - 1 - index]
      if (!sample) {
        ghost.group.visible = false
        return
      }

      const normalized = 1 - index / Math.max(1, MAX_TRAIL_GHOSTS - 1)
      const segmentFactor = clamp(
        lerp(0.82, 1.06, normalized) + Math.sin(t * (0.38 + index * 0.05) + index * 0.8) * (0.03 + (1 - normalized) * 0.05),
        0.68,
        1.08,
      )
      const baseOpacity = lerp(0.04, 0.22, Math.pow(normalized, 1.18))
      const opacity = clamp(baseOpacity * visibility * segmentFactor, 0, 0.24)
      ghost.group.visible = opacity > 0.004
      ghost.group.position.copy(sample.position)
      ghost.group.scale.setScalar(sample.scale * lerp(0.9, 0.98, normalized))
      ghost.badge.material.color.copy(sample.color)
      ghost.glow.material.color.copy(sample.color)
      ghost.badge.material.opacity = opacity
      ghost.glow.material.opacity = opacity * 0.7
    })
  }

  private updateBackground() {
    if (!this.backgroundLayer || !this.flashLayer) {
      return
    }

    const t = this.trailVisibilityTime
    const brightness = normalize(this.options.brightness)
    const pulse = 0.12 + Math.sin(t * 0.11) * 0.015 + Math.cos(t * 0.07) * 0.012
    this.backgroundLayer.style.background = [
      `radial-gradient(ellipse at 18% 24%, ${this.palette.glowCloudA} 0%, rgba(0,0,0,0) 52%)`,
      `radial-gradient(ellipse at 82% 72%, ${this.palette.glowCloudB} 0%, rgba(0,0,0,0) 48%)`,
      `radial-gradient(ellipse at 72% 18%, rgba(14, 18, 42, 0.12) 0%, rgba(0,0,0,0) 38%)`,
      `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 48%, ${this.palette.vignette} 100%)`,
    ].join(',')
    this.backgroundLayer.style.opacity = `${(0.72 + pulse + brightness * 0.04 + this.cornerFlash * 0.08).toFixed(3)}`
    this.backgroundLayer.style.transform = `translate3d(${(Math.sin(t * 0.12) * 10).toFixed(2)}px, ${(Math.cos(t * 0.09) * 7).toFixed(2)}px, 0)`

    const flashOpacity = clamp(this.glowImpulse * 0.16 + this.cornerFlash * 0.28, 0, 0.24)
    this.flashLayer.style.opacity = flashOpacity.toFixed(3)
    this.flashLayer.style.background = [
      `radial-gradient(ellipse at 16% 20%, ${this.palette.flash} 0%, rgba(255,255,255,0) 28%)`,
      `radial-gradient(ellipse at 84% 76%, ${this.palette.flash} 0%, rgba(255,255,255,0) 24%)`,
      'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0))',
    ].join(',')
  }

  private updateCameraFrustum(width: number, height: number) {
    if (!this.camera) {
      return
    }
    const aspect = Math.max(1, width) / Math.max(1, height)
    const halfHeight = BASE_VIEW_HEIGHT * 0.5
    const halfWidth = halfHeight * aspect
    this.camera.left = -halfWidth
    this.camera.right = halfWidth
    this.camera.top = halfHeight
    this.camera.bottom = -halfHeight
    this.camera.updateProjectionMatrix()
  }

  private get motionSpeed() {
    return lerp(18, 36, normalize(this.options.speed))
  }

  private get currentBadgeScale() {
    const intensity = normalize(this.options.intensity)
    return 1 + intensity * 0.06 + this.glowImpulse * 0.035 + this.cornerFlash * 0.055
  }

  private get badgeSize() {
    const intensity = normalize(this.options.intensity)
    return new THREE.Vector2(lerp(28, 38, intensity), lerp(10.6, 14.4, intensity))
  }

  private get viewportBounds() {
    if (!this.camera) {
      return { left: -50 + EDGE_PADDING, right: 50 - EDGE_PADDING, top: 50 - EDGE_PADDING, bottom: -50 + EDGE_PADDING }
    }
    return {
      left: this.camera.left + EDGE_PADDING,
      right: this.camera.right - EDGE_PADDING,
      top: this.camera.top - EDGE_PADDING,
      bottom: this.camera.bottom + EDGE_PADDING,
    }
  }

  private applyPalette() {
    if (!this.scene || !this.renderer) {
      return
    }
    this.scene.background = new THREE.Color(this.palette.background)
    this.renderer.setClearColor(this.palette.background, 1)
    this.updateBadgeVisuals()
    this.updateBackground()
  }

  private get palette() {
    return DVD_PALETTES[this.options.colorScheme]
  }
}
