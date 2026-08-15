import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 自定义域名部署在根路径,base 固定为 '/'
// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  }
})
