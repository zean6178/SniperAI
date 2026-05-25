/**
 * SniperAI Design System — Electric Cyan Edition
 * 
 * Style: Futuristic AI/Web3 UI · Sci-fi operating system feel · Premium neon aesthetic
 * 
 * Color Philosophy:
 * - Background: Black Blue → Deep Navy gradient layers
 * - Primary: Electric Cyan (#00E5FF) with Neon Blue (#0066FF) gradient
 * - Glow effects: Cyan neon with soft radiance
 * - High contrast text on dark backgrounds
 * - Glassmorphism cards with cyan border accents
 */

// ═══════════════════════════════════════════════════════════════════════════════
// COLORS — Electric Cyan Palette
// ═══════════════════════════════════════════════════════════════════════════════

export const colors = {
  // Background layers (darkest → lightest)
  bg: {
    primary: '#050B14',       // Black Blue — deepest background
    secondary: '#0A1A2E',     // Deep Navy — cards, elevated surfaces
    tertiary: '#0F2440',      // Slightly lighter navy — inputs, nested elements
    hover: '#133052',         // Hover/press states
    glass: 'rgba(10, 26, 46, 0.85)',  // Glassmorphism background
  },

  // Cyan accent spectrum
  cyan: {
    50: '#E0FBFF',
    100: '#B3F5FF',
    200: '#66ECFF',
    300: '#33E8FF',
    400: '#00E5FF',           // Electric Cyan — Primary
    500: '#00CCE5',
    600: '#00B3CC',
    700: '#0099B3',
    800: '#008099',
    900: '#006680',
    gradient: ['#0066FF', '#00E5FF'],  // Main gradient (Neon Blue → Electric Cyan)
    glow: 'rgba(0, 229, 255, 0.3)',    // Glow effect
    glowStrong: 'rgba(0, 229, 255, 0.5)',
  },

  // Neon Blue accent
  blue: {
    400: '#0066FF',           // Neon Blue
    500: '#0055DD',
    600: '#0044BB',
    gradient: ['#0066FF', '#00E5FF'],
  },

  // Text hierarchy
  text: {
    primary: '#FFFFFF',
    secondary: '#B0C4D8',
    tertiary: '#5A7A9A',
    disabled: '#2A4A6A',
    inverse: '#050B14',
    cyan: '#00E5FF',
  },

  // Status colors
  success: '#00E676',         // Neon green for profit
  danger: '#FF3D71',          // Neon red for loss
  warning: '#FFD600',         // Bright amber for caution
  info: '#00B0FF',            // Info blue

  // Trading specific
  trade: {
    buy: '#00E676',
    sell: '#FF3D71',
    neutral: '#5A7A9A',
  },

  // Borders
  border: {
    subtle: 'rgba(0, 229, 255, 0.08)',
    default: 'rgba(0, 229, 255, 0.15)',
    strong: 'rgba(0, 229, 255, 0.3)',
    cyan: 'rgba(0, 229, 255, 0.5)',
    glow: 'rgba(0, 229, 255, 0.4)',
  },

  // Overlays
  overlay: {
    light: 'rgba(0, 229, 255, 0.03)',
    medium: 'rgba(0, 0, 0, 0.6)',
    dark: 'rgba(0, 0, 0, 0.85)',
    glass: 'rgba(10, 26, 46, 0.7)',
  },

  // Special
  white: '#FFFFFF',
  black: '#050B14',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SPACING (8px grid)
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
  hero: 60,
};

// ═══════════════════════════════════════════════════════════════════════════════
// BORDER RADIUS
// ═══════════════════════════════════════════════════════════════════════════════

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPOGRAPHY — Poppins-inspired (System font fallback)
// ═══════════════════════════════════════════════════════════════════════════════

export const typography = {
  // Headers — Semibold/Bold
  h1: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 24, fontWeight: '600' as const, letterSpacing: -0.3 },
  h3: { fontSize: 20, fontWeight: '600' as const },
  h4: { fontSize: 16, fontWeight: '600' as const },

  // Hero
  hero: { fontSize: 42, fontWeight: '700' as const, letterSpacing: -1 },
  heroSub: { fontSize: 16, fontWeight: '500' as const, letterSpacing: 0.5 },

  // Body — Regular/Medium
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodyMedium: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  bodySm: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },

  // Labels — Semibold
  label: { fontSize: 13, fontWeight: '600' as const },
  labelSm: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.5 },

  // Numbers (monospace for trading data)
  number: { fontSize: 16, fontWeight: '700' as const, fontFamily: 'monospace' },
  numberLg: { fontSize: 24, fontWeight: '800' as const, fontFamily: 'monospace' },
  numberSm: { fontSize: 12, fontWeight: '600' as const, fontFamily: 'monospace' },

  // Caption
  caption: { fontSize: 10, fontWeight: '500' as const, letterSpacing: 0.3 },

  // Button
  button: { fontSize: 16, fontWeight: '600' as const, letterSpacing: 0.3 },
  buttonSm: { fontSize: 14, fontWeight: '600' as const },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SHADOWS — Neon Cyan Glow
// ═══════════════════════════════════════════════════════════════════════════════

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  cyan: {
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  cyanStrong: {
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  neonBlue: {
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// GLASSMORPHISM STYLES
// ═══════════════════════════════════════════════════════════════════════════════

export const glass = {
  card: {
    backgroundColor: 'rgba(10, 26, 46, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.12)',
    borderRadius: 16,
  },
  cardHover: {
    backgroundColor: 'rgba(10, 26, 46, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    borderRadius: 16,
  },
  surface: {
    backgroundColor: 'rgba(10, 26, 46, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.08)',
    borderRadius: 12,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// NAVIGATION THEME (React Navigation)
// ═══════════════════════════════════════════════════════════════════════════════

export const navigationTheme = {
  dark: true,
  colors: {
    primary: colors.cyan[400],
    background: colors.bg.primary,
    card: colors.bg.primary,
    text: colors.text.primary,
    border: colors.border.subtle,
    notification: colors.cyan[400],
  },
};

export const tabBarTheme = {
  tabBarStyle: {
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: 8,
    paddingBottom: 8,
    height: 70,
  },
  tabBarActiveTintColor: colors.cyan[400],
  tabBarInactiveTintColor: colors.text.tertiary,
  tabBarLabelStyle: {
    fontSize: 11,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  headerStyle: {
    backgroundColor: colors.bg.primary,
    shadowColor: 'transparent',
    elevation: 0,
  },
  headerTintColor: colors.text.primary,
  headerTitleStyle: {
    fontWeight: '700' as const,
    fontSize: 18,
    color: colors.cyan[400],
  },
};

export const stackTheme = {
  headerStyle: {
    backgroundColor: colors.bg.primary,
    shadowColor: 'transparent',
    elevation: 0,
  },
  headerTintColor: colors.cyan[400],
  headerTitleStyle: {
    fontWeight: '700' as const,
    fontSize: 17,
    color: colors.text.primary,
  },
  headerBackTitleVisible: false,
  contentStyle: {
    backgroundColor: colors.bg.primary,
  },
};
