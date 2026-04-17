/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          orange: '#FD4B1B',
          'orange-light': '#FF6B42',
          'orange-dark': '#D93E15',
          blue: '#0278FC',
          'blue-light': '#3395FF',
          'blue-dark': '#0260CC',
        },
        app: {
          bg: '#ECEDFF',
          surface: '#F4F5FF',
          'surface-dark': '#E2E3F5',
        },
        ink: {
          900: '#202C31',
          700: '#606B6F',
          500: '#8E9599',
          300: '#C4C9CB',
          100: '#EFF1F2',
        },
        sidebar: {
          bg: '#0D0D0D',
          hover: '#1C1C1C',
          border: 'rgba(255,255,255,0.06)',
          text: '#8A9098',
          'text-active': '#FFFFFF',
        },
        primary: {
          50: '#FFF1EE',
          100: '#FFE0D9',
          200: '#FFC2B5',
          300: '#FF9B87',
          400: '#FF6B42',
          500: '#FD4B1B',
          600: '#D93E15',
          700: '#B33210',
          800: '#8C2710',
        },
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          500: '#FFB83F',
          600: '#E09500',
          700: '#b45309',
          800: '#92400e',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          500: '#E34F4F',
          600: '#C73535',
          700: '#b91c1c',
          800: '#991b1b',
        },
        teal: {
          400: '#1ADCC5',
          500: '#0DB5A0',
          600: '#0A9688',
        },
      },
      spacing: {
        'sidebar-expanded': '228px',
        'sidebar-collapsed': '64px',
      },
      transitionProperty: {
        sidebar: 'width, transform',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
        'slide-in-left': 'slide-in-left 0.2s ease-out',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 6px 20px rgba(0,0,0,0.09), 0 2px 6px rgba(0,0,0,0.05)',
        'card-lg': '0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        'panel': '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05)',
        'sidebar': '2px 0 24px rgba(0,0,0,0.12)',
        'header': '0 1px 0 #E2E3F5, 0 2px 8px rgba(0,0,0,0.04)',
        'dropdown': '0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
        'modal': '0 24px 64px rgba(0,0,0,0.16), 0 8px 24px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};
