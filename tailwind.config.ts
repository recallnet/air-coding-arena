import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Geist Design System colors
        background: {
          DEFAULT: 'var(--ds-background-100)',
          secondary: 'var(--ds-background-200)',
        },
        foreground: {
          DEFAULT: 'var(--ds-gray-1000)',
          secondary: 'var(--ds-gray-900)',
        },
        border: {
          DEFAULT: 'var(--ds-gray-400)',
          hover: 'var(--ds-gray-500)',
          active: 'var(--ds-gray-600)',
        },
        gray: {
          100: 'var(--ds-gray-100)',
          200: 'var(--ds-gray-200)',
          300: 'var(--ds-gray-300)',
          400: 'var(--ds-gray-400)',
          500: 'var(--ds-gray-500)',
          600: 'var(--ds-gray-600)',
          700: 'var(--ds-gray-700)',
          800: 'var(--ds-gray-800)',
          900: 'var(--ds-gray-900)',
          1000: 'var(--ds-gray-1000)',
        },
        blue: {
          100: 'var(--ds-blue-100)',
          200: 'var(--ds-blue-200)',
          300: 'var(--ds-blue-300)',
          700: 'var(--ds-blue-700)',
          800: 'var(--ds-blue-800)',
          900: 'var(--ds-blue-900)',
          1000: 'var(--ds-blue-1000)',
        },
        red: {
          100: 'var(--ds-red-100)',
          200: 'var(--ds-red-200)',
          300: 'var(--ds-red-300)',
          700: 'var(--ds-red-700)',
          800: 'var(--ds-red-800)',
          900: 'var(--ds-red-900)',
          1000: 'var(--ds-red-1000)',
        },
        green: {
          100: 'var(--ds-green-100)',
          200: 'var(--ds-green-200)',
          300: 'var(--ds-green-300)',
          700: 'var(--ds-green-700)',
          800: 'var(--ds-green-800)',
          900: 'var(--ds-green-900)',
          1000: 'var(--ds-green-1000)',
        },
        amber: {
          100: 'var(--ds-amber-100)',
          200: 'var(--ds-amber-200)',
          300: 'var(--ds-amber-300)',
          700: 'var(--ds-amber-700)',
          800: 'var(--ds-amber-800)',
          900: 'var(--ds-amber-900)',
          1000: 'var(--ds-amber-1000)',
        },
      },
      borderRadius: {
        geist: '6px',
        'geist-sm': '4px',
      },
    },
  },
  plugins: [],
}

export default config
