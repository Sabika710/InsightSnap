/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Employee terminal palette
        emp: {
          bg: '#040d18',
          card: '#1a2535',
          accent: '#00e5ff',
          text: '#ffffff',
          dim: '#4a6080',
        },
        // Manager mission control palette
        mgr: {
          bg: '#07100f',
          card: '#0a1a14',
          accent: '#00ff9d',
          danger: '#ff4560',
          warning: '#ffd166',
          dim: '#1a3028',
          text: '#e0fff4',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        ibmmono: ['IBM Plex Mono', 'monospace'],
        ibmsans: ['IBM Plex Sans', 'sans-serif'],
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in 0.5s ease-out forwards',
        'slide-up': 'slide-up 0.4s ease-out forwards',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.05)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'glow': {
          from: { boxShadow: '0 0 5px #00ff9d40, 0 0 10px #00ff9d20' },
          to: { boxShadow: '0 0 20px #00ff9d80, 0 0 40px #00ff9d40' },
        },
      },
    },
  },
  plugins: [],
}