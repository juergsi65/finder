/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Muted forest green - the app's primary color. Paired with
        // Tailwind's built-in `slate` scale (used throughout for neutrals
        // instead of plain `gray`) for a cooler, more premium outdoor feel
        // than the previous bright/saturated green.
        trail: {
          50: "#f2f7f4",
          100: "#e1ede4",
          200: "#c3dbc9",
          300: "#9cc2a7",
          400: "#71a380",
          500: "#4f8562",
          600: "#3a6a4d",
          700: "#2f5540",
          800: "#274536",
          900: "#20392d",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 4px 16px -4px rgb(15 23 42 / 0.08)",
        float: "0 8px 24px -6px rgb(15 23 42 / 0.18)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
