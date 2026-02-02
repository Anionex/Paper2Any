import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3111,
    open: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        // target: 'http://localhost:8000',
        target: 'https://paper2any-test-back.nas.cpolar.cn',
        changeOrigin: true,
      },
    },
  },
})