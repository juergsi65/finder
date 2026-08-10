/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        trail: {
          50: "#eefdf3",
          100: "#d6f9e2",
          500: "#16a34a",
          600: "#0f8f3f",
          700: "#0c7233",
        },
      },
    },
  },
  plugins: [],
};
