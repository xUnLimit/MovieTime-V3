'use client';

import * as React from 'react';

import { THEME_STORAGE_KEY } from './theme-init-script';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  enableSystem?: boolean;
};

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const STORAGE_KEY = THEME_STORAGE_KEY;
const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyTheme(theme: Theme): ResolvedTheme {
  const resolvedTheme = resolveTheme(theme);
  const root = document.documentElement;

  root.classList.toggle('dark', resolvedTheme === 'dark');
  root.style.colorScheme = resolvedTheme;

  return resolvedTheme;
}

// Tema guardado y preferencia del sistema como fuente externa: evita setState en efectos
// y, con el snapshot de servidor nulo, no provoca desajustes de hidratacion.
const themeListeners = new Set<() => void>();

function notifyThemeListeners() {
  themeListeners.forEach((listener) => listener());
}

function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  window.addEventListener('storage', listener);
  mediaQuery.addEventListener('change', listener);
  return () => {
    themeListeners.delete(listener);
    window.removeEventListener('storage', listener);
    mediaQuery.removeEventListener('change', listener);
  };
}

function readStoredTheme(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

const readServerNull = () => null;

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  enableSystem = true,
}: ThemeProviderProps) {
  const storedTheme = React.useSyncExternalStore(subscribeTheme, readStoredTheme, readServerNull);
  const systemTheme = React.useSyncExternalStore(subscribeTheme, getSystemTheme, readServerNull);

  const theme: Theme =
    storedTheme === 'light' || storedTheme === 'dark' || (enableSystem && storedTheme === 'system')
      ? storedTheme
      : defaultTheme;
  const resolvedTheme: ResolvedTheme =
    theme === 'system'
      ? systemTheme ?? (defaultTheme === 'light' ? 'light' : 'dark')
      : theme;

  React.useEffect(() => {
    applyTheme(theme);
  }, [theme, systemTheme]);

  const setTheme = React.useCallback((nextTheme: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
    notifyThemeListeners();
  }, []);

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'dark' as Theme,
      resolvedTheme: 'dark' as ResolvedTheme,
      setTheme: () => undefined,
    };
  }

  return context;
}
