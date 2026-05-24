import { useCallback, type RefObject } from "react";

type ThemeName = "dark" | "light" | "system";
type ConcreteThemeName = Exclude<ThemeName, "system">;

interface UseSidebarThemeTransitionParams {
  setTheme: (theme: ThemeName) => void;
  theme: ThemeName;
  themeButtonRef: RefObject<HTMLButtonElement | null>;
}

export function useSidebarThemeTransition({
  setTheme,
  theme,
  themeButtonRef,
}: UseSidebarThemeTransitionParams) {
  return useCallback(() => {
    const nextTheme: ConcreteThemeName = theme === "dark" ? "light" : "dark";

    if (!document.startViewTransition || themeButtonRef.current === null) {
      setTheme(nextTheme);
      return;
    }

    const rect = themeButtonRef.current.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    const endRadius = Math.ceil(
      Math.hypot(Math.max(x, w - x), Math.max(y, h - y)),
    );

    document.documentElement.style.setProperty("--theme-transition-x", `${x}px`);
    document.documentElement.style.setProperty("--theme-transition-y", `${y}px`);
    document.documentElement.style.setProperty("--theme-transition-radius", `${endRadius}px`);

    const transition = document.startViewTransition(() => {
      const root = document.documentElement;
      if (nextTheme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    });

    transition.finished.then(() => {
      try {
        localStorage.setItem("theme", nextTheme);
      } catch {
        // localStorage may be unavailable in restricted browser contexts.
      }
      setTheme(nextTheme);
    });
  }, [setTheme, theme, themeButtonRef]);
}
