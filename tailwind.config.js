/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  // 必须关闭预设的样式重置，防止 Ant Design 的按钮变丑
  corePlugins: {
    preflight: false,
  },
  plugins: [],
};
