"use client";

import * as React from "react";
import { track } from "@/lib/analytics";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "light",
  resolvedTheme: "light",
  setTheme: () => {},
});

const STORAGE_KEY = "theme";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") return getSystemTheme();
  return theme;
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.style.colorScheme = theme;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  enableSystem = true,
  disableTransitionOnChange = false,
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>("light");

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      const initial: Theme = stored || defaultTheme;
      setThemeState(initial);
      const resolved = resolveTheme(initial);
      setResolvedTheme(resolved);
      applyTheme(resolved);
    } catch {
      applyTheme(resolveTheme(defaultTheme));
    }
  }, [defaultTheme]);

  React.useEffect(() => {
    if (!enableSystem || theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme, enableSystem]);

  const setTheme = React.useCallback(
    (next: Theme) => {
      setThemeState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      if (disableTransitionOnChange) {
        const style = document.createElement("style");
        style.textContent =
          "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}";
        document.head.appendChild(style);
        setTimeout(() => document.head.removeChild(style), 1);
      }
      const resolved = resolveTheme(next);
      setResolvedTheme(resolved);
      applyTheme(resolved);
      track("theme_toggled", { theme: next });
    },
    [disableTransitionOnChange],
  );

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return React.useContext(ThemeContext);
}