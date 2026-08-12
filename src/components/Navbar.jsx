import { logout } from '../auth.js'
import { useTheme, THEMES } from '../theme.jsx'

export default function Navbar({ siteTitle, authed, navigate, currentPath }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === THEMES.DARK

  const onLogout = () => {
    logout()
    navigate('/')
  }

  const navLink = (to, label, matchPrefix = false) => {
    const active = matchPrefix
      ? currentPath.startsWith(to)
      : currentPath === to || (to === '/' && currentPath === '')
    return (
      <a
        href={`#${to}`}
        className={active ? 'nav-link active' : 'nav-link'}
        onClick={(e) => { e.preventDefault(); navigate(to) }}
      >
        {label}
      </a>
    )
  }

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <a
          href="#/"
          className="brand"
          onClick={(e) => { e.preventDefault(); navigate('/') }}
        >
          <span className="brand-logo">📝</span>
          <span className="brand-text">{siteTitle}</span>
        </a>

        <nav className="nav-links">
          {navLink('/', '首页')}
          {navLink('/archive', '归档')}
          {authed ? (
            <>
              {navLink('/admin', '管理后台', true)}
              <button className="nav-link nav-btn" onClick={onLogout}>登出</button>
            </>
          ) : (
            navLink('/admin/login', '管理员登录')
          )}
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            title={isDark ? '切换到亮色' : '切换到暗色'}
            aria-label="切换主题"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </nav>
      </div>
    </header>
  )
}
