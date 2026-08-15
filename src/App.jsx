import { useEffect, useState } from 'react'
import { useHashRoute, matchPath } from './router'
import { isAuthenticated } from './auth'
import { DataStore } from './datastore.js'
import { ThemeProvider } from './theme.jsx'
import { ToastProvider } from './components/Toast.jsx'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import PostDetail from './pages/PostDetail.jsx'
import Archive from './pages/Archive.jsx'
import PageView from './pages/PageView.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import NotFound from './pages/NotFound.jsx'
import PostEditor from './pages/PostEditor.jsx'
import AdminLayout from './components/AdminLayout.jsx'
import Dashboard from './pages/admin/Dashboard.jsx'
import PostList from './pages/admin/PostList.jsx'
import Categories from './pages/admin/Categories.jsx'
import Tags from './pages/admin/Tags.jsx'
import Pages from './pages/admin/Pages.jsx'
import Comments from './pages/admin/Comments.jsx'
import Backup from './pages/admin/Backup.jsx'
import Settings from './pages/admin/Settings.jsx'
import AIChat from './pages/admin/AIChat.jsx'
import AIConfig from './pages/admin/AIConfig.jsx'

function InnerApp() {
  const { route, navigate } = useHashRoute()
  const [authed, setAuthed] = useState(isAuthenticated())

  useEffect(() => {
    const onSessionChange = () => setAuthed(isAuthenticated())
    window.addEventListener('admin-session-change', onSessionChange)
    return () => window.removeEventListener('admin-session-change', onSessionChange)
  }, [])

  // 启动时检查定时发布
  useEffect(() => {
    DataStore.Posts.checkScheduled()
  }, [])

  function renderPage() {
    const { path } = route

    // ---- 公共页面 ----
    if (path === '/' || path === '') {
      return <Home navigate={navigate} initialQuery={route.query} />
    }

    let m = matchPath('/post/:slug', path)
    if (m) return <PostDetail slug={m.slug} navigate={navigate} authed={authed} />

    if (path === '/archive' || path === '/archive/') {
      return <Archive navigate={navigate} />
    }

    m = matchPath('/page/:slug', path)
    if (m) return <PageView slug={m.slug} navigate={navigate} />

    // ---- 管理后台登录 ----
    if (path === '/admin/login') {
      return authed ? <AdminLayout navigate={navigate} currentPath={path}><Dashboard navigate={navigate} /></AdminLayout> : <AdminLogin navigate={navigate} />
    }

    // ---- 受保护的管理后台页面 ----
    const adminPaths = ['/admin', '/admin/posts', '/admin/categories', '/admin/tags', '/admin/pages', '/admin/comments', '/admin/backup', '/admin/settings', '/admin/ai', '/admin/ai-config', '/admin/new', '/admin/edit', '/admin/pages/new', '/admin/pages/edit']
    const isAdminPath = adminPaths.some((p) => path === p || path.startsWith(p + '/'))

    if (isAdminPath) {
      if (!authed) return <AdminLogin navigate={navigate} />

      // 文章编辑器 (不在 AdminLayout 内,全屏编辑)
      m = matchPath('/admin/new', path)
      if (m) return <PostEditor navigate={navigate} mode="new" />

      m = matchPath('/admin/edit/:id', path)
      if (m) return <PostEditor navigate={navigate} mode="edit" postId={Number(m.id)} />

      // 其余管理页面在 AdminLayout 内渲染
      let adminContent = null

      if (path === '/admin' || path === '/admin/') {
        adminContent = <Dashboard navigate={navigate} />
      } else if (path === '/admin/posts' || path === '/admin/posts/') {
        adminContent = <PostList navigate={navigate} />
      } else if (path === '/admin/categories' || path === '/admin/categories/') {
        adminContent = <Categories navigate={navigate} />
      } else if (path === '/admin/tags' || path === '/admin/tags/') {
        adminContent = <Tags navigate={navigate} />
      } else if (path === '/admin/pages' || path === '/admin/pages/') {
        adminContent = <Pages navigate={navigate} />
      } else if (path === '/admin/comments' || path === '/admin/comments/') {
        adminContent = <Comments navigate={navigate} />
      } else if (path === '/admin/backup' || path === '/admin/backup/') {
        adminContent = <Backup navigate={navigate} />
      } else if (path === '/admin/settings' || path === '/admin/settings/') {
        adminContent = <Settings navigate={navigate} />
      } else if (path === '/admin/ai' || path === '/admin/ai/') {
        adminContent = <AIChat navigate={navigate} />
      } else if (path === '/admin/ai-config' || path === '/admin/ai-config/') {
        adminContent = <AIConfig navigate={navigate} />
      } else {
        adminContent = <NotFound navigate={navigate} />
      }

      return (
        <AdminLayout navigate={navigate} currentPath={path}>
          {adminContent}
        </AdminLayout>
      )
    }

    return <NotFound navigate={navigate} />
  }

  // 从 DataStore 读取站点设置
  const settings = DataStore.Settings.get()

  return (
    <div className="app">
      <Navbar
        siteTitle={settings.blogName || '我的博客'}
        authed={authed}
        navigate={navigate}
        currentPath={route.path}
      />
      <main className="container">{renderPage()}</main>
      <footer className="footer">
        <span>{settings.footer || '纯前端博客 · localStorage 本地存储'}</span>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <InnerApp />
      </ToastProvider>
    </ThemeProvider>
  )
}
