/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter Tight', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      colors: {
        surface: {
          DEFAULT: '#0c1018',
          2:       '#10151f',
          hover:   '#141a27',
          deep:    '#07090f',
          sidebar: '#070910',
        },
      },
      boxShadow: {
        card:     '0 1px 4px rgba(0,0,0,0.4)',
        dropdown: '0 8px 32px rgba(0,0,0,0.5)',
        glow:     '0 0 0 3px rgba(59,130,246,0.2)',
      },
      animation: {
        'fade-in':  'fadeUp 0.22s ease-out both',
        'slide-up': 'fadeUp 0.22s ease-out both',
        shimmer:    'shimmer 1.6s ease-in-out infinite',
      },
      keyframes: {
        fadeUp:  { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
      },
    },
  },
  plugins: [],
}
