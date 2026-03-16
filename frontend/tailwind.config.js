/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#f3f3f3",
        surface: "#e6e6e6",
        surfaceHover: "#dddddd",
        border: "transparent",
        textPrimary: "#111111",
        textSecondary: "#8b8b8b",
        accent: "#000000",
        success: "#10b981",
        warning: "#f59e0b",
        error: "#ef4444",
      },
      fontFamily: {
        tiktok: ['"TikTok Sans"', "sans-serif"],
        geist: ["Geist", "sans-serif"],
        mono: ["Geist Mono", "monospace"],
      },
    },
  },
  plugins: [],
};