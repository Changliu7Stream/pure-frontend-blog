import { useState } from 'react'
import { logout } from '../auth.js'
import { useTheme, THEMES } from '../theme.jsx'
import { DataStore } from '../datastore.js'
import { HomeIcon, ArchiveIcon, SunIcon, MoonIcon, LogoutIcon, LoginIcon, MenuIcon, XIcon, LayersIcon } from '../icons.jsx'

export default function Navbar({ siteTitle, authed, navigate, currentPath }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === THEMES.DARK
  const [menuOpen, setMenuOpen] = useState(false)

  // 读取已发布的独立页面 (导航栏显示)
  const pages = DataStore.Pages.getPublished()

  const onLogout = () => {
    logout()
    navigate('/')
  }

  const navLink = (to, label, icon, matchPrefix = false) => {
    const active = matchPrefix
      ? currentPath.startsWith(to)
      : currentPath === to || (to === '/' && currentPath === '')
    return (
      <a
        href={`#${to}`}
        className={active ? 'nav-link active' : 'nav-link'}
        onClick={(e) => { e.preventDefault(); navigate(to); setMenuOpen(false) }}
      >
        {icon}
        <span>{label}</span>
      </a>
    )
  }

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <a href="#/" className="brand" onClick={(e) => { e.preventDefault(); navigate('/') }}>
          <span className="brand-logo">
            <HomeIcon size={22} />
          </span>
          <span className="brand-text">{siteTitle}</span>
        </a>

        <button
          className="nav-menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="菜单"
        >
          {menuOpen ? <XIcon size={22} /> : <MenuIcon size={22} />}
        </button>

        <nav className={`nav-links ${menuOpen ? 'open' : ''}`}>
          {navLink('/', '首页', <HomeIcon size={16} />)}
          {navLink('/archive', '归档', <ArchiveIcon size={16} />)}
          {pages.map((page) => (
            <a
              key={page.id}
              href={`#/page/${encodeURIComponent(page.slug)}`}
              className={currentPath === `/page/${page.slug}` ? 'nav-link active' : 'nav-link'}
              onClick={(e) => { e.preventDefault(); navigate(`/page/${encodeURIComponent(page.slug)}`); setMenuOpen(false) }}
            >
              <LayersIcon size={16} />
              <span>{page.title}</span>
            </a>
          ))}
          {authed ? (
            <>
              {navLink('/admin', '管理后台', null, true)}
              <button className="nav-link nav-btn" onClick={onLogout}>
                <LogoutIcon size={16} />
                <span>登出</span>
              </button>
            </>
          ) : (
            navLink('/admin/login', '管理员登录', <LoginIcon size={16} />)
          )}
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            title={isDark ? '切换到亮色' : '切换到暗色'}
            aria-label="切换主题"
          >
            {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </button>
        </nav>
      </div>

      {menuOpen && <div className="nav-overlay" onClick={() => setMenuOpen(false)} />}
    </header>
  )
}
