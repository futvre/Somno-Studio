/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        somno: {
          bg: "#08090d",
          card: "#12141c",
          border: "#1f2430",
          accent: "#3b82f6",
          glow: "rgba(59, 130, 246, 0.15)"
        }
      }
    },
  },
  plugins: [],
};
