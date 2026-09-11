"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "night" | "day";

// Bump this to retire every stored preference and put all browsers back on the
// default. See the note in ThemeProvider before changing it.
const STORAGE_KEY = "tarea-theme-v3";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "day",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("day");

  useEffect(() => {
    // v3 resets everyone to day. v2 only changed the default for NEW visitors
    // and deliberately let an existing night choice stand, so any browser that
    // had ever picked night kept landing on a navy dashboard while the public
    // pages -- pinned .day-only -- stayed light. That split reads as "the
    // bookings page is broken", not as "I am in night mode". Day is the
    // product's look; night is opt-in, per browser, from the sidebar toggle.
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === "day" || saved === "night") setTheme(saved);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "night") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggle: () => setTheme(t => t === "night" ? "day" : "night") }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
