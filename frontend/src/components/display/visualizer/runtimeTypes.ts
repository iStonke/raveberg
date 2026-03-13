import type { ColorScheme, HydraPaletteMode, HydraQuality, VisualizerPreset } from '../../../services/api'

export interface VisualizerRuntimeOptions {
  preset: VisualizerPreset
  intensity: number
  speed: number
  brightness: number
  colorScheme: ColorScheme
  hydraColorfulness: number
  hydraSceneChangeRate: number
  hydraSymmetryAmount: number
  hydraFeedbackAmount: number
  hydraQuality: HydraQuality
  hydraAudioReactivityEnabled: boolean
  hydraPaletteMode: HydraPaletteMode
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
