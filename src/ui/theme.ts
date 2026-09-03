export const theme = {
  colors: {
    background: '#070A12',
    backgroundElevated: '#0A0F1B',
    surface: '#0D1220',
    surfaceRaised: '#121A2D',
    // High-emphasis interactive surfaces (Lab tabs, file rows, compact controls)
    // get a distinct elevation layer so active/editable state is perceptible at
    // a glance without relying on borders, glow or motion alone.
    surfaceStrong: '#18233B',
    surfaceSoft: '#171F34',
    surfaceGlass: 'rgba(255,255,255,.055)',
    surfaceGlassStrong: 'rgba(255,255,255,.085)',
    surfaceCard: 'rgba(17,23,39,.92)',
    surfaceStat: 'rgba(255,255,255,.045)',
    surfaceShimmer: 'rgba(255,255,255,.15)',
    border: '#202B45',
    borderStrong: '#31405F',
    borderGlass: 'rgba(255,255,255,.10)',
    borderSubtle: 'rgba(255,255,255,.07)',
    borderSoft: 'rgba(255,255,255,.08)',
    borderControl: 'rgba(255,255,255,.09)',
    borderEmphasis: 'rgba(255,255,255,.14)',
    text: '#F7F9FF',
    textSecondary: '#A7B0C6',
    // Muted copy is still secondary information, but it appears throughout
    // lesson metadata, Lab counters and navigation hints. Keep it above a
    // comfortable AA contrast threshold on the darkest premium surfaces.
    textMuted: '#7E89A3',
    primary: '#6D7CFF',
    primaryBright: '#8996FF',
    primarySoft: '#202A5D',
    primaryGlass: 'rgba(109,124,255,.16)',
    primarySurface: 'rgba(50,63,133,.30)',
    primaryBorder: 'rgba(132,148,255,.28)',
    primaryBorderStrong: 'rgba(135,149,255,.35)',
    primaryText: '#B7C0FF',
    primaryTextSoft: '#B4BDFF',
    cyan: '#56D6FF',
    purple: '#A77BFF',
    success: '#5BE39A',
    successSoft: '#10291E',
    successSurface: 'rgba(31,101,68,.22)',
    successGlass: 'rgba(61,190,117,.12)',
    successBorder: 'rgba(79,210,139,.24)',
    successBorderStrong: 'rgba(61,190,117,.25)',
    warning: '#FFCA66',
    warningGlass: 'rgba(232,180,64,.12)',
    warningBorder: 'rgba(232,180,64,.24)',
    danger: '#FF788A',
    code: '#090E19',
    white: '#FFFFFF',
    black: '#000000',
  },
  radius: {
    xs: 8,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
    xxl: 26,
    pill: 999,
  },
  space: {
    xxs: 4,
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 32,
    xxxl: 40,
  },
  type: {
    caption: 10.5,
    label: 12,
    body: 14,
    bodyLarge: 16,
    title: 18,
    titleLarge: 22,
    display: 28,
  },
  weight: {
    medium: '600' as const,
    semibold: '700' as const,
    bold: '800' as const,
    black: '900' as const,
  },
  control: {
    // Keep compact controls at a minimum 44pt touch target so shared navigation
    // and icon actions stay comfortably tappable on dense mobile layouts.
    heightSm: 44,
    heightMd: 48,
    heightLg: 54,
  },
  motion: {
    // Shared buttons should feel responsive rather than rubbery: a shallow
    // physical press, small scale change, and fast low-bounce recovery keeps
    // repeated learning actions crisp without adding persistent motion.
    pressedScale: 0.982,
    pressedDepth: 2,
    springSpeed: 32,
    springBounciness: 3,
  },
} as const;

export const shadows = {
  card: {
    shadowColor: theme.colors.black,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  control: {
    shadowColor: theme.colors.black,
    shadowOpacity: 0.20,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  primaryGlow: {
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.30,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 9 },
    elevation: 6,
  },
} as const;
