/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        focus: {
          work: "#dc2626",
          short: "#16a34a",
          long: "#2563eb",
          micro: "#a855f7",
        },
      },
    },
  },
  plugins: [],
};
