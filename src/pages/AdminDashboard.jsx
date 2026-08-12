import { useEffect, useState } from 'react'
import { getAllPosts, deletePost, getPostCount } from '../db.js'
import { formatDate } from '../utils.js'

export default function AdminDashboard({ navigate }) {
  const [posts, setPosts] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = () => {
    setLoading(true)
    Promise.all([getAllPosts(), getPostCount()])
      .then(([data, c]) => {
        setPosts(data)
        setCount(c)
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

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div>
          <h2>管理后台</h2>
          <p className="muted">共 {count} 篇文章</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/admin/new')}>
          + 写新文章
        </button>
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
        <table className="admin-table">
          <thead>
            <tr>
              <th>标题</th>
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
      )}
    </div>
  )
}
