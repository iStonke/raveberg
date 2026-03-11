declare module 'vanta/dist/vanta.fog.min' {
  const effectFactory: (options: Record<string, unknown>) => {
    destroy?: () => void
    resize?: () => void
    setOptions?: (options: Record<string, unknown>) => void
  }
  export default effectFactory
}

declare module 'vanta/dist/vanta.halo.min' {
  const effectFactory: (options: Record<string, unknown>) => {
    destroy?: () => void
    resize?: () => void
    setOptions?: (options: Record<string, unknown>) => void
  }
  export default effectFactory
}
