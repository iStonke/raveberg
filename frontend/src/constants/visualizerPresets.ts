import type { VisualizerPreset } from '../services/api'

export const defaultVisualizerPresetSequence: VisualizerPreset[] = [
  'particles',
  'kaleidoscope',
  'warehouse',
  'storm_lightning',
  'retro_cube',
  'retro_pipes',
  'dvd_bounce',
  'matrix_screen',
  'nebel',
  'vanta_halo',
  'hydra_rave',
  'hydra_chromaflow',
]

export const visualizerPresetLabels: Record<VisualizerPreset, string> = {
  particles: 'Particles',
  kaleidoscope: 'Kaleidoscope',
  warehouse: 'Warehouse',
  storm_lightning: 'Storm Lightning',
  retro_cube: 'Retro Cube',
  retro_pipes: 'Retro Pipes',
  dvd_bounce: 'DVD Bounce',
  matrix_screen: 'Matrix Screen',
  nebel: 'Nebel',
  vanta_halo: 'Vanta HALO',
  hydra_rave: 'Hydra Rave',
  hydra_chromaflow: 'Hydra Chromaflow',
}
