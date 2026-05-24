/**
 * SniperAI Design System
 * 
 * Inspired by:
 * - Kiro UI: Dark grey backgrounds with purple accents
 * - Phantom Wallet: Clean minimalist buttons, smooth cards, elegant spacing
 * 
 * Color Philosophy:
 * - Dark Mode: deep charcoal → medium grey → lighter grey
 * - Light Mode: white → light grey → soft purple tints
 * - Primary accent: Purple gradient (violet → electric purple)
 * - Success/Danger: Muted green/red for trading signals
 * - Text: hierarchy with opacity levels
 */

// ═══════════════════════════════════════════════════════════════════════════════
// THEME MODE TYPE
// ═══════════════════════════════════════════════════════════════════════════════

export type ThemeMode = 'dark' | 'light';

// ═══════════════════════════════════════════════════════════════════════════════
// COLORS — DARK MODE (default)
// ═══════════════════════════════════════════════════════════════════════════════

export const darkColors = {
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
// COLORS — LIGHT MODE
// ═══════════════════════════════════════════════════════════════════════════════

export const lightColors = {
  // Background layers (lightest → medium)
  bg: {
    primary: '#FFFFFF',       // Main background (white)
    secondary: '#F5F3FF',     // Cards (soft purple tint)
    tertiary: '#EDE9FE',      // Inputs, nested (lavender)
    hover: '#DDD6FE',         // Hover/press states
  },

  // Purple accent spectrum (same as dark — brand consistency)
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
    gradient: ['#8B5CF6', '#6D28D9'],
    glow: 'rgba(139, 92, 246, 0.2)',
  },

  // Text hierarchy
  text: {
    primary: '#1A1A2E',       // Near black
    secondary: '#4A4A68',     // Dark grey
    tertiary: '#8888A0',      // Medium grey
    disabled: '#B8B8D0',      // Light grey
    inverse: '#FFFFFF',
  },

  // Status colors (slightly deeper for light bg)
  success: '#16A34A',         // Green
  danger: '#DC2626',          // Red
  warning: '#D97706',         // Amber
  info: '#2563EB',            // Blue

  // Trading specific
  trade: {
    buy: '#16A34A',
    sell: '#DC2626',
    neutral: '#6B7280',
  },

  // Borders
  border: {
    subtle: 'rgba(0, 0, 0, 0.06)',
    default: 'rgba(0, 0, 0, 0.1)',
    strong: 'rgba(139, 92, 246, 0.2)',
    purple: 'rgba(139, 92, 246, 0.3)',
  },

  // Overlays
  overlay: {
    light: 'rgba(0, 0, 0, 0.02)',
    medium: 'rgba(0, 0, 0, 0.3)',
    dark: 'rgba(0, 0, 0, 0.6)',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVE COLORS (resolved by theme mode)
// ═══════════════════════════════════════════════════════════════════════════════

export function getColors(mode: ThemeMode = 'dark') {
  return mode === 'dark' ? darkColors : lightColors;
}

/** Default export for backward compatibility — uses dark mode */
export const colors = darkColors;

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
// NAVIGATION THEME (for React Navigation) — supports light/dark
// ═══════════════════════════════════════════════════════════════════════════════

export function getNavigationTheme(mode: ThemeMode = 'dark') {
  const c = getColors(mode);
  return {
    dark: mode === 'dark',
    colors: {
      primary: c.purple[400],
      background: c.bg.primary,
      card: c.bg.primary,
      text: c.text.primary,
      border: c.border.subtle,
      notification: c.purple[400],
    },
  };
}

export function getTabBarTheme(mode: ThemeMode = 'dark') {
  const c = getColors(mode);
  return {
    tabBarStyle: {
      backgroundColor: c.bg.primary,
      borderTopWidth: 1,
      borderTopColor: c.border.subtle,
      paddingTop: 8,
      paddingBottom: 8,
      height: 64,
    },
    tabBarActiveTintColor: c.purple[400],
    tabBarInactiveTintColor: c.text.tertiary,
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '600' as const,
      marginTop: 2,
    },
    headerStyle: {
      backgroundColor: c.bg.primary,
      shadowColor: 'transparent',
      elevation: 0,
    },
    headerTintColor: c.text.primary,
    headerTitleStyle: {
      fontWeight: '700' as const,
      fontSize: 18,
    },
  };
}

export function getStackTheme(mode: ThemeMode = 'dark') {
  const c = getColors(mode);
  return {
    headerStyle: {
      backgroundColor: c.bg.primary,
      shadowColor: 'transparent',
      elevation: 0,
    },
    headerTintColor: c.text.primary,
    headerTitleStyle: {
      fontWeight: '700' as const,
      fontSize: 17,
    },
    headerBackTitleVisible: false,
    contentStyle: {
      backgroundColor: c.bg.primary,
    },
  };
}

/** Backward-compatible defaults (dark mode) */
export const navigationTheme = getNavigationTheme('dark');
export const tabBarTheme = getTabBarTheme('dark');
export const stackTheme = getStackTheme('dark');
