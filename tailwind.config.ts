import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f3f7f8",
          100: "#dce8eb",
          200: "#b8d0d6",
          700: "#2a4a52",
          800: "#1c353c",
          900: "#12262c",
          950: "#0b171b",
        },
        mint: {
          400: "#3ecf9a",
          500: "#1fb87e",
          600: "#149665",
        },
        coral: {
          500: "#e85d4c",
          600: "#d44535",
        },
      },
      fontFamily: {
        display: ["var(--font-sora)", "sans-serif"],
        body: ["var(--font-manrope)", "sans-serif"],
      },
      boxShadow: {
        soft: "0 18px 50px -20px rgba(18, 38, 44, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
