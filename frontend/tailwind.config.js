/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#12233F",
          action: "#2764C5",
          teal: "#14A6A6",
          bg: "#F4F7FB",
          surface: "#FFFFFF",
          success: "#217A57",
          warning: "#A76712",
          danger: "#A33A3A",
          muted: "#475569",
          border: "#CBD5E1",
        },
        access: {
          canvas: "#F4F7FB",
          surface: "#FFFFFF",
          surfaceLight: "#F1F5F9",
          primary: "#12233F",
          muted: "#475569",
          blue: "#2764C5",
          blueHover: "#1E51A4",
          teal: "#14A6A6",
          gold: "#A76712",
          emerald: "#217A57",
          rose: "#A33A3A",
          ring: "#2764C5",
        }
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      }
    },
  },
  plugins: [],
}
