import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 仓库名,用于设置 base 路径
// 本地开发时为 '/', 部署到 GitHub Pages 时为 '/pure-frontend-blog/'
const isGHPages = process.env.GITHUB_ACTIONS === 'true' || process.env.CI === 'true'

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages 部署在子路径下,需要设置正确的 base
  base: '/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  }
})
