import type { ColorScheme, HydraPaletteMode } from '../../../services/api'

import type { VisualizerRuntimeOptions } from './runtimeTypes'
import { lerp, normalize, smoothstep } from './runtimeUtils'

export interface HydraRavePalette {
  base: [number, number, number]
  secondary: [number, number, number]
  accent: [number, number, number]
  pulse: [number, number, number]
  highlight: [number, number, number]
  glow: [number, number, number]
}

export interface HydraChromaflowPalette {
  background: [number, number, number]
  dominant: [number, number, number]
  secondary: [number, number, number]
  accent: [number, number, number]
  highlight: [number, number, number]
  contrast: [number, number, number]
  shadow: [number, number, number]
}

export interface HydraChromaflowPaletteState {
  fromPalette: HydraChromaflowPalette
  toPalette: HydraChromaflowPalette
  mix: number
}

export const HYDRA_RAVE_PALETTES: Record<ColorScheme, HydraRavePalette> = {
  mono: {
    base: [0.76, 0.82, 0.92],
    secondary: [0.48, 0.63, 0.82],
    accent: [0.31, 0.56, 0.78],
    pulse: [0.7, 0.83, 0.95],
    highlight: [0.9, 0.94, 1],
    glow: [0.36, 0.57, 0.82],
  },
  acid: {
    base: [0.16, 0.82, 1],
    secondary: [0.97, 0.19, 0.82],
    accent: [0.34, 0.47, 1],
    pulse: [0.08, 1, 0.83],
    highlight: [0.98, 0.9, 0.22],
    glow: [0.53, 0.14, 1],
  },
  ultraviolet: {
    base: [0.48, 0.29, 1],
    secondary: [0.07, 0.78, 1],
    accent: [0.94, 0.17, 0.78],
    pulse: [0.24, 0.93, 0.88],
    highlight: [0.84, 0.67, 1],
    glow: [0.22, 0.53, 1],
  },
  redline: {
    base: [1, 0.24, 0.49],
    secondary: [0.4, 0.82, 1],
    accent: [0.89, 0.08, 0.68],
    pulse: [1, 0.54, 0.24],
    highlight: [0.96, 0.91, 0.32],
    glow: [0.46, 0.21, 0.98],
  },
}

const CHROMAFLOW_FAMILIES: Record<Exclude<HydraPaletteMode, 'auto'>, HydraChromaflowPalette[]> = {
  neon: [
    {
      background: [0.03, 0.04, 0.08],
      dominant: [0.17, 0.95, 0.98],
      secondary: [0.97, 0.12, 0.78],
      accent: [0.25, 0.42, 1],
      highlight: [1, 0.84, 0.32],
      contrast: [0.98, 0.3, 0.88],
      shadow: [0.06, 0.16, 0.28],
    },
    {
      background: [0.02, 0.03, 0.06],
      dominant: [0.3, 0.86, 1],
      secondary: [0.95, 0.24, 0.64],
      accent: [0.05, 1, 0.78],
      highlight: [0.98, 0.91, 0.4],
      contrast: [0.57, 0.17, 1],
      shadow: [0.08, 0.08, 0.24],
    },
  ],
  warm: [
    {
      background: [0.07, 0.03, 0.04],
      dominant: [1, 0.34, 0.28],
      secondary: [0.98, 0.64, 0.22],
      accent: [0.78, 0.21, 0.74],
      highlight: [1, 0.83, 0.48],
      contrast: [0.94, 0.17, 0.46],
      shadow: [0.22, 0.07, 0.11],
    },
    {
      background: [0.08, 0.04, 0.03],
      dominant: [1, 0.46, 0.18],
      secondary: [0.95, 0.22, 0.37],
      accent: [0.77, 0.22, 0.97],
      highlight: [0.98, 0.72, 0.19],
      contrast: [1, 0.54, 0.18],
      shadow: [0.19, 0.08, 0.09],
    },
  ],
  cold: [
    {
      background: [0.02, 0.05, 0.08],
      dominant: [0.12, 0.92, 1],
      secondary: [0.54, 1, 0.82],
      accent: [0.55, 0.44, 1],
      highlight: [0.86, 0.93, 1],
      contrast: [0.34, 0.77, 1],
      shadow: [0.03, 0.16, 0.2],
    },
    {
      background: [0.03, 0.06, 0.09],
      dominant: [0.2, 0.85, 1],
      secondary: [0.5, 0.96, 0.72],
      accent: [0.73, 0.39, 0.96],
      highlight: [0.9, 0.98, 1],
      contrast: [0.38, 0.88, 0.86],
      shadow: [0.07, 0.14, 0.24],
    },
  ],
  acid: [
    {
      background: [0.03, 0.04, 0.05],
      dominant: [0.78, 1, 0.16],
      secondary: [1, 0.65, 0.08],
      accent: [0.08, 1, 0.72],
      highlight: [1, 0.92, 0.34],
      contrast: [0.54, 0.18, 1],
      shadow: [0.12, 0.17, 0.08],
    },
    {
      background: [0.04, 0.05, 0.05],
      dominant: [0.88, 1, 0.24],
      secondary: [0.97, 0.49, 0.2],
      accent: [0.1, 0.96, 0.88],
      highlight: [1, 0.97, 0.52],
      contrast: [0.66, 0.26, 1],
      shadow: [0.14, 0.14, 0.08],
    },
  ],
}

function flattenAutoFamilies() {
  return [
    ...CHROMAFLOW_FAMILIES.neon,
    ...CHROMAFLOW_FAMILIES.warm,
    ...CHROMAFLOW_FAMILIES.cold,
    ...CHROMAFLOW_FAMILIES.acid,
  ]
}

function chromaflowSequence(mode: HydraPaletteMode) {
  return mode === 'auto' ? flattenAutoFamilies() : CHROMAFLOW_FAMILIES[mode]
}

export function paletteChannel(
  state: HydraChromaflowPaletteState,
  key: keyof HydraChromaflowPalette,
  index: 0 | 1 | 2,
) {
  return lerp(state.fromPalette[key][index], state.toPalette[key][index], state.mix)
}

export function resolveChromaflowPaletteState(
  options: VisualizerRuntimeOptions,
  sceneClock: number,
): HydraChromaflowPaletteState {
  const sequence = chromaflowSequence(options.hydraPaletteMode)
  const colorShiftSpeed = 0.26 + normalize(options.hydraSceneChangeRate) * 0.32
  const paletteClock = Math.max(0, sceneClock * colorShiftSpeed * 0.08)
  const baseIndex = Math.floor(paletteClock) % sequence.length
  const nextIndex = (baseIndex + 1) % sequence.length
  const mix = smoothstep(paletteClock - Math.floor(paletteClock))

  return {
    fromPalette: sequence[baseIndex],
    toPalette: sequence[nextIndex],
    mix,
  }
}

export function paletteColorFns(
  state: HydraChromaflowPaletteState,
  key: keyof HydraChromaflowPalette,
): [() => number, () => number, () => number] {
  return [
    () => paletteChannel(state, key, 0),
    () => paletteChannel(state, key, 1),
    () => paletteChannel(state, key, 2),
  ]
}
