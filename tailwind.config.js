/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'terminal': {
          DEFAULT: '#1e1e1e',
          50: '#2d2d2d',
          100: '#252525',
          200: '#333333',
          300: '#3a3a3a',
          400: '#4a4a4a',
          500: '#4d4d4d',
          600: '#999999',
          700: '#bbbbbb',
          input: '#2a2a2a',
        },
        'accent': {
          blue: '#007acc',
          red: '#ff6b6b',
          green: '#6aa84f',
        }
      },
      keyframes: {
        slideIn: {
          'from': { 
            opacity: '0',
            transform: 'translateY(-10px)'
          },
          'to': { 
            opacity: '1',
            transform: 'translateY(0)'
          },
        },
        fadeIn: {
          'from': {
            opacity: '0',
            transform: 'translateY(-4px)'
          },
          'to': {
            opacity: '1',
            transform: 'translateY(0)'
          }
        }
      },
      animation: {
        'slide-in': 'slideIn 0.2s ease-out',
        'fade-in': 'fadeIn 0.2s ease-in-out',
      },
      fontFamily: {
        'terminal': ['Menlo', 'Monaco', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [
    require('tailwind-scrollbar')({ nocompatible: true }),
  ],
}

