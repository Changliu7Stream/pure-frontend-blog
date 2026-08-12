// 主题系统: 亮色 / 暗黑模式切换,偏好持久化到 localStorage
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'

const THEME_KEY = 'blog_theme_preference'
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
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
  // 首次访问跟随系统偏好
  if (typeof window !== 'undefined' && window.matchMedia) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? THEMES.DARK : THEMES.LIGHT
  }
  return THEMES.LIGHT
}

const ThemeContext = createContext({
  theme: THEMES.LIGHT,
  toggleTheme: () => {},
  setTheme: () => {}
})

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)
  const isManualRef = useRef(false)

  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])

  // 监听系统主题变化 (只有用户未手动设置过时跟随系统)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => {
      // 用户有明确偏好则不跟随
      if (isManualRef.current) return
      try {
        if (localStorage.getItem(THEME_KEY)) return
      } catch { /* noop */ }
      setThemeState(e.matches ? THEMES.DARK : THEMES.LIGHT)
    }
    mql.addEventListener?.('change', onChange)
    return () => mql.removeEventListener?.('change', onChange)
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
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
