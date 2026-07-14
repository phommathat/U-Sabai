/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#1b2a4a", 2: "#243a63" },
        brand: { amber: "#f0a92e", green: "#2e9e6b", red: "#d9534f", blue: "#4a7fd4" },
      },
      fontFamily: { lao: ["'Noto Sans Lao'", "'Phetsarath OT'", "sans-serif"] },
    },
  },
  plugins: [],
};
