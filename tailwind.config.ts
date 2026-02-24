import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#131313",

        gold: "#e4c877",
        goldHover: "#d9ba63",

        card: "#1b1b1b",
        cardBorder: "rgba(255,255,255,0.06)",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,.35)",
        goldGlow: "0 0 0 1px rgba(228,200,119,.25)",
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.75rem",
      },
    },
  },
  plugins: [],
} satisfies Config;