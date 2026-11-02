/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        ground: token("ground"),
        surface: token("surface"),
        raised: token("raised"),
        line: token("line"),
        control: token("control"),
        ink: token("ink"),
        muted: token("muted"),
        faint: token("faint"),
        hue: token("hue"),
        rest: token("rest"),
        invert: token("invert"),
        "on-invert": token("on-invert"),
        nav: token("nav"),
        negative: token("negative"),
        warning: token("warning"),
      },
    },
  },
  plugins: [],
};
