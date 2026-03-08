import { createVuetify } from 'vuetify'

const theme = {
  dark: true,
  colors: {
    background: '#0f1115',
    surface: '#171a21',
    primary: '#67d4ff',
    secondary: '#ffb454',
    success: '#57d98d',
    warning: '#ffc857',
    error: '#ff6b6b',
  },
}

export default createVuetify({
  theme: {
    defaultTheme: 'raveberg',
    themes: {
      raveberg: theme,
    },
  },
  defaults: {
    VCard: {
      rounded: 'lg',
      variant: 'tonal',
    },
  },
})
