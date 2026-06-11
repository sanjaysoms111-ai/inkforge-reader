"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void; // cycles system -> light -> dark -> system
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = "inkforge:theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeClass(effective: "light" | "dark") {
  const root = document.documentElement;
  if (effective === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");

  // Initialize from storage or system (client only)
  useEffect(() => {
    const saved = (localStorage.getItem(THEME_KEY) as Theme | null) || "system";
    setThemeState(saved);

    const system = getSystemTheme();
    const effective = saved === "system" ? system : saved;
    setResolvedTheme(effective);
    applyThemeClass(effective);

    // Listen for system changes when in "system" mode
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      if (saved === "system" || theme === "system") {
        const newEffective = media.matches ? "dark" : "light";
        setResolvedTheme(newEffective);
        applyThemeClass(newEffective);
      }
    };
    media.addEventListener("change", handleSystemChange);
    return () => media.removeEventListener("change", handleSystemChange);
  }, []); // run once

  // Keep in sync if theme state changes later (e.g. from toggle)
  useEffect(() => {
    const system = getSystemTheme();
    const effective = theme === "system" ? system : theme;
    setResolvedTheme(effective);
    applyThemeClass(effective);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      let next: Theme;
      if (current === "system") next = "light";
      else if (current === "light") next = "dark";
      else next = "system";

      localStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  const value: ThemeContextType = {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return ctx;
}
