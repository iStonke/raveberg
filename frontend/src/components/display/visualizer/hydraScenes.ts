import { HYDRA_CHROMAFLOW_SCENE_CENTERS, type HydraQualityProfile } from './hydraDefaults'
import { HYDRA_RAVE_PALETTES, paletteChannel, resolveChromaflowPaletteState } from './hydraPalettes'
import type { HydraSynth } from './hydraTypes'
import type { VisualizerRuntimeOptions } from './runtimeTypes'

export interface HydraSceneState {
  options: VisualizerRuntimeOptions
  sceneClock(): number
  burstLevel(): number
  qualityProfile: HydraQualityProfile
  phaseWeight(center: number, width: number): number
  intensityFactor(): number
  speedFactor(): number
  brightnessFactor(): number
  colorfulnessFactor(): number
  symmetryFactor(): number
  feedbackFactor(): number
  sceneChangeFactor(): number
  reactiveEnergy(): number
  accentCutLevel(): number
}

export function configureHydraRaveScene(h: HydraSynth, state: HydraSceneState) {
  const palette = HYDRA_RAVE_PALETTES[state.options.colorScheme]

  const mirrorScene = h
    .osc(
      () => 8 + state.speedFactor() * 20 + state.phaseWeight(0.12, 0.2) * 6,
      () => 0.04 + state.phaseWeight(0.12, 0.2) * 0.035,
      () => 0.28 + state.burstLevel() * 0.12,
    )
    .kaleid(() => 5 + Math.floor(state.intensityFactor() * 5 + state.phaseWeight(0.12, 0.2) * 8))
    .rotate(
      () => state.sceneClock() * 0.08 + state.burstLevel() * 0.05,
      () => 0.012 + state.speedFactor() * 0.028,
    )
    .modulate(
      h.noise(() => 2.4 + state.intensityFactor() * 2.6, () => 0.08 + state.speedFactor() * 0.14),
      () => 0.05 + state.intensityFactor() * 0.16,
    )
    .color(...palette.base)
    .saturate(() => 1.2 + state.brightnessFactor() * 0.4)
    .contrast(() => 1.18 + state.intensityFactor() * 0.28)

  const latticeScene = h
    .voronoi(
      () => 3.2 + state.intensityFactor() * 9 + state.burstLevel() * 4,
      () => 0.16 + state.speedFactor() * 0.38,
      () => 0.22 + state.phaseWeight(0.38, 0.22) * 0.48,
    )
    .thresh(
      () => 0.38 + state.phaseWeight(0.38, 0.22) * 0.16,
      () => 0.05 + state.burstLevel() * 0.03,
    )
    .posterize(
      () => 3 + state.intensityFactor() * 2 + state.phaseWeight(0.38, 0.22) * 2,
      () => 0.24 + state.brightnessFactor() * 0.3,
    )
    .rotate(() => -state.sceneClock() * 0.04, () => 0.01 + state.speedFactor() * 0.03)
    .modulateScale(
      h.osc(() => 6 + state.speedFactor() * 6, () => 0.03, () => 0.6).kaleid(3),
      () => 0.08 + state.intensityFactor() * 0.15,
    )
    .color(...palette.secondary)
    .brightness(() => -0.06 + state.brightnessFactor() * 0.08)

  const waveScene = h
    .gradient(() => 0.12 + state.speedFactor() * 0.22)
    .color(...palette.accent)
    .colorama(() => 0.001 + state.phaseWeight(0.64, 0.2) * 0.012 + state.burstLevel() * 0.01)
    .modulate(
      h.osc(() => 4 + state.speedFactor() * 5, () => 0.04, () => 0.1 + state.intensityFactor() * 0.22),
      () => 0.08 + state.phaseWeight(0.64, 0.2) * 0.12,
    )
    .scrollY(() => Math.sin(state.sceneClock() * 0.22) * 0.03, () => 0.02 + state.speedFactor() * 0.02)
    .contrast(() => 1.06 + state.brightnessFactor() * 0.16)

  const surgeScene = h
    .shape(
      () => 4 + Math.floor(state.phaseWeight(0.86, 0.16) * 6),
      () => 0.34 + state.phaseWeight(0.86, 0.16) * 0.12,
      () => 0.001 + state.burstLevel() * 0.004,
    )
    .repeat(
      () => 1 + state.phaseWeight(0.86, 0.16) * 2,
      () => 1 + state.phaseWeight(0.86, 0.16) * 2,
    )
    .rotate(() => state.sceneClock() * 0.11, () => 0.025 + state.speedFactor() * 0.035)
    .modulateRotate(
      h.voronoi(() => 5 + state.burstLevel() * 5, () => 0.15, () => 0.2 + state.intensityFactor() * 0.18),
      () => 0.16 + state.burstLevel() * 0.18,
    )
    .color(...palette.pulse)
    .luma(() => 0.18 + state.phaseWeight(0.86, 0.16) * 0.2, 0.12)
    .saturate(() => 1.22 + state.intensityFactor() * 0.48)

  mirrorScene
    .blend(latticeScene, () => 0.18 + state.phaseWeight(0.38, 0.22) * 0.74)
    .blend(waveScene, () => 0.12 + state.phaseWeight(0.64, 0.2) * 0.62)
    .add(surgeScene, () => 0.06 + state.phaseWeight(0.86, 0.16) * 0.52 + state.burstLevel() * 0.12)
    .blend(
      h
        .src(h.o1)
        .scale(() => 0.996 - state.feedbackFactor() * 0.012)
        .rotate(() => state.feedbackFactor() * 0.08)
        .color(...palette.highlight),
      () => 0.04 + state.feedbackFactor() * 0.16,
    )
    .brightness(() => -0.12 + state.brightnessFactor() * 0.18)
    .contrast(() => 1.18 + state.intensityFactor() * 0.34)
    .saturate(() => 1.24 + state.brightnessFactor() * 0.38)
    .out(h.o0)

  h.src(h.o0)
    .blend(
      h
        .src(h.o1)
        .scale(() => 0.998 - state.feedbackFactor() * 0.01)
        .rotate(() => -0.015 - state.feedbackFactor() * 0.05)
        .color(...palette.glow),
      () => 0.08 + state.feedbackFactor() * 0.24,
    )
    .modulate(
      h.noise(() => 2.1 + state.intensityFactor() * 2.2, () => 0.02 + state.speedFactor() * 0.05),
      () => 0.01 + state.burstLevel() * 0.035,
    )
    .brightness(() => -0.08 + state.brightnessFactor() * 0.14)
    .contrast(() => 1.06 + state.intensityFactor() * 0.18)
    .out(h.o1)

  h.render(h.o1)
}

