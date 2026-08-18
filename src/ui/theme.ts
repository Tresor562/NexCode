export const theme = {
  colors: {
    background: '#070A12',
    surface: '#0D1220',
    surfaceRaised: '#121A2D',
    surfaceSoft: '#171F34',
    border: '#202B45',
    borderStrong: '#31405F',
    text: '#F7F9FF',
    textSecondary: '#A7B0C6',
    textMuted: '#69758F',
    primary: '#6D7CFF',
    primarySoft: '#202A5D',
    cyan: '#56D6FF',
    purple: '#A77BFF',
    success: '#5BE39A',
    successSoft: '#10291E',
    warning: '#FFCA66',
    danger: '#FF788A',
    code: '#090E19',
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 20,
    xl: 26,
    pill: 999,
  },
  space: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
} as const;

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
};
