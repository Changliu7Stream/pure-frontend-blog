import { useEffect, useState } from 'react'
import { DataStore } from '../../datastore.js'
import { formatDate } from '../../utils.js'
import { useDocumentMeta } from '../../useDocumentMeta.js'
import { useToast } from '../../components/Toast.jsx'
import {
  FileTextIcon,
  EyeIcon,
  FolderIcon,
  TagIcon,
  ClockIcon,
  MessageIcon,
  DownloadIcon
} from '../../icons.jsx'

const STATUS_LABELS = {
  published: '已发布',
  draft: '草稿',
  scheduled: '定时'
}

const QUICK_ACTIONS = [
  { label: '写新文章', icon: FileTextIcon, path: '/admin/new' },
  { label: '分类管理', icon: FolderIcon, path: '/admin/categories' },
  { label: '标签管理', icon: TagIcon, path: '/admin/tags' },
  { label: '评论管理', icon: MessageIcon, path: '/admin/comments' },
  { label: '数据备份', icon: DownloadIcon, path: '/admin/backup' }
]

export default function Dashboard({ navigate }) {
  useDocumentMeta({ title: '仪表盘', siteTitle: '管理后台' })
  const toast = useToast()

  const [stats, setStats] = useState(null)
  const [comments, setComments] = useState(null)
  const [recent, setRecent] = useState([])

  useEffect(() => {
    try {
      setStats(DataStore.Posts.getStats())
      setComments(DataStore.Comments.getCounts())
      setRecent(DataStore.Posts.getRecent(5))
    } catch (err) {
      toast.error(err.message || '加载失败')
    }
  }, [])

  const statCards = stats
    ? [
        { label: '总文章', value: stats.total, icon: FileTextIcon },
        { label: '已发布', value: stats.published, icon: FileTextIcon, numClass: 'ok' },
        { label: '草稿', value: stats.drafts, icon: FileTextIcon, numClass: 'warn' },
        { label: '定时发布', value: stats.scheduled, icon: ClockIcon, numClass: 'warn' },
        { label: '分类', value: stats.categories, icon: FolderIcon },
        { label: '标签', value: stats.tags, icon: TagIcon },
        { label: '总浏览', value: stats.totalViews, icon: EyeIcon },
        { label: '待审评论', value: comments ? comments.pending : 0, icon: MessageIcon, numClass: 'warn' }
      ]
    : []

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div>
          <h2>仪表盘</h2>
          <p className="muted">共 {stats ? stats.total : 0} 篇文章</p>
        </div>
      </div>

      {stats && (
        <div className="stats-row">
          {statCards.map((card) => {
            const Icon = card.icon
            const numClass = card.numClass ? `stat-num ${card.numClass}` : 'stat-num'
            return (
              <div key={card.label} className="stat-card">
                <div className="stat-label">
                  <Icon size={14} /> {card.label}
                </div>
                <div className={numClass}>{card.value}</div>
              </div>
            )
          })}
        </div>
      )}

      <section className="admin-section">
        <h3 className="admin-section-title">最近发布</h3>
        {recent.length === 0 ? (
          <p className="muted">还没有文章,先写一篇吧。</p>
        ) : (
          <ul className="recent-list">
            {recent.map((post) => (
              <li key={post.id} className="recent-item">
                <a
                  className="recent-item-title"
                  href={`#/admin/edit/${post.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    navigate(`/admin/edit/${post.id}`)
                  }}
                >
                  {post.title || '无标题'}
                </a>
                <div className="recent-item-meta">
                  {post.category && <span className="cat-badge cat-sm">{post.category}</span>}
                  <span className={`status-badge ${post.status || 'draft'}`}>
                    {STATUS_LABELS[post.status] || '草稿'}
                  </span>
                  <span className="recent-item-date">
                    <ClockIcon size={13} /> {formatDate(post.createdAt)}
                  </span>
                  <span className="recent-item-views">
                    <EyeIcon size={13} /> {post.views || 0}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-section">
        <h3 className="admin-section-title">快捷操作</h3>
        <div className="quick-actions">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.path}
                type="button"
                className="quick-action-btn"
                onClick={() => navigate(action.path)}
              >
                <Icon size={18} />
                <span>{action.label}</span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
