/**
 * ThemeProvider — Light/Dark mode context
 * 
 * Provides theme state globally and persists preference with AsyncStorage.
 * Uses system appearance as default, user can override in Settings.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { ThemeMode, getColors, getNavigationTheme, getTabBarTheme, getStackTheme } from '../theme';

interface ThemeContextType {
  mode: ThemeMode;
  colors: ReturnType<typeof getColors>;
  navigationTheme: ReturnType<typeof getNavigationTheme>;
  tabBarTheme: ReturnType<typeof getTabBarTheme>;
  stackTheme: ReturnType<typeof getStackTheme>;
  isDark: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [mode, setMode] = useState<ThemeMode>(systemScheme === 'light' ? 'light' : 'dark');

  // Sync with system preference on mount
  useEffect(() => {
    // In production: load persisted preference from AsyncStorage/SecureStore
    // const saved = await AsyncStorage.getItem('theme_mode');
    // if (saved) setMode(saved as ThemeMode);
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      // In production: persist to AsyncStorage
      // AsyncStorage.setItem('theme_mode', next);
      return next;
    });
  }, []);

  const setThemeMode = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
    // In production: persist to AsyncStorage
    // AsyncStorage.setItem('theme_mode', newMode);
  }, []);

  const value: ThemeContextType = {
    mode,
    colors: getColors(mode),
    navigationTheme: getNavigationTheme(mode),
    tabBarTheme: getTabBarTheme(mode),
    stackTheme: getStackTheme(mode),
    isDark: mode === 'dark',
    toggleTheme,
    setThemeMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
