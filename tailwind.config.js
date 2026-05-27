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
          work:  "rgb(var(--c-accent) / <alpha-value>)",
          short: "rgb(var(--c-short)  / <alpha-value>)",
          long:  "rgb(var(--c-long)   / <alpha-value>)",
          micro: "rgb(var(--c-micro)  / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};
