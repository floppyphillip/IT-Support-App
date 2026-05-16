/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#E8F3FF',
          100: '#C6DFFF',
          200: '#8DC0FF',
          300: '#5BA0FF',
          400: '#2E81FF',
          500: '#0073EA',
          600: '#0059B3',
          700: '#00418A',
          800: '#002B5C',
          900: '#001633',
          950: '#000B1A',
        },
        zoho: {
          sidebar: '#FFFFFF',
          header:  '#FFFFFF',
          body:    '#F4F5F7',
          border:  '#E8E8E8',
          text:    '#2D2D2D',
          muted:   '#6B7280',
          active:  '#E8F3FF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        dropdown: '0 4px 16px rgba(0,0,0,0.12)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
