import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0d10",
        surface: "#14181d",
        line: "#242b33",
        accent: "#c8f751",
      },
    },
  },
  plugins: [],
};

export default config;
