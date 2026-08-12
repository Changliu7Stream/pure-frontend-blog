import { useEffect, useState } from 'react'
import {
  getAllPosts,
  deletePost,
  getPostCount,
  getCategoryCounts,
  getAllTags,
  updatePost
} from '../db.js'
import { formatDate } from '../utils.js'
import { useDocumentMeta } from '../useDocumentMeta.js'

export default function AdminDashboard({ navigate }) {
  useDocumentMeta({ title: '管理后台', siteTitle: '管理后台' })

  const [posts, setPosts] = useState([])
  const [stats, setStats] = useState({ total: 0, published: 0, draft: 0, categories: 0, tags: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = () => {
    setLoading(true)
    Promise.all([
      getAllPosts({ includeUnpublished: true }),
      getPostCount(),
      getCategoryCounts(),
      getAllTags()
    ])
      .then(([data, total, cats, tags]) => {
        setPosts(data)
        const published = data.filter((p) => p.published !== false).length
        setStats({
          total,
          published,
          draft: data.length - published,
          categories: cats.length,
          tags: tags.length
        })
        setError('')
      })
      .catch((err) => setError(err.message || '加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [])

  const onDelete = async (id, title) => {
    if (!window.confirm(`确定删除文章《${title}》?此操作不可恢复。`)) return
    try {
      await deletePost(id)
      reload()
    } catch (err) {
      window.alert('删除失败: ' + (err.message || err))
    }
  }

  const togglePublished = async (post) => {
    // 快速切换状态: 调用 updatePost
    try {
      await updatePost(post.id, { published: !(post.published !== false) })
      reload()
    } catch (err) {
      window.alert('状态切换失败: ' + (err.message || err))
    }
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div>
          <h2>管理后台</h2>
          <p className="muted">共 {posts.length} 篇文章</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/admin/new')}>
          + 写新文章
        </button>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">总文章</div>
          <div className="stat-num">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">已发布</div>
          <div className="stat-num ok">{stats.published}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">草稿</div>
          <div className="stat-num warn">{stats.draft}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">分类 / 标签</div>
          <div className="stat-num">{stats.categories} / {stats.tags}</div>
        </div>
      </div>

      {loading && <p className="muted">加载中…</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && posts.length === 0 && (
        <div className="empty-state">
          <p>还没有文章。</p>
          <button className="btn btn-primary" onClick={() => navigate('/admin/new')}>
            发布第一篇文章
          </button>
        </div>
      )}

      {posts.length > 0 && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>标题</th>
                <th>分类</th>
                <th>标签</th>
                <th>状态</th>
                <th>阅读</th>
                <th>创建时间</th>
                <th>更新时间</th>
                <th className="col-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <td className="cell-title">
                    <a
                      href={`#/post/${encodeURIComponent(post.slug)}`}
                      onClick={(e) => { e.preventDefault(); navigate(`/post/${encodeURIComponent(post.slug)}`) }}
                    >
                      {post.title}
                    </a>
                  </td>
                  <td>
                    {post.category ? <span className="cat-badge cat-sm">{post.category}</span> : '—'}
                  </td>
                  <td className="cell-tags">
                    {post.tags?.length
                      ? post.tags.slice(0, 3).map((t) => <span key={t} className="tag-sm">#{t}</span>)
                      : '—'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`status-pill ${post.published === false ? 'draft' : 'published'}`}
                      onClick={() => togglePublished(post)}
                      title="点击切换状态"
                    >
                      {post.published === false ? '草稿' : '已发布'}
                    </button>
                  </td>
                  <td>{post.views || 0}</td>
                  <td>{formatDate(post.createdAt)}</td>
                  <td>{post.updatedAt === post.createdAt ? '—' : formatDate(post.updatedAt)}</td>
                  <td className="col-actions">
                    <button className="btn btn-sm" onClick={() => navigate(`/admin/edit/${post.id}`)}>
                      编辑
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => onDelete(post.id, post.title)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
