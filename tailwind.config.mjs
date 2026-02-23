/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Clash Display"', '"Syne"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        // Palette "Warm Oak" — premium, chaleureux, naturel
        oak: {
          50:  '#FAF7F2',
          100: '#F4EDE0',
          200: '#E8D9BF',
          300: '#D4B896',
          400: '#BE9168',
          500: '#A66D45',
          600: '#8A5434',
          700: '#6B3E26',
          800: '#4E2D1B',
          900: '#341C10',
        },
        ink: {
          DEFAULT: '#1A1208',
          soft: '#2D2015',
          muted: '#6B5A48',
        },
        cream: {
          DEFAULT: '#FAF7F2',
          dark: '#F0EAE0',
        },
        // Accent électrique pour les CTAs
        electric: {
          DEFAULT: '#E8621A',
          light: '#FF7D35',
          dark: '#C44E10',
        },
      },
      backgroundImage: {
        'grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease-out both',
        'fade-in': 'fadeIn 0.4s ease-out both',
        'slide-x': 'slideX 0.5s ease-out both',
      },
      keyframes: {
        fadeUp: { from: { opacity: '0', transform: 'translateY(24px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideX: { from: { opacity: '0', transform: 'translateX(-16px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
};
