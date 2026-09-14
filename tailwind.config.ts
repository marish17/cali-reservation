import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Sotto i 380px (iPhone SE e simili) alcune etichette vanno accorciate.
      screens: { xs: "440px" },
      colors: {
        ink: "#0a0a0b",       // nero di fondo
        surface: "#141416",   // superfici sollevate
        line: "#2a2a2e",      // bordi
        accent: "#e01e2b",    // rosso per riempimenti e bordi
        accentSoft: "#ff5d68", // rosso schiarito, leggibile sul nero
      },
    },
  },
  plugins: [],
};

export default config;
