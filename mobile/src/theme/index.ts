/**
 * SniperAI Design System — Electric Cyan Edition v2
 * 
 * Style: Futuristic AI/Web3 · Minimal premium fintech · Sci-fi neon glow
 * Font: Inter / SF Pro Display style (system default)
 * 
 * Color Philosophy:
 * - Dark: Deep Navy #0A1120 base, transparent glass surfaces, cyan neon glow
 * - Light: Soft white with blue tint, clean shadows, blue accents
 * - Primary: Electric Blue #0066FF → Cyan #00E5FF gradient
 * - Glassmorphism: blur + transparency + thin borders
 */

// ═══════════════════════════════════════════════════════════════════════════════
// COLORS — Electric Cyan Palette v2
// ═══════════════════════════════════════════════════════════════════════════════

export const colors = {
  // Primary brand
  primary: {
    blue: '#0066FF',           // Electric Blue — Primary CTA
    cyan: '#00E5FF',           // Electric Cyan — Glow/accent
    soft: '#00B8FF',           // Cyan Soft — Secondary glow
    gradient: ['#0066FF', '#00E5FF'] as const,
    gradientSoft: ['#0066FF', '#00B8FF'] as const,
  },

  // Dark mode backgrounds
  dark: {
    bg: '#0A1120',             // Deep Navy — main background
    surface: '#111827',        // Midnight Navy — card surfaces
    elevated: '#1A2235',       // Slightly lifted surfaces
    glass: 'rgba(255, 255, 255, 0.03)',  // Glass card fill
    glassHover: 'rgba(255, 255, 255, 0.05)',
    input: 'rgba(255, 255, 255, 0.04)',
  },

  // Light mode backgrounds
  light: {
    bg: '#FFFFFF',
    surface: '#F8FBFF',        // Soft blue-tinted white
    elevated: '#FFFFFF',
    card: '#FFFFFF',
    input: '#F0F4FA',
  },

  // Text — Dark mode
  textDark: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.6)',
    tertiary: 'rgba(255, 255, 255, 0.35)',
    disabled: 'rgba(255, 255, 255, 0.2)',
    accent: '#00E5FF',
  },

  // Text — Light mode
  textLight: {
    primary: '#0A1120',
    secondary: '#4A5F78',
    tertiary: '#7A8FA8',
    disabled: '#B0BFD0',
    accent: '#0066FF',
  },

  // Status colors
  success: '#00E676',
  danger: '#FF3D71',
  warning: '#FFB800',
  info: '#00B8FF',

  // Trading
  trade: {
    buy: '#00E676',
    sell: '#FF3D71',
    neutral: 'rgba(255, 255, 255, 0.4)',
  },

  // Borders — Dark
  borderDark: {
    subtle: 'rgba(0, 229, 255, 0.06)',
    default: 'rgba(0, 229, 255, 0.1)',
    strong: 'rgba(0, 229, 255, 0.2)',
    glow: 'rgba(0, 229, 255, 0.3)',
  },

  // Borders — Light
  borderLight: {
    subtle: 'rgba(0, 102, 255, 0.04)',
    default: 'rgba(0, 102, 255, 0.08)',
    strong: 'rgba(0, 102, 255, 0.15)',
  },

  white: '#FFFFFF',
  black: '#000000',
};


// ═══════════════════════════════════════════════════════════════════════════════
// SPACING (8px grid, spacious layout)
// ═══════════════════════════════════════════════════════════════════════════════

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
  hero: 52,
};

// ═══════════════════════════════════════════════════════════════════════════════
// BORDER RADIUS — Rounded XL corners
// ═══════════════════════════════════════════════════════════════════════════════

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  card: 20,
  button: 999,     // Pill buttons
  avatar: 14,      // Rounded square avatars
  full: 999,
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPOGRAPHY — SF Pro / Inter style (bold modern sans-serif)
// ═══════════════════════════════════════════════════════════════════════════════

