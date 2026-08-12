// 主题系统: 亮色 / 暗黑模式切换 + 自定义主题色,偏好持久化到 localStorage
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { DataStore } from './datastore.js'

const THEME_KEY = 'blog_theme_preference'
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
}

/**
 * 十六进制颜色 → RGBA
 */
function hexToRgb(hex) {
  let h = (hex || '').trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return { r, g, b }
}

function rgba(hex, alpha) {
  const rgb = hexToRgb(hex)
  if (!rgb) return `rgba(59, 130, 246, ${alpha})`
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

/**
 * 颜色加深/变浅 (percent: -100 到 100, 负数变深 正数变浅)
 */
function shadeColor(hex, percent) {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const p = percent / 100
  const mix = (v) => {
    const mixWith = percent < 0 ? 0 : 255
    return Math.round(v + (mixWith - v) * p)
  }
  const r = Math.max(0, Math.min(255, mix(rgb.r)))
  const g = Math.max(0, Math.min(255, mix(rgb.g)))
  const b = Math.max(0, Math.min(255, mix(rgb.b)))
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * 应用自定义主题色到 CSS 变量
 * 作用: --primary / --primary-soft / --primary-hover / --accent
 */
function applyThemeColorsToDocument(themeColors) {
  const root = document.documentElement
  if (!root || !themeColors) return
  const primary = themeColors.primary || '#3B82F6'
  const accent = themeColors.accent || '#6366F1'

  root.style.setProperty('--primary', primary)
  root.style.setProperty('--accent', accent)
  root.style.setProperty('--primary-soft', rgba(primary, 0.1))
  root.style.setProperty('--accent-soft', rgba(accent, 0.1))
  // Hero / 按钮渐变
  root.style.setProperty('--hero-gradient-start', primary)
  root.style.setProperty('--hero-gradient-end', shadeColor(primary, -30))
  // 按钮 hover / active
  root.style.setProperty('--primary-hover', shadeColor(primary, -12))
  root.style.setProperty('--primary-active', shadeColor(primary, -20))

  // 成功/警告/危险色的衍生基于主色的亮度对比(可选,保持默认)
  // ok/warn/danger 保持默认,但根据主色调整 ok
  root.style.setProperty('--ok', shadeColor(primary, 30) || '#10B981')
}

function getStoredThemeColors() {
  try {
    const settings = DataStore.Settings.get()
    return settings.themeColors || null
  } catch {
    return null
  }
}

function applyThemeToDocument(theme) {
  const root = document.documentElement
  if (theme === THEMES.DARK) {
    root.classList.add('theme-dark')
    root.classList.remove('theme-light')
    root.setAttribute('data-theme', 'dark')
    try {
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0f172a')
    } catch { /* noop */ }
  } else {
    root.classList.add('theme-light')
    root.classList.remove('theme-dark')
    root.setAttribute('data-theme', 'light')
    try {
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#ffffff')
    } catch { /* noop */ }
  }
}

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === THEMES.LIGHT || saved === THEMES.DARK) return saved
  } catch { /* noop */ }
  if (typeof window !== 'undefined' && window.matchMedia) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? THEMES.DARK : THEMES.LIGHT
  }
  return THEMES.LIGHT
}

const ThemeContext = createContext({
  theme: THEMES.LIGHT,
  toggleTheme: () => {},
  setTheme: () => {},
  applyThemeColors: () => {}
})

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)
  const isManualRef = useRef(false)
  const colorsAppliedRef = useRef(false)

  // 初次挂载: 应用自定义主题色
  useEffect(() => {
    const colors = getStoredThemeColors()
    if (colors) applyThemeColorsToDocument(colors)
    colorsAppliedRef.current = true

    // 监听 storage 事件: 其他标签页修改设置时同步主题色
    const onStorage = (e) => {
      if (e.key === 'blog_settings') {
        const colors = getStoredThemeColors()
        if (colors) applyThemeColorsToDocument(colors)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // 亮/暗模式切换
  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])

  // 监听系统主题变化
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => {
      if (isManualRef.current) return
      try {
        if (localStorage.getItem(THEME_KEY)) return
      } catch { /* noop */ }
      setThemeState(e.matches ? THEMES.DARK : THEMES.LIGHT)
    }
    mql.addEventListener?.('change', onChange)
    return () => mql.removeEventListener?.('change', onChange)
  }, [])

  const applyThemeColors = useCallback((themeColors) => {
    applyThemeColorsToDocument(themeColors)
  }, [])

  const setTheme = useCallback((next) => {
    if (next === THEMES.LIGHT || next === THEMES.DARK) {
      isManualRef.current = true
      setThemeState(next)
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch { /* noop */ }
    }
  }, [])

  const toggleTheme = useCallback(() => {
    isManualRef.current = true
    setThemeState((prev) => {
      const next = prev === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch { /* noop */ }
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, applyThemeColors }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
