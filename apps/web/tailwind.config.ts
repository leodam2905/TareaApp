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
        // The landing page's palette, so the marketing site and the three
        // dashboards are recognisably one product. Names are kept — `sky` is
        // the primary accent, whatever colour that accent happens to be — so
        // this is a token change, not a rename across 394 usages.
        tarea: {
          sky: "#EF795F",           // coral — the action colour on the landing page
          "sky-light": "#F8B9A9",
          "sky-dark": "#DC654C",
          dark: "#143F3A",          // deep green: headers, dark buttons
          "dark-deeper": "#0B2A26",
          white: "#FFFFFF",
          ink: "#143F3A",
          "ink-muted": "#54706C",
          "ink-subtle": "#7B938F",  // derived: the landing has no third tone
          surface: "#DFF2E9",       // mint
          border: "#DBE7E2",        // line
          teal: "#0D746B",          // the landing's brand green, for accents
          "teal-dark": "#075D56",
          cream: "#FBF6EC",
          paper: "#FFFDF8",
        },
      },
      fontFamily: {
        sans: ["Open Sans", "Inter", "system-ui", "sans-serif"],
        serif: ["Instrument Serif", "Georgia", "Times New Roman", "serif"],
      },
      backgroundImage: {
        "hero-gradient": "linear-gradient(135deg, #075D56 0%, #0D746B 55%, #EF795F 100%)",
        "card-gradient": "linear-gradient(180deg, #DFF2E9 0%, #FFFDF8 100%)",
      },
      boxShadow: {
        card: "0 4px 24px rgba(17, 66, 60, 0.10)",
        "card-hover": "0 8px 32px rgba(17, 66, 60, 0.16)",
        nav: "0 2px 16px rgba(17, 66, 60, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
