import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

/**
 * GitHub Pages / CDN 缓存兼容补丁
 * -------------------------------------------------------------
 * 纯前端 SPA 首次加载后，浏览器会缓存 index.html。
 * 新部署发布时，旧 HTML 仍引用已被 rollup 生成的新 hash 覆盖掉的旧 JS 文件名，
 * 导致脚本 404 或用户一直卡在旧版本。
 *
 * 此补丁在启动时主动拉取当前 URL 的最新 index.html，并比较其中 main script 的 hash：
 * - 若 hash 对不上（或当前页面引用的脚本已 404） → 强制刷新（绕过缓存）
 * - 若一致 → 正常启动
 * 整个检查会在最多 3s 内超时放行，不影响正常首屏体验。
 */
;(async function ensureLatestBuild() {
  try {
    // 1. 从当前 DOM 中拿到已加载的 main script hash（如果有）
    const currentScripts = Array.from(document.querySelectorAll('script[src]'))
      .map((s) => s.getAttribute('src') || '')
      .filter((s) => /\/index-[A-Za-z0-9_-]+\.js(\?|$)/.test(s))
    const currentHashMatch = currentScripts[0]?.match(/\/index-([A-Za-z0-9_-]+)\.js/)
    const currentHash = currentHashMatch ? currentHashMatch[1] : null

    if (!currentHash) return // 开发态 / 非 hash 化构建，跳过

    // 2. fetch 最新 index.html（绕过缓存），解析其 main script hash
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const resp = await fetch(`${import.meta.env.BASE_URL || '/'}?t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal
    }).catch(() => null)
    clearTimeout(timeout)

    if (!resp || !resp.ok) return
    const html = await resp.text()
    const freshHashMatch = html.match(/\/index-([A-Za-z0-9_-]+)\.js/)
    const freshHash = freshHashMatch ? freshHashMatch[1] : null

    // 3. hash 不一致 → 强制硬刷，绕过 HTTP 缓存
    if (freshHash && freshHash !== currentHash) {
      try {
        localStorage.setItem('__blog_build_refreshed_at', String(Date.now()))
      } catch {}
      // eslint-disable-next-line no-undef
      location.reload(true)
      return // reload 之后不会执行到这里
    }
  } catch {
    // 兼容隐私模式 / 离线：任何异常都吞掉，不阻塞启动
  }
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
