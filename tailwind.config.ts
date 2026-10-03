import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#1A0B2E',
        abyss: '#12071F',
        gold: {
          DEFAULT: '#D4AF37',
          light: '#F5D76E',
          dark: '#8C6A1F',
        },
        solana: '#9945FF',
        mint: '#14F195',
        blood: '#FF4D5E',
        parchment: '#F5F0E6',
        lavender: '#A89BC0',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
