/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Habilita el modo dark con la clase 'dark'
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideIn: { from: { transform: 'translateY(12px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
      },
      animation: {
        fadeIn: 'fadeIn 300ms ease-out',
        slideIn: 'slideIn 300ms ease-out',
      },
    },
  },
  plugins: [],
}
