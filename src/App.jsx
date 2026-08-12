import { useEffect, useState } from 'react'
import { useHashRoute, matchPath } from './router'
import { isAuthenticated } from './auth'
import { ThemeProvider } from './theme.jsx'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import PostDetail from './pages/PostDetail.jsx'
import Archive from './pages/Archive.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import PostEditor from './pages/PostEditor.jsx'
import NotFound from './pages/NotFound.jsx'

const SITE_TITLE = import.meta.env.VITE_SITE_TITLE || '我的博客'

function InnerApp() {
  const { route, navigate } = useHashRoute()
  const [authed, setAuthed] = useState(isAuthenticated())

  useEffect(() => {
    const onSessionChange = () => setAuthed(isAuthenticated())
    window.addEventListener('admin-session-change', onSessionChange)
    return () => window.removeEventListener('admin-session-change', onSessionChange)
  }, [])

  function renderPage() {
    const { path } = route

    if (path === '/' || path === '') {
      return <Home navigate={navigate} initialQuery={route.query} />
    }

    let m = matchPath('/post/:slug', path)
    if (m) return <PostDetail slug={m.slug} navigate={navigate} authed={authed} />

    if (path === '/archive' || path === '/archive/') {
      return <Archive navigate={navigate} />
    }

    if (path === '/admin/login') {
      return authed ? <AdminDashboard navigate={navigate} /> : <AdminLogin navigate={navigate} />
    }

    // 受保护页面
    if (path === '/admin' || path === '/admin/') {
      if (!authed) return <AdminLogin navigate={navigate} />
      return <AdminDashboard navigate={navigate} />
    }

    m = matchPath('/admin/new', path)
    if (m) {
      if (!authed) return <AdminLogin navigate={navigate} />
      return <PostEditor navigate={navigate} mode="new" />
    }

    m = matchPath('/admin/edit/:id', path)
    if (m) {
      if (!authed) return <AdminLogin navigate={navigate} />
      return <PostEditor navigate={navigate} mode="edit" postId={Number(m.id)} />
    }

    return <NotFound navigate={navigate} />
  }

  return (
    <div className="app">
      <Navbar
        siteTitle={SITE_TITLE}
        authed={authed}
        navigate={navigate}
        currentPath={route.path}
      />
      <main className="container">{renderPage()}</main>
      <footer className="footer">
        <span>© {new Date().getFullYear()} {SITE_TITLE}</span>
        <span className="footer-meta">纯前端博客 · IndexedDB 本地存储 · React + Vite</span>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <InnerApp />
    </ThemeProvider>
  )
}
