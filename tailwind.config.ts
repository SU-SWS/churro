/** @type {import('tailwindcss').Config} */
import decanter from 'decanter';
import type { Config } from 'tailwindcss';
import { FontFamily } from './tailwind/plugins/theme/fontFamily';


export default {
  presets: [
    decanter,
  ],
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        ...FontFamily(),
      },
    },
  },
  plugins: [],
} satisfies Config;

