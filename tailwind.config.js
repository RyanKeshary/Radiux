/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ide: {
          bg: "#1e1e1e",
          sidebar: "#252526",
          activity: "#333333",
          editor: "#1e1e1e",
          tabActive: "#1e1e1e",
          tabInactive: "#2d2d2d",
          border: "#3c3c3c",
          hover: "#2a2d2e",
          selection: "#094771",
          accent: "#007acc",
          accentHover: "#0098ff",
          text: "#cccccc",
          textMuted: "#858585",
        }
      }
    },
  },
  plugins: [],
};
