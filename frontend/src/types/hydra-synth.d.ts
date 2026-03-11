declare module 'hydra-synth' {
  const Hydra: new (options: Record<string, unknown>) => {
    canvas: HTMLCanvasElement
    synth: Record<string, unknown>
    tick: (dt: number) => void
    setResolution: (width: number, height: number) => void
    hush: () => void
    regl?: {
      destroy?: () => void
    }
  }

  export default Hydra
}
