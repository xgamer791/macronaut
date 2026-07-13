import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { darkColors, lightColors, ThemeColors } from './tokens';

export type AppearanceMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  colors: ThemeColors;
  mode: AppearanceMode;
  resolved: 'light' | 'dark';
  setMode: (mode: AppearanceMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialMode = 'system',
  onModeChange,
}: {
  children: React.ReactNode;
  initialMode?: AppearanceMode;
  /** Persistence hook — settings repository saves the preference. */
  onModeChange?: (mode: AppearanceMode) => void;
}) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<AppearanceMode>(initialMode);

  const setMode = useCallback(
    (next: AppearanceMode) => {
      setModeState(next);
      onModeChange?.(next);
    },
    [onModeChange],
  );

  const resolved: 'light' | 'dark' =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: resolved === 'dark' ? darkColors : lightColors,
      mode,
      resolved,
      setMode,
    }),
    [mode, resolved, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
