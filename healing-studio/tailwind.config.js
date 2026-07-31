/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cosmic: {
          950: '#0a0612',
          900: '#12081f',
          800: '#1a0a2e',
          700: '#2d1b4e',
          600: '#4a2c7a',
          500: '#6b4c9a',
          400: '#9b7ec8',
          300: '#c4b0e0',
          200: '#e8dff5',
          100: '#f5f0fa',
        },
        gold: {
          DEFAULT: '#d4af37',
          light: '#f0d78c',
          dark: '#a8892a',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'cosmic-gradient':
          'radial-gradient(ellipse at 20% 0%, rgba(107, 76, 154, 0.35) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(212, 175, 55, 0.12) 0%, transparent 50%), linear-gradient(180deg, #0a0612 0%, #1a0a2e 50%, #12081f 100%)',
        'card-glow':
          'linear-gradient(135deg, rgba(107, 76, 154, 0.15) 0%, rgba(212, 175, 55, 0.08) 100%)',
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
