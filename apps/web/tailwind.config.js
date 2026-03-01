/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["SF Pro Display", "system-ui", "sans-serif"],
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to:   { transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.92)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "slide-in-right": "slide-in-right 0.22s cubic-bezier(0.4,0,0.2,1)",
        "scale-in":       "scale-in 0.18s cubic-bezier(0.4,0,0.2,1)",
      },
    },
  },
  plugins: [],
};
