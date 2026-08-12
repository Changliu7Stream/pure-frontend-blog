import { logout } from '../auth.js'

export default function Navbar({ siteTitle, authed, navigate, currentPath }) {
  const onLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <a
          href="#/"
          className="brand"
          onClick={(e) => {
            e.preventDefault()
            navigate('/')
          }}
        >
          <span className="brand-logo">📝</span>
          <span className="brand-text">{siteTitle}</span>
        </a>
        <nav className="nav-links">
          <a
            href="#/"
            className={currentPath === '/' || currentPath === '' ? 'nav-link active' : 'nav-link'}
            onClick={(e) => { e.preventDefault(); navigate('/') }}
          >
            首页
          </a>
          {authed ? (
            <>
              <a
                href="#/admin"
                className={currentPath.startsWith('/admin') ? 'nav-link active' : 'nav-link'}
                onClick={(e) => { e.preventDefault(); navigate('/admin') }}
              >
                管理后台
              </a>
              <button className="nav-link nav-btn" onClick={onLogout}>登出</button>
            </>
          ) : (
            <a
              href="#/admin/login"
              className="nav-link"
              onClick={(e) => { e.preventDefault(); navigate('/admin/login') }}
            >
              管理员登录
            </a>
          )}
        </nav>
      </div>
    </header>
  )
}
