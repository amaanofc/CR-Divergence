/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bloomberg: {
          bg: '#0a0e1a',
          accent: '#ff6b00',
          text: '#e0e0e0',
          muted: '#8a8a8a',
          border: '#1e2a3a',
          surface: '#0f1623',
        },
        positive: '#22c55e',
        negative: '#ef4444',
        explore: '#a855f7',
        hold: '#3b82f6',
        warn: '#eab308',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Courier New', 'Courier', 'monospace'],
      }
    },
  },
  plugins: [],
}
