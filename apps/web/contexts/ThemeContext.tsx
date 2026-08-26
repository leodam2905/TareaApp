"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "night" | "day";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "day",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("day");

  useEffect(() => {
    const saved = localStorage.getItem("tarea-theme-v2") as Theme | null;
    if (saved === "day" || saved === "night") {
      setTheme(saved);
    } else {
      // No stored preference: match the landing page rather than the old
      // default. Anyone who has already chosen night keeps it.
      setTheme("day");
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "night") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("tarea-theme-v2", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggle: () => setTheme(t => t === "night" ? "day" : "night") }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
