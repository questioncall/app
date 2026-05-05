/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Primary brand colors from web globals.css
        primary: {
          DEFAULT: "#3B82F6",
          foreground: "#FFFFFF",
        },
        background: {
          DEFAULT: "#FFFFFF",
          dark: "#0A0A0A",
        },
        foreground: {
          DEFAULT: "#0A0A0A",
          dark: "#FAFAFA",
        },
        card: {
          DEFAULT: "#FFFFFF",
          dark: "#111111",
        },
        border: {
          DEFAULT: "#E5E7EB",
          dark: "#1F2937",
        },
        muted: {
          DEFAULT: "#F3F4F6",
          foreground: "#6B7280",
          dark: "#1F2937",
        },
        accent: {
          DEFAULT: "#3B82F6",
          foreground: "#FFFFFF",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
