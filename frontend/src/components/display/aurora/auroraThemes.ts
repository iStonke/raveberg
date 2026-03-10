export type AuroraColorMode = 'cool' | 'party' | 'elegant'

export type AuroraTheme = {
  backgroundTop: string
  backgroundBottom: string
  aurora: string[]
  fog: string[]
  particles: string[]
  accent: string
}

export const AURORA_THEMES: Record<AuroraColorMode, AuroraTheme> = {
  cool: {
    backgroundTop: '#03111b',
    backgroundBottom: '#071a2c',
    aurora: ['88, 228, 255', '92, 152, 255', '170, 118, 255'],
    fog: ['34, 91, 140', '24, 126, 168', '74, 73, 149'],
    particles: ['236, 248, 255', '136, 220, 255', '157, 170, 255'],
    accent: '255, 196, 228',
  },
  party: {
    backgroundTop: '#060f18',
    backgroundBottom: '#13192c',
    aurora: ['58, 229, 255', '151, 109, 255', '255, 96, 188'],
    fog: ['18, 120, 150', '74, 56, 138', '119, 39, 114'],
    particles: ['244, 248, 255', '103, 231, 255', '255, 171, 223'],
    accent: '255, 215, 162',
  },
  elegant: {
    backgroundTop: '#040d17',
    backgroundBottom: '#111828',
    aurora: ['91, 195, 255', '115, 138, 240', '207, 130, 215'],
    fog: ['29, 74, 118', '58, 63, 120', '70, 46, 88'],
    particles: ['247, 248, 252', '182, 211, 255', '234, 204, 225'],
    accent: '245, 209, 176',
  },
}
