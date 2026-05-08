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
          sky: "#FB923C",
          "sky-light": "#FED7AA",
          "sky-dark": "#EA580C",
          dark: "#C2410C",
          "dark-deeper": "#9A3412",
          white: "#FFFFFF",
          ink: "#0F172A",
          "ink-muted": "#334155",
          "ink-subtle": "#64748B",
          surface: "#FFF7ED",
          border: "#FFEDD5",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "hero-gradient": "linear-gradient(135deg, #9A3412 0%, #EA580C 50%, #FB923C 100%)",
        "card-gradient": "linear-gradient(180deg, #FFF7ED 0%, #FFFFFF 100%)",
      },
      boxShadow: {
        card: "0 4px 24px rgba(251, 146, 60, 0.12)",
        "card-hover": "0 8px 32px rgba(251, 146, 60, 0.22)",
        nav: "0 2px 16px rgba(194, 65, 12, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
