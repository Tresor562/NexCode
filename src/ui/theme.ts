export const theme = {
  colors: {
    background: '#060912',
    backgroundElevated: '#090E1A',
    surface: '#0C1220',
    surfaceRaised: '#121B2E',
    // High-emphasis interactive surfaces (Lab tabs, file rows, compact controls)
    // keep a distinct elevation layer so active/editable state reads instantly
    // without depending on glow or motion alone.
    surfaceStrong: '#192640',
    surfaceSoft: '#151F35',
    surfaceGlass: 'rgba(255,255,255,.052)',
    surfaceGlassStrong: 'rgba(255,255,255,.082)',
    surfaceCard: 'rgba(16,23,40,.94)',
    surfaceStat: 'rgba(255,255,255,.042)',
    surfaceShimmer: 'rgba(255,255,255,.14)',
    border: '#202D49',
    borderStrong: '#344665',
    borderGlass: 'rgba(255,255,255,.105)',
    borderSubtle: 'rgba(255,255,255,.068)',
    borderSoft: 'rgba(255,255,255,.082)',
    borderControl: 'rgba(255,255,255,.095)',
    borderEmphasis: 'rgba(255,255,255,.15)',
    text: '#F8FAFF',
    textSecondary: '#ADB8D0',
    // Muted copy is still functional UI throughout lessons, Lab counters and
    // navigation hints, so keep it comfortably readable on dark surfaces.
    textMuted: '#8793AD',
    // Primary actions carry white text throughout the shared mobile UI. Keep the
    // brand indigo vivid while meeting normal-text contrast instead of relying on
    // font weight or glow to make core learning CTAs readable.
    primary: '#5367E8',
    primaryBright: '#94A1FF',
    primarySoft: '#222E66',
    primaryGlass: 'rgba(114,130,255,.17)',
    primarySurface: 'rgba(54,69,151,.31)',
    primaryBorder: 'rgba(145,159,255,.30)',
    primaryBorderStrong: 'rgba(151,165,255,.39)',
    primaryText: '#C1C9FF',
    primaryTextSoft: '#BAC4FF',
    cyan: '#63DEFF',
    purple: '#B18AFF',
    success: '#62E6A1',
    successSoft: '#102B20',
    successSurface: 'rgba(31,108,72,.23)',
    successGlass: 'rgba(67,200,126,.13)',
    successBorder: 'rgba(90,220,151,.26)',
    successBorderStrong: 'rgba(70,205,132,.29)',
    warning: '#FFD071',
    warningGlass: 'rgba(239,188,69,.13)',
    warningBorder: 'rgba(239,188,69,.27)',
    danger: '#FF8191',
    code: '#080D18',
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
    // 12pt is the floor for recurring compact learning UI. Counters, pills and
    // metadata carry real learning context throughout long practice sessions, so
    // keep them readable at a glance instead of treating them as decorative text.
    caption: 12,
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
  card: {
    shadowColor: theme.colors.black,
    shadowOpacity: 0.27,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 11 },
    elevation: 6,
  },
  control: {
    shadowColor: theme.colors.black,
    shadowOpacity: 0.22,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  primaryGlow: {
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 7,
  },
} as const;