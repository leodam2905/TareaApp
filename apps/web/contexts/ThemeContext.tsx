"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "night" | "day";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "night",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("night");

  useEffect(() => {
    const saved = localStorage.getItem("tarea-theme") as Theme | null;
    if (saved === "day" || saved === "night") setTheme(saved);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "night") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("tarea-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggle: () => setTheme(t => t === "night" ? "day" : "night") }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
