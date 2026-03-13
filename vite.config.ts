import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/xf-api': {
        target: 'https://spark-api-open.xf-yun.com',
        changeOrigin: true,
        rewrite: (path) => path.replace('/xf-api', '')
      },
      '/hunyuan-api': {
        target: 'https://api.hunyuan.cloud.tencent.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hunyuan-api/, '')
      },
      '/uploads': {
        target: 'http://localhost:8000', // 你的 Python 后端地址
        changeOrigin: true
      }
    }
  }
})
