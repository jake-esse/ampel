/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#30302E',
          50: '#F7F7F7',
          100: '#E8E8E7',
          200: '#D1D1CF',
          300: '#B3B3B0',
          400: '#6B6B68',
          500: '#30302E',
          600: '#282826',
          700: '#20201E',
          800: '#181817',
          900: '#101010',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        serif: ['Crimson Pro', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
