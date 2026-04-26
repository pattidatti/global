import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:         '#ede2c4',
        panel:      '#fbf6e9',
        panelEdge:  '#a08562',
        ink:        '#2a1f12',
        inkLo:      '#6b5a45',
        accent:     '#a85a2a',
        good:       '#3f6b3f',
        warn:       '#c47e1f',
        danger:     '#9a2a2a',
        npc:        '#8a8a6a',
        // Aliases so existing code using textHi/textLo still compiles
        textHi:     '#2a1f12',
        textLo:     '#6b5a45',
      },
      fontFamily: {
        serif: ['"EB Garamond"', 'Georgia', 'serif'],
        sans:  ['Lato', 'system-ui', 'sans-serif'],
        mono:  ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        paper: '10px',
      },
      boxShadow: {
        paper:   '0 1px 2px rgba(60,40,15,0.08), 0 4px 10px rgba(60,40,15,0.10)',
        paperLg: '0 2px 6px rgba(60,40,15,0.12), 0 12px 28px rgba(60,40,15,0.18)',
        seal:    '0 0 0 2px rgba(60,40,15,0.15), 0 2px 4px rgba(60,40,15,0.30)',
      },
      backgroundImage: {
        // Subtle paper grain — tiny SVG noise tiled
        'paper-grain':
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.16 0 0 0 0 0.12 0 0 0 0 0.07 0 0 0 0.06 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
      },
    },
  },
  plugins: [],
};

export default config;