export const typography = {
  // Hero
  hero: { fontSize: 44, fontWeight: '800' as const, letterSpacing: -1.5 },
  heroSub: { fontSize: 14, fontWeight: '400' as const, letterSpacing: 0.5 },

  // Headers — Large bold
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.8 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.5 },
  h3: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.3 },
  h4: { fontSize: 15, fontWeight: '700' as const, letterSpacing: -0.2 },

  // Body
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodyMedium: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  bodySm: { fontSize: 12, fontWeight: '400' as const, lineHeight: 17 },

  // Labels
  label: { fontSize: 13, fontWeight: '600' as const },
  labelSm: { fontSize: 10, fontWeight: '500' as const, letterSpacing: 0.8 },

  // Numbers
  number: { fontSize: 14, fontWeight: '800' as const, fontFamily: 'monospace' },
  numberLg: { fontSize: 22, fontWeight: '800' as const, fontFamily: 'monospace' },
  numberSm: { fontSize: 12, fontWeight: '700' as const, fontFamily: 'monospace' },

  // Caption
  caption: { fontSize: 10, fontWeight: '500' as const, letterSpacing: 0.3 },

  // Button
  button: { fontSize: 16, fontWeight: '700' as const, letterSpacing: 0.3 },
  buttonSm: { fontSize: 14, fontWeight: '600' as const },

  // Nav
  navLabel: { fontSize: 10, fontWeight: '500' as const, letterSpacing: 0.3 },
};


// ═══════════════════════════════════════════════════════════════════════════════
// SHADOWS
// ═══════════════════════════════════════════════════════════════════════════════

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  // Neon glow shadows
  cyanGlow: {
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  blueGlow: {
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
  ctaGlow: {
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 10,
  },
  // Light mode card shadow
  cardLight: {
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// GLASSMORPHISM — Dark mode glass cards
// ═══════════════════════════════════════════════════════════════════════════════

export const glass = {
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.08)',
    borderRadius: 20,
  },
  cardHover: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
    borderRadius: 20,
  },
  surface: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
  },
  nav: {
    backgroundColor: 'rgba(10, 17, 32, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 229, 255, 0.06)',
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
// NAVIGATION THEME (React Navigation)
// ═══════════════════════════════════════════════════════════════════════════════

export const navigationTheme = {
  dark: true,
  colors: {
    primary: colors.primary.cyan,
    background: colors.dark.bg,
    card: colors.dark.bg,
    text: colors.textDark.primary,
    border: colors.borderDark.subtle,
    notification: colors.primary.blue,
  },
};

export const tabBarTheme = {
  tabBarStyle: {
    backgroundColor: 'rgba(10, 17, 32, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 229, 255, 0.06)',
    paddingTop: 8,
    paddingBottom: 12,
    height: 80,
    position: 'absolute' as const,
  },
  tabBarActiveTintColor: colors.primary.cyan,
  tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.3)',
  tabBarLabelStyle: {
    fontSize: 10,
    fontWeight: '500' as const,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  tabBarIconStyle: {
    marginTop: 4,
  },
  headerStyle: {
    backgroundColor: colors.dark.bg,
    shadowColor: 'transparent',
    elevation: 0,
  },
  headerTintColor: colors.textDark.primary,
  headerTitleStyle: {
    fontWeight: '700' as const,
    fontSize: 18,
    letterSpacing: -0.3,
  },
};

export const stackTheme = {
  headerStyle: {
    backgroundColor: colors.dark.bg,
    shadowColor: 'transparent',
    elevation: 0,
  },
  headerTintColor: colors.primary.cyan,
  headerTitleStyle: {
    fontWeight: '700' as const,
    fontSize: 17,
    color: colors.textDark.primary,
    letterSpacing: -0.3,
  },
  headerBackTitleVisible: false,
  contentStyle: {
    backgroundColor: colors.dark.bg,
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
// BACKWARD COMPATIBILITY — Old color references (used by existing screens)
// Will be removed once all screens are fully migrated.
// ═══════════════════════════════════════════════════════════════════════════════

// Re-export colors with legacy aliases so existing imports don't break
export const legacyColors = {
  bg: {
    primary: colors.dark.bg,
    secondary: colors.dark.surface,
    tertiary: colors.dark.elevated,
    hover: colors.dark.glassHover,
    glass: colors.dark.glass,
  },
  cyan: {
    400: colors.primary.cyan,
    50: '#E0FBFF',
    gradient: colors.primary.gradient,
    glow: 'rgba(0, 229, 255, 0.3)',
  },
  blue: {
    400: colors.primary.blue,
  },
  text: {
    primary: colors.textDark.primary,
    secondary: colors.textDark.secondary,
    tertiary: colors.textDark.tertiary,
    disabled: colors.textDark.disabled,
    cyan: colors.primary.cyan,
  },
  border: {
    subtle: colors.borderDark.subtle,
    default: colors.borderDark.default,
    strong: colors.borderDark.strong,
  },
  success: colors.success,
  danger: colors.danger,
  warning: colors.warning,
  trade: colors.trade,
};

// Merge legacy into main colors export for backward compat
Object.assign(colors, {
  bg: legacyColors.bg,
  cyan: legacyColors.cyan,
  blue: legacyColors.blue,
  text: legacyColors.text,
  border: legacyColors.border,
});
