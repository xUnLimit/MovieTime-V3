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

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  enableSystem = true,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>(
    defaultTheme === 'light' ? 'light' : 'dark'
  );

  React.useEffect(() => {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initialTheme =
      storedTheme === 'light' || storedTheme === 'dark' || (enableSystem && storedTheme === 'system')
        ? storedTheme
        : defaultTheme;

    setThemeState(initialTheme);
    setResolvedTheme(applyTheme(initialTheme));
  }, [defaultTheme, enableSystem]);

  React.useEffect(() => {
    if (!enableSystem || theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setResolvedTheme(applyTheme('system'));

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [enableSystem, theme]);

  const setTheme = React.useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    setResolvedTheme(applyTheme(nextTheme));
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
