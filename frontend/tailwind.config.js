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
          bg:      '#0a0e1a',
          panel:   '#080c18',
          surface: '#0f1623',
          accent:  '#ff6b00',
          text:    '#e0e0e0',
          muted:   '#8a8a8a',
          border:  '#1e2a3a',
          dim:     '#141b2d',
        },
        positive: '#22c55e',
        negative: '#ef4444',
        explore:  '#a855f7',
        hold:     '#3b82f6',
        warn:     '#eab308',
        rare:     '#3b82f6',
        epic:     '#a855f7',
        legendary:'#eab308',
      },
      fontFamily: {
        sans:    ['DM Sans', 'system-ui', 'sans-serif'],
        mono:    ['IBM Plex Mono', 'Courier New', 'monospace'],
        display: ['Barlow Condensed', 'Impact', 'sans-serif'],
        data:    ['IBM Plex Mono', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'glow-orange': '0 0 10px rgba(255,107,0,0.5), 0 0 20px rgba(255,107,0,0.2)',
        'glow-green':  '0 0 8px rgba(34,197,94,0.4)',
        'glow-purple': '0 0 8px rgba(168,85,247,0.4)',
      },
      keyframes: {
        blink: {
          '0%,100%': { opacity: 1 },
          '50%':     { opacity: 0.15 },
        },
      },
      animation: {
        blink: 'blink 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
