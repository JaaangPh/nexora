/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#142B5B',     // Deep navy blue
          secondary: '#2459C4',   // Royal blue
          accent: '#18B7D5',      // Cyan accent
          bg: '#F4F7FB',          // Page background soft gray
          card: '#FFFFFF',        // White form card
          text: '#17233B',        // Main text dark navy
          muted: '#64748B',       // Secondary slate
          border: '#DCE4EF',      // Input borders
          success: '#15966A',     // Success green
          error: '#DC3545',       // Error red
          inputBg: '#F8FAFC',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 10px 30px -5px rgba(20, 43, 91, 0.08), 0 4px 6px -2px rgba(20, 43, 91, 0.03)',
        'card-lg': '0 20px 40px -10px rgba(20, 43, 91, 0.12), 0 8px 16px -4px rgba(20, 43, 91, 0.04)',
        'btn': '0 4px 14px 0 rgba(20, 43, 91, 0.25)',
        'btn-hover': '0 6px 20px 0 rgba(36, 89, 196, 0.35)',
      }
    },
  },
  plugins: [],
}
