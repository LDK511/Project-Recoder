/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#22262B', soft: '#4A5058', mute: '#80868E' },
        well: '#F1F2EF',
        line: '#E2E4E0',
        felt: { DEFAULT: '#2E5B4F', dark: '#23463D', light: '#E6EEEA' },
        sale: '#D4372C',
      },
      fontFamily: {
        sans: [
          '"Pretendard Variable"',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          '"Apple SD Gothic Neo"',
          '"Noto Sans KR"',
          '"Malgun Gothic"',
          'sans-serif',
        ],
      },
      maxWidth: { shell: '1200px' },
    },
  },
  plugins: [],
};
