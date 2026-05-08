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
          sky: "#FDBA74",
          "sky-light": "#FED7AA",
          "sky-dark": "#FB923C",
          dark: "#1E3A8A",
          "dark-deeper": "#0F2560",
          white: "#FFFFFF",
          ink: "#0F172A",
          "ink-muted": "#334155",
          "ink-subtle": "#64748B",
          surface: "#FED7AA",
          border: "#FFEDD5",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "hero-gradient": "linear-gradient(135deg, #7C2D12 0%, #C2410C 50%, #FB923C 100%)",
        "card-gradient": "linear-gradient(180deg, #FED7AA 0%, #FFFFFF 100%)",
      },
      boxShadow: {
        card: "0 4px 24px rgba(251, 146, 60, 0.15)",
        "card-hover": "0 8px 32px rgba(251, 146, 60, 0.25)",
        nav: "0 2px 16px rgba(67, 20, 7, 0.15)",
      },
    },
  },
  plugins: [],
};

export default config;
