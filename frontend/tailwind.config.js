/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      colors: {
        // Dark surface palette — used via bg-surface-*, border-edge-*, etc.
        surface: {
          DEFAULT: '#182035',
          hover:   '#1e2840',
          deep:    '#0d1526',
          deeper:  '#090e1b',
        },
        edge: {
          DEFAULT: '#1e2d47',
          strong:  '#253046',
        },
      },
      boxShadow: {
        card:     '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        dropdown: '0 8px 24px rgba(0,0,0,0.4)',
        sidebar:  '2px 0 8px rgba(0,0,0,0.4)',
        glow:     '0 0 0 2px rgba(59,130,246,0.3)',
      },
      animation: {
        'fade-in':  'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'skeleton': 'skeleton 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:   { '0%': { opacity: '0', transform: 'translateY(6px)' },  '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideUp:  { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        skeleton: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
      },
    },
  },
  plugins: [],
}
