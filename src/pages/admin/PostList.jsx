import { useEffect, useMemo, useState } from 'react'
import { DataStore } from '../../datastore.js'
import { formatDate } from '../../utils.js'
import { useDocumentMeta } from '../../useDocumentMeta.js'
import { SearchIcon, EditIcon, TrashIcon, PlusIcon, EyeIcon } from '../../icons.jsx'

const PAGE_SIZE = 10

const STATUS_LABEL = {
  published: '已发布',
  draft: '草稿',
  scheduled: '定时'
}

// 生成分页页码区间,过多时用省略号
function pageRange(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push('...')
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total - 1) pages.push('...')
  pages.push(total)
  return pages
}

export default function PostList({ navigate }) {
  useDocumentMeta({ title: '文章管理', siteTitle: '管理后台' })

  const [posts, setPosts] = useState([])
  const [categories, setCategories] = useState([])
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [error, setError] = useState('')

  const reload = () => {
    try {
      setPosts(DataStore.Posts.getAll({ includeUnpublished: true }))
      setCategories(DataStore.Categories.getAll())
      setError('')
    } catch (err) {
      setError(err.message || '加载失败')
    }
  }

  useEffect(() => {
    reload()
  }, [])

  // 筛选条件变化时回到第一页
  useEffect(() => {
    setCurrentPage(1)
  }, [keyword, categoryFilter, statusFilter])

  const filtered = useMemo(() => {
    let result = posts
    if (keyword.trim()) {
      result = DataStore.Posts.search(result, keyword)
    }
    if (categoryFilter) {
      result = DataStore.Posts.filterByCategory(result, categoryFilter)
    }
    if (statusFilter !== 'all') {
      result = result.filter((p) => (p.status || 'published') === statusFilter)
    }
    return result
  }, [posts, keyword, categoryFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)
  const { items, total } = DataStore.Posts.paginate(filtered, safePage, PAGE_SIZE)

  const toggleStatus = (post) => {
    const next = (post.status === 'published' || post.status === 'scheduled') ? 'draft' : 'published'
    try {
      DataStore.Posts.update(post.id, { status: next })
      reload()
    } catch (err) {
      window.alert('状态切换失败: ' + (err.message || err))
    }
  }

  const handleDelete = (post) => {
    if (!window.confirm(`确定删除文章《${post.title}》?此操作不可恢复。`)) return
    try {
      DataStore.Posts.delete(post.id)
      reload()
    } catch (err) {
      window.alert('删除失败: ' + (err.message || err))
    }
  }

  const goEdit = (id) => navigate(`/admin/edit/${id}`)
  const goView = (slug) => navigate(`/post/${encodeURIComponent(slug)}`)
  const clearFilters = () => {
    setKeyword('')
    setCategoryFilter('')
    setStatusFilter('all')
  }

  const hasFilters = keyword.trim() || categoryFilter || statusFilter !== 'all'

  return (
    <div className="post-list">
      <div className="dashboard-header">
        <div>
          <h2>文章管理</h2>
          <p className="muted">共 {posts.length} 篇文章</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/admin/new')}>
          <PlusIcon size={16} /> 写新文章
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div
        className="post-list-toolbar"
        style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 16, marginBottom: 16 }}
      >
        <div className="search-field" style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <span
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              display: 'inline-flex',
              pointerEvents: 'none'
            }}
          >
            <SearchIcon size={16} />
          </span>
          <input
            className="input"
            type="text"
            placeholder="搜索标题、内容或标签…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: '100%', paddingLeft: 32 }}
          />
        </div>

        <select
          className="input"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ minWidth: 140 }}
        >
          <option value="">全部分类</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          className="input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ minWidth: 120 }}
        >
          <option value="all">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
          <option value="scheduled">定时</option>
        </select>

        {hasFilters && (
          <button className="btn btn-sm" onClick={clearFilters}>清除筛选</button>
        )}
      </div>

      {posts.length === 0 ? (
        <div className="empty-state">
          <p>还没有文章。</p>
          <button className="btn btn-primary" onClick={() => navigate('/admin/new')}>
            <PlusIcon size={16} /> 写新文章
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>没有匹配的文章。</p>
          <button className="btn" onClick={clearFilters}>清除筛选</button>
        </div>
      ) : (
        <>
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
                  <th className="col-actions">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((post) => {
                  const status = post.status || 'published'
                  return (
                    <tr key={post.id}>
                      <td className="cell-title">
                        <a
                          href={`#/admin/edit/${post.id}`}
                          onClick={(e) => { e.preventDefault(); goEdit(post.id) }}
                        >
                          {post.title}
                        </a>
                      </td>
                      <td>
                        {post.category
                          ? <span className="cat-badge cat-sm">{post.category}</span>
                          : '—'}
                      </td>
                      <td className="cell-tags">
                        {post.tags && post.tags.length
                          ? post.tags.slice(0, 3).map((t) => (
                              <span key={t} className="tag-sm">#{t}</span>
                            ))
                          : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`status-pill ${status}`}
                          style={status === 'scheduled'
                            ? { background: 'var(--primary-soft)', color: 'var(--primary)' }
                            : undefined}
                          onClick={() => toggleStatus(post)}
                          title="点击切换发布/草稿状态"
                        >
                          {STATUS_LABEL[status]}
                        </button>
                      </td>
                      <td>{post.views || 0}</td>
                      <td>{formatDate(post.createdAt)}</td>
                      <td className="col-actions">
                        <button
                          className="btn btn-sm"
                          onClick={() => goView(post.slug)}
                          title="查看文章"
                        >
                          <EyeIcon size={14} />
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => goEdit(post.id)}
                          title="编辑"
                        >
                          <EditIcon size={14} />
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(post)}
                          title="删除"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div
              className="pagination"
              style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}
            >
              <button
                className="btn btn-sm"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage(safePage - 1)}
              >
                上一页
              </button>
              {pageRange(safePage, totalPages).map((p, i) =>
                p === '...' ? (
                  <span key={`e${i}`} className="muted" style={{ padding: '0 4px' }}>…</span>
                ) : (
                  <button
                    key={p}
                    className={`btn btn-sm ${p === safePage ? 'btn-primary' : ''}`}
                    onClick={() => setCurrentPage(p)}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                className="btn btn-sm"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage(safePage + 1)}
              >
                下一页
              </button>
            </div>
          )}

          <p className="muted small" style={{ textAlign: 'center', marginTop: 10 }}>
            第 {safePage} / {totalPages} 页 · 共 {total} 篇
          </p>
        </>
      )}
    </div>
  )
}
