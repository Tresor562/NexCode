export const theme = {
  colors: {
    background: '#050812',
    backgroundElevated: '#080D19',
    surface: '#0B1220',
    surfaceRaised: '#121D31',
    // High-emphasis interactive surfaces (Lab tabs, file rows, compact controls)
    // keep a distinct elevation layer so active/editable state reads instantly
    // without depending on glow or motion alone.
    surfaceStrong: '#192843',
    surfaceSoft: '#142038',
    surfaceGlass: 'rgba(255,255,255,.052)',
    surfaceGlassStrong: 'rgba(255,255,255,.086)',
    surfaceCard: 'rgba(14,22,39,.965)',
    surfaceStat: 'rgba(255,255,255,.046)',
    surfaceShimmer: 'rgba(255,255,255,.15)',
    border: '#21304D',
    borderStrong: '#384D70',
    borderGlass: 'rgba(255,255,255,.12)',
    borderSubtle: 'rgba(255,255,255,.076)',
    borderSoft: 'rgba(255,255,255,.088)',
    borderControl: 'rgba(255,255,255,.105)',
    borderEmphasis: 'rgba(255,255,255,.17)',
    text: '#F8FAFF',
    textSecondary: '#B2BED6',
    // Muted copy is still functional UI throughout lessons, Lab counters and
    // navigation hints, so keep it comfortably readable on dark surfaces.
    textMuted: '#8B97B2',
    // Primary actions carry white text throughout the shared mobile UI. Keep the
    // brand indigo vivid while meeting normal-text contrast instead of relying on
    // font weight or glow to make core learning CTAs readable.
    primary: '#5367E8',
    primaryBright: '#9BA7FF',
    primarySoft: '#222F68',
    primaryGlass: 'rgba(114,130,255,.18)',
    primarySurface: 'rgba(54,69,151,.34)',
    primaryBorder: 'rgba(145,159,255,.32)',
    primaryBorderStrong: 'rgba(151,165,255,.42)',
    primaryText: '#C7CEFF',
    primaryTextSoft: '#C0C9FF',
    cyan: '#68E1FF',
    purple: '#B690FF',
    success: '#66E8A5',
    successSoft: '#102D21',
    successSurface: 'rgba(31,108,72,.25)',
    successGlass: 'rgba(67,200,126,.14)',
    successBorder: 'rgba(90,220,151,.28)',
    successBorderStrong: 'rgba(70,205,132,.32)',
    warning: '#FFD276',
    warningGlass: 'rgba(239,188,69,.14)',
    warningBorder: 'rgba(239,188,69,.30)',
    danger: '#FF8796',
    code: '#070C17',
    white: '#FFFFFF',
    black: '#000000',
  },
  radius: {
    xs: 8,
    sm: 10,
    md: 14,
    lg: 19,
    xl: 24,
    xxl: 30,
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
    // Learning copy is read repeatedly in short, high-focus sessions. Keep compact
    // metadata at 13pt, then give instructions and hierarchy a deliberate step up
    // so lesson prompts, Lab guidance and project surfaces do not feel compressed.
    caption: 13,
    label: 13,
    body: 15,
    bodyLarge: 17,
    title: 19,
    titleLarge: 24,
    display: 30,
  },
  weight: {
    medium: '600' as const,
    semibold: '700' as const,
    bold: '800' as const,
    black: '900' as const,
  },
  control: {
    // Shared icon controls are repeated constantly across Lab and learning flows.
    // Keep even the compact size at 48pt so the visible target itself is generous
    // on phones instead of relying on invisible hitSlop to rescue a tiny control.
    heightSm: 48,
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
    // Shared progress motion is brief and purposeful. Normal increments glide
    // quickly, while reaching 100% gets one finite halo pulse rather than a
    // perpetual glow. Reduced-motion and background states resolve instantly.
    progressDuration: 280,
    progressCompletionIn: 160,
    progressCompletionOut: 280,
    progressCompletionScale: 1.035,
    // Bottom navigation is one of the most repeated interactions in the app.
    // Keep its emphasis restrained and centralize the spring so every glyph feels
    // like the same product instead of carrying component-local animation tuning.
    navInactiveOpacity: 0.82,
    navActiveScale: 1.06,
    navHaloRestScale: 0.76,
    navSpringDamping: 18,
    navSpringStiffness: 230,
    navSpringMass: 0.65,
    // Learning-path motion follows one compact vocabulary: a short arrival,
    // restrained finite emphasis, and a quick completion confirmation. Keeping
    // these values here prevents individual nodes from drifting into a different
    // motion language as the curriculum UI evolves.
    pathPressDepth: 4,
    pathPressedScale: 0.965,
    pathPressSpringSpeed: 34,
    pathPressSpringBounciness: 0,
    pathArrivalDuration: 360,
    pathArrivalScale: 0.9,
    pathArrivalOffset: 7,
    pathArrivalOvershoot: 1.18,
    pathPulseDuration: 1500,
    pathPulseIterations: 3,
    pathShimmerDelay: 380,
    pathShimmerDuration: 920,
    pathShimmerRest: 1100,
    pathShimmerIterations: 2,
    pathCompletionSpringSpeed: 20,
    pathCompletionSpringBounciness: 8,
    pathCompletionTrailDuration: 420,
    pathCompletionHaloIn: 160,
    pathCompletionHaloOut: 260,
  },
} as const;

export const shadows = {
  // A broad, soft ambient shadow makes elevated cards read as one coherent
  // premium layer on Android/iOS without turning every panel into a glowing tile.
  card: {
    shadowColor: theme.colors.black,
    shadowOpacity: 0.33,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  // Compact controls keep a tighter depth footprint so repeated Lab actions do
  // not visually compete with cards and primary learning calls to action.
  control: {
    shadowColor: theme.colors.black,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  // Primary actions carry a slightly wider brand-tinted lift. The opacity stays
  // controlled so legibility comes from contrast and hierarchy, not neon glow.
  primaryGlow: {
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.38,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 9,
  },
} as const;