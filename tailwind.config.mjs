/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        azure: {
          50: '#eef8ff',
          100: '#d8effe',
          500: '#0078d4',
          600: '#0062b0',
          700: '#004c8c',
        },
        aws: {
          50: '#fff9ed',
          100: '#ffeed4',
          500: '#ff9900',
          600: '#ec7211',
          700: '#c55306',
        },
      },
    },
  },
  plugins: [],
};

