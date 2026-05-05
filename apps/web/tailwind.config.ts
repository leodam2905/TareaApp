import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        tarea: {
          sky: "#38BDF8",
          "sky-light": "#BAE6FD",
          "sky-dark": "#0284C7",
          dark: "#1E3A8A",
          "dark-deeper": "#0F2560",
          white: "#FFFFFF",
          ink: "#0F172A",
          "ink-muted": "#334155",
          "ink-subtle": "#64748B",
          surface: "#F0F9FF",
          border: "#E0F2FE",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "hero-gradient": "linear-gradient(135deg, #1E3A8A 0%, #0284C7 50%, #38BDF8 100%)",
        "card-gradient": "linear-gradient(180deg, #F0F9FF 0%, #FFFFFF 100%)",
      },
      boxShadow: {
        card: "0 4px 24px rgba(14, 165, 233, 0.12)",
        "card-hover": "0 8px 32px rgba(14, 165, 233, 0.22)",
        nav: "0 2px 16px rgba(30, 58, 138, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
