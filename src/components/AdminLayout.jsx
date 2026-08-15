import { useState } from 'react'
import { getAdminUsername, logout } from '../auth.js'
import { DataStore } from '../datastore.js'
import {
  DashboardIcon, FileTextIcon, FolderIcon, TagIcon, LayersIcon,
  MessageIcon, DownloadIcon, SettingsIcon, LogoutIcon, MenuIcon, XIcon,
  SparklesIcon, BrainIcon
} from '../icons.jsx'

const NAV_ITEMS = [
  { path: '/admin', label: '仪表盘', icon: DashboardIcon, exact: true },
  { path: '/admin/posts', label: '文章管理', icon: FileTextIcon },
  { path: '/admin/categories', label: '分类管理', icon: FolderIcon },
  { path: '/admin/tags', label: '标签管理', icon: TagIcon },
  { path: '/admin/pages', label: '页面管理', icon: LayersIcon },
  { path: '/admin/comments', label: '评论管理', icon: MessageIcon, badge: true },
  { path: '/admin/backup', label: '备份恢复', icon: DownloadIcon },
  { path: '/admin/settings', label: '系统设置', icon: SettingsIcon }
]

export default function AdminLayout({ children, navigate, currentPath }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const username = getAdminUsername()
  const commentCounts = DataStore.Comments.getCounts()
  const pendingCount = commentCounts.pending
  const settings = DataStore.Settings.get()
  const labEnabled = settings.labEnabled || false

  const onLogout = () => {
    logout()
    navigate('/')
  }

  const isActive = (item) => {
    if (item.exact) return currentPath === item.path
    return currentPath.startsWith(item.path)
  }

  const handleNav = (path) => {
    navigate(path)
    setSidebarOpen(false)
  }

  return (
    <div className="admin-layout">
      <button
        className="admin-sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="切换侧边栏"
      >
        {sidebarOpen ? <XIcon size={22} /> : <MenuIcon size={22} />}
      </button>

      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-head">
          <span className="admin-user">{username}</span>
          <button className="btn btn-sm" onClick={onLogout}>
            <LogoutIcon size={15} /> 退出
          </button>
        </div>
        <nav className="admin-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.path}
                className={`admin-nav-item ${isActive(item) ? 'active' : ''}`}
                onClick={() => handleNav(item.path)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {item.badge && pendingCount > 0 && (
                  <span className="admin-nav-badge">{pendingCount}</span>
                )}
              </button>
            )
          })}
          {labEnabled && (
            <button
              className={`admin-nav-item ${currentPath.startsWith('/admin/ai') ? 'active' : ''}`}
              onClick={() => handleNav('/admin/ai')}
              style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}
            >
              <SparklesIcon size={17} />
              <span>AI 助手</span>
            </button>
          )}
        </nav>
        <div className="admin-sidebar-foot">
          <button className="btn btn-sm btn-block" onClick={() => navigate('/')}>
            返回博客首页
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="admin-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="admin-content">
        {children}
      </div>
    </div>
  )
}
