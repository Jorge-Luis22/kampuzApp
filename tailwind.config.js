/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#241E5C',      // Índigo profundo de mayor contraste
          primaryHover: '#1B1647',
          soft: '#EEECF8',
          border: '#D8D5F0',
          dark: '#1A1642'
        },
        accent: {
          DEFAULT: '#009E8C',      // Turquesa inteligente de alta vibrancia
          hover: '#008777',
          soft: '#E2F7F4',
          border: '#B2EBE3',
          dark: '#054B43'
        },
        ink: {
          DEFAULT: '#0F172A',      // Negro azulado de alto contraste (slate-900)
          soft: '#334155',         // Cuerpo legible (slate-700)
          muted: '#64748B',        // Subtítulos y metadatos (slate-500)
          light: '#F8FAFC'
        },
        line: {
          DEFAULT: '#D6DCE7',      // Borde definido y visible
          light: '#E2E8F0',
          dark: '#263143'
        },
        surface: {
          DEFAULT: '#EFF3F8',      // Fondo gris azulado con contraste nítido contra tarjetas blancas
          dark: '#0A0E17',
          card: '#FFFFFF',         // Tarjetas blancas puras
          cardDark: '#131A26'
        },
        semantic: {
          success: '#16A34A',
          warning: '#D97706',
          danger: '#DC2626'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'sm': '8px',
        'md': '14px',
        'lg': '20px',
        'xl': '24px',
        'pill': '999px',
      },
      zIndex: {
        '60': '60',
      },
      boxShadow: {
        'clean': '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
        'elevated': '0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04)',
        'modal': '0 12px 36px -4px rgba(15, 23, 42, 0.16)',
      }
    },
  },
  plugins: [],
}
