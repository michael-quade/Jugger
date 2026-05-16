/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'masters-green': '#006747',
        'masters-dark': '#004D35',
        'masters-gold': '#C9A84C',
        'masters-cream': '#F8F4EE',
        'masters-light': '#E8F0EC',
        'masters-tan': '#D4C5A0',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
