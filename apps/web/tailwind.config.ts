import type { Config } from 'tailwindcss';

// Mobile-first por padrão (Tailwind já é). Cores da marca Dispara via tokens
// CSS (BRAND.md §6) — canais RGB p/ opacidade por utilitário. White-label futuro.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          strong: 'rgb(var(--brand-strong) / <alpha-value>)',
          fg: 'rgb(var(--brand-fg) / <alpha-value>)',
        },
        accent: 'rgb(var(--accent) / <alpha-value>)',
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        content: 'rgb(var(--text) / <alpha-value>)',
        'content-2': 'rgb(var(--text-secondary) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--border) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Baloo 2', 'Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        // Zonas seguras (notch/gestos) para PWA mobile.
        'safe-b': 'env(safe-area-inset-bottom)',
        'safe-t': 'env(safe-area-inset-top)',
      },
      minHeight: {
        touch: '44px', // alvo mínimo de toque (regra mobile do plano)
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
} satisfies Config;