export function configureHydraChromaflowScene(h: HydraSynth, state: HydraSceneState) {
  const paletteColor = (key: 'background' | 'dominant' | 'secondary' | 'accent' | 'highlight' | 'contrast' | 'shadow') =>
    ([
      () => paletteChannel(resolveChromaflowPaletteState(state.options, state.sceneClock()), key, 0),
      () => paletteChannel(resolveChromaflowPaletteState(state.options, state.sceneClock()), key, 1),
      () => paletteChannel(resolveChromaflowPaletteState(state.options, state.sceneClock()), key, 2),
    ] as [() => number, () => number, () => number])

  const background = paletteColor('background')
  const dominant = paletteColor('dominant')
  const secondary = paletteColor('secondary')
  const accent = paletteColor('accent')
  const highlight = paletteColor('highlight')
  const contrast = paletteColor('contrast')
  const shadow = paletteColor('shadow')

  const liquidWeight = () => 0.52 + state.phaseWeight(HYDRA_CHROMAFLOW_SCENE_CENTERS.liquidWash, 0.26) * 0.22
  const blobWeight = () => 0.18 + state.phaseWeight(HYDRA_CHROMAFLOW_SCENE_CENTERS.blobFields, 0.2) * 0.46
  const kaleidoWeight = () =>
    0.02 +
    state.phaseWeight(HYDRA_CHROMAFLOW_SCENE_CENTERS.kaleidoBursts, 0.11) * (0.12 + state.symmetryFactor() * 0.18)
  const mirrorWeight = () =>
    Math.min(
      state.qualityProfile.feedbackCeiling,
      0.03 +
        state.phaseWeight(HYDRA_CHROMAFLOW_SCENE_CENTERS.mirrorFeedback, 0.14) * 0.14 +
        state.feedbackFactor() * 0.16,
    )
  const accentWeight = () => 0.01 + state.accentCutLevel() * 0.16

  const liquidWash = h
    .gradient(() => 0.08 + state.speedFactor() * 0.18 + state.sceneChangeFactor() * 0.08)
    .color(...dominant)
    .saturate(() => 1.04 + state.colorfulnessFactor() * 0.76)
    .contrast(() => 1.02 + state.brightnessFactor() * 0.14)
    .modulate(
      h
        .osc(
          () => 1.3 + state.speedFactor() * 2.4,
          () => 0.018 + state.speedFactor() * 0.018,
          () => 0.18 + state.reactiveEnergy() * 0.06,
        )
        .rotate(() => state.sceneClock() * 0.018)
        .color(...secondary),
      () => 0.04 + state.intensityFactor() * 0.1,
    )
    .scrollX(() => Math.sin(state.sceneClock() * 0.06) * 0.035, () => 0.003 + state.speedFactor() * 0.01)
    .scrollY(() => Math.cos(state.sceneClock() * 0.043) * 0.03, () => 0.003 + state.speedFactor() * 0.008)
    .brightness(() => -0.08 + state.brightnessFactor() * 0.06)

  const blobFields = h
    .voronoi(
      () => 2.1 + state.intensityFactor() * 2.6,
      () => 0.08 + state.speedFactor() * 0.12,
      () => 0.18 + state.colorfulnessFactor() * 0.09,
    )
    .thresh(
      () => 0.32 + state.phaseWeight(HYDRA_CHROMAFLOW_SCENE_CENTERS.blobFields, 0.18) * 0.12,
      () => 0.02 + state.reactiveEnergy() * 0.02,
    )
    .posterize(
      () => 3 + Math.floor(state.colorfulnessFactor() * 2),
      () => 0.18 + state.colorfulnessFactor() * 0.2,
    )
    .modulate(
      h.noise(
        () => 0.9 + state.intensityFactor() * (1 + state.qualityProfile.noiseCeiling),
        () => 0.025 + state.speedFactor() * 0.045,
      ),
      () => 0.06 + state.intensityFactor() * 0.12,
    )
    .scale(() => 0.92 + Math.sin(state.sceneClock() * 0.11) * 0.035)
    .rotate(() => Math.sin(state.sceneClock() * 0.07) * 0.08)
    .color(...accent)
    .brightness(() => -0.1 + state.brightnessFactor() * 0.08)

  const kaleidoBursts = h
    .osc(
      () => 2.6 + state.symmetryFactor() * 5.4 + state.reactiveEnergy() * 3.4,
      () => 0.02 + state.speedFactor() * 0.018,
      () => 0.12 + state.reactiveEnergy() * 0.12,
    )
    .kaleid(
      () =>
        3 +
        Math.floor(
          state.symmetryFactor() * 6 +
            state.phaseWeight(HYDRA_CHROMAFLOW_SCENE_CENTERS.kaleidoBursts, 0.11) * 4,
        ),
    )
    .rotate(() => state.sceneClock() * 0.045, () => 0.004 + state.speedFactor() * 0.015)
    .modulateScale(
      h.shape(() => 3 + Math.floor(state.symmetryFactor() * 4), () => 0.33, () => 0.12).color(...secondary),
      () => 0.05 + state.reactiveEnergy() * 0.08,
    )
    .color(...highlight)
    .luma(
      () => 0.28 + state.phaseWeight(HYDRA_CHROMAFLOW_SCENE_CENTERS.kaleidoBursts, 0.11) * 0.14,
      0.12,
    )
    .saturate(() => 1.08 + state.colorfulnessFactor() * 0.42)

  const colorCutAccent = h
    .solid(...contrast)
    .blend(
      h
        .gradient(() => 0.38 + state.speedFactor() * 0.12)
        .color(...highlight)
        .posterize(() => 2 + Math.floor(state.accentCutLevel() * 2), () => 0.22 + state.accentCutLevel() * 0.12),
      () => 0.18 + state.accentCutLevel() * 0.28,
    )
    .thresh(() => 0.42 + state.accentCutLevel() * 0.08, 0.04)
    .brightness(() => -0.12 + state.accentCutLevel() * 0.08)

  liquidWash
    .blend(blobFields, blobWeight)
    .blend(kaleidoBursts, kaleidoWeight)
    .add(colorCutAccent, accentWeight)
    .blend(
      h
        .src(h.o1)
        .scale(() => 0.998 - state.feedbackFactor() * 0.005)
        .rotate(() => 0.006 + state.feedbackFactor() * 0.03)
        .color(...shadow),
      mirrorWeight,
    )
    .blend(h.solid(...background), () => 0.12 + (1 - liquidWeight()) * 0.06)
    .brightness(() => -0.16 + state.brightnessFactor() * 0.2)
    .contrast(() => 1.02 + state.intensityFactor() * 0.16 + state.accentCutLevel() * 0.06)
    .saturate(() => 1.04 + state.colorfulnessFactor() * 0.92)
    .out(h.o0)

  h.src(h.o0)
    .blend(
      h
        .src(h.o1)
        .scale(() => 0.999 - state.feedbackFactor() * 0.004)
        .rotate(() => -0.004 - state.feedbackFactor() * 0.02)
        .color(...shadow),
      () => mirrorWeight() * 0.82,
    )
    .modulate(
      h.noise(
        () => 0.7 + state.qualityProfile.noiseCeiling * 0.9 + state.intensityFactor() * 0.8,
        () => 0.008 + state.speedFactor() * 0.025,
      ),
      () => 0.01 + state.reactiveEnergy() * 0.04,
    )
    .brightness(() => -0.06 + state.brightnessFactor() * 0.08)
    .contrast(() => 1.02 + state.intensityFactor() * 0.08)
    .out(h.o1)

  h.render(h.o1)
}
