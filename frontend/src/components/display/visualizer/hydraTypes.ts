export type HydraFactory = new (options: Record<string, unknown>) => HydraInstance

export type HydraInstance = {
  canvas: HTMLCanvasElement
  synth: HydraSynth
  tick: (dt: number) => void
  setResolution: (width: number, height: number) => void
  hush: () => void
  regl?: {
    destroy?: () => void
  }
}

export type HydraOutput = Record<string, unknown>

export type HydraChain = {
  out: (output?: HydraOutput) => HydraChain
  blend: (source: HydraChain, amount?: number | (() => number)) => HydraChain
  add: (source: HydraChain, amount?: number | (() => number)) => HydraChain
  diff: (source: HydraChain, amount?: number | (() => number)) => HydraChain
  mult: (source: HydraChain, amount?: number | (() => number)) => HydraChain
  modulate: (source: HydraChain, amount?: number | (() => number)) => HydraChain
  modulateScale: (source: HydraChain, amount?: number | (() => number)) => HydraChain
  modulateRotate: (source: HydraChain, amount?: number | (() => number)) => HydraChain
  color: (...args: Array<number | (() => number)>) => HydraChain
  colorama: (amount?: number | (() => number)) => HydraChain
  saturate: (amount?: number | (() => number)) => HydraChain
  contrast: (amount?: number | (() => number)) => HydraChain
  brightness: (amount?: number | (() => number)) => HydraChain
  rotate: (...args: Array<number | (() => number)>) => HydraChain
  scale: (...args: Array<number | (() => number)>) => HydraChain
  scrollX: (...args: Array<number | (() => number)>) => HydraChain
  scrollY: (...args: Array<number | (() => number)>) => HydraChain
  kaleid: (segments?: number | (() => number)) => HydraChain
  posterize: (...args: Array<number | (() => number)>) => HydraChain
  thresh: (...args: Array<number | (() => number)>) => HydraChain
  luma: (...args: Array<number | (() => number)>) => HydraChain
  repeat: (...args: Array<number | (() => number)>) => HydraChain
  pixelate: (...args: Array<number | (() => number)>) => HydraChain
}

export type HydraSynth = {
  speed: number
  o0: HydraOutput
  o1: HydraOutput
  o2: HydraOutput
  o3: HydraOutput
  render: (output?: HydraOutput) => void
  osc: (...args: Array<number | (() => number)>) => HydraChain
  noise: (...args: Array<number | (() => number)>) => HydraChain
  voronoi: (...args: Array<number | (() => number)>) => HydraChain
  shape: (...args: Array<number | (() => number)>) => HydraChain
  gradient: (...args: Array<number | (() => number)>) => HydraChain
  solid: (...args: Array<number | (() => number)>) => HydraChain
  src: (source: HydraOutput) => HydraChain
}
