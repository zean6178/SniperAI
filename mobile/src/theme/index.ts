/**
 * SniperAI Design System
 * 
 * Inspired by:
 * - Kiro UI: Dark grey backgrounds with purple accents
 * - Phantom Wallet: Clean minimalist buttons, smooth cards, elegant spacing
 * 
 * Color Philosophy:
 * - Background layers: deep charcoal → medium grey → lighter grey
 * - Primary accent: Purple gradient (violet → electric purple)
 * - Success/Danger: Muted green/red for trading signals
 * - Text: White hierarchy with opacity levels
 */

// ═══════════════════════════════════════════════════════════════════════════════
// COLORS
// ═══════════════════════════════════════════════════════════════════════════════

export const colors = {
  // Background layers (darkest → lightest)
  bg: {
    primary: '#0F0F14',       // Deepest background
    secondary: '#1A1A24',     // Cards, elevated surfaces
    tertiary: '#24243A',      // Inputs, nested elements
    hover: '#2E2E48',         // Hover/press states
  },

  // Purple accent spectrum
  purple: {
    50: '#F3EAFF',
    100: '#E0CFFF',
    200: '#C49EFF',
    300: '#A66DFF',
    400: '#8B5CF6',           // Primary purple
    500: '#7C3AED',           // Vibrant purple
    600: '#6D28D9',           // Deep purple
    700: '#5B21B6',
    800: '#4C1D95',
    900: '#3B0F7A',
    gradient: ['#8B5CF6', '#6D28D9'],  // Main gradient
    glow: 'rgba(139, 92, 246, 0.3)',   // Glow effect
  },

  // Text hierarchy
  text: {
    primary: '#FFFFFF',
    secondary: '#A0A0B8',
    tertiary: '#6B6B80',
    disabled: '#454560',
    inverse: '#0F0F14',
  },

  // Status colors
  success: '#4ADE80',         // Green for profit/connected
  danger: '#F87171',          // Red for loss/error
  warning: '#FBBF24',        // Amber for watch/caution
  info: '#60A5FA',           // Blue for info

  // Trading specific
  trade: {
    buy: '#4ADE80',
    sell: '#F87171',
    neutral: '#A0A0B8',
  },

  // Borders
  border: {
    subtle: 'rgba(255, 255, 255, 0.06)',
    default: 'rgba(255, 255, 255, 0.1)',
    strong: 'rgba(139, 92, 246, 0.3)',
    purple: 'rgba(139, 92, 246, 0.5)',
  },

  // Overlays
  overlay: {
    light: 'rgba(255, 255, 255, 0.03)',
    medium: 'rgba(0, 0, 0, 0.5)',
    dark: 'rgba(0, 0, 0, 0.8)',
  },
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
// TYPOGRAPHY
// ═══════════════════════════════════════════════════════════════════════════════

export const typography = {
  // Headers
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '700' as const },
  h4: { fontSize: 16, fontWeight: '600' as const },

  // Body
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodyMedium: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  bodySm: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },

  // Labels
  label: { fontSize: 13, fontWeight: '600' as const },
  labelSm: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.5 },

  // Numbers (for trading data)
  number: { fontSize: 16, fontWeight: '700' as const, fontFamily: 'monospace' },
  numberLg: { fontSize: 24, fontWeight: '800' as const, fontFamily: 'monospace' },
  numberSm: { fontSize: 12, fontWeight: '600' as const, fontFamily: 'monospace' },

  // Caption
  caption: { fontSize: 10, fontWeight: '500' as const, letterSpacing: 0.3 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SHADOWS
// ═══════════════════════════════════════════════════════════════════════════════

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  purple: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// NAVIGATION THEME (for React Navigation)
// ═══════════════════════════════════════════════════════════════════════════════

export const navigationTheme = {
  dark: true,
  colors: {
    primary: colors.purple[400],
    background: colors.bg.primary,
    card: colors.bg.primary,
    text: colors.text.primary,
    border: colors.border.subtle,
    notification: colors.purple[400],
  },
};

export const tabBarTheme = {
  tabBarStyle: {
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: 8,
    paddingBottom: 8,
    height: 64,
  },
  tabBarActiveTintColor: colors.purple[400],
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
  },
};

export const stackTheme = {
  headerStyle: {
    backgroundColor: colors.bg.primary,
    shadowColor: 'transparent',
    elevation: 0,
  },
  headerTintColor: colors.text.primary,
  headerTitleStyle: {
    fontWeight: '700' as const,
    fontSize: 17,
  },
  headerBackTitleVisible: false,
  contentStyle: {
    backgroundColor: colors.bg.primary,
  },
};
