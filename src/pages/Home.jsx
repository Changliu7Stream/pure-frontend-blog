import { useEffect, useMemo, useState } from 'react'
import {
  getAllPosts,
  getAllTags,
  getCategoryCounts,
  searchPosts,
  filterPostsByCategory,
  filterPostsByTag
} from '../db.js'
import { formatDateShort } from '../utils.js'
import { useDocumentMeta } from '../useDocumentMeta.js'
import { useTheme } from '../theme.jsx'

export default function Home({ navigate }) {
  const siteTitle = import.meta.env.VITE_SITE_TITLE || '我的博客'
  useDocumentMeta({ title: '', description: `${siteTitle} - 纯前端博客,收录技术与生活随笔。`, siteTitle })
  useTheme() // 确保 Provider 挂载时触发首次应用

  const [posts, setPosts] = useState([])
  const [tags, setTags] = useState([])
  const [catCounts, setCatCounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 筛选状态
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [activeTag, setActiveTag] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getAllPosts(), getAllTags(), getCategoryCounts()])
      .then(([p, t, c]) => {
        if (!active) return
        setPosts(p)
        setTags(t)
        setCatCounts(c)
      })
      .catch((err) => active && setError(err.message || '加载失败'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    let list = posts
    list = filterPostsByCategory(list, activeCategory)
    list = filterPostsByTag(list, activeTag)
    list = searchPosts(list, query)
    return list
  }, [posts, query, activeCategory, activeTag])

  const onTagClick = (name) => {
    setActiveTag((prev) => (prev === name ? '' : name))
    setActiveCategory('')
  }

  const onCategoryClick = (name) => {
    setActiveCategory((prev) => (prev === name ? '' : name))
    setActiveTag('')
  }

  const clearFilters = () => {
    setQuery('')
    setActiveCategory('')
    setActiveTag('')
  }

  const isFiltered = Boolean(query || activeCategory || activeTag)

  return (
    <div className="home">
      <section className="hero">
        <h1>欢迎来到 {siteTitle}</h1>
        <p>收录技术与生活随笔。内容均存储于浏览器本地数据库。</p>
        <div className="search-box">
          <input
            type="search"
            className="input search-input"
            placeholder="搜索文章标题、内容、标签…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isFiltered && (
            <button className="btn btn-sm" onClick={clearFilters}>清除筛选</button>
          )}
        </div>
      </section>

      {loading && <p className="muted">加载中…</p>}
      {error && <p className="alert alert-error">{error}</p>}

      <div className="home-layout">
        <aside className="home-sidebar">
          <div className="sidebar-card">
            <h3 className="sidebar-title">分类</h3>
            {catCounts.length === 0 && <p className="muted small">暂无分类</p>}
            <ul className="sidebar-list">
              {catCounts.map(({ name, count }) => (
                <li key={name}>
                  <button
                    type="button"
                    className={`cat-chip ${activeCategory === name ? 'active' : ''}`}
                    onClick={() => onCategoryClick(name)}
                  >
                    <span>{name}</span>
                    <span className="count">{count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="sidebar-card">
            <h3 className="sidebar-title">标签</h3>
            {tags.length === 0 && <p className="muted small">暂无标签</p>}
            <div className="tag-cloud">
              {tags.map(({ name, count }) => {
                const size = Math.min(18, 12 + Math.min(6, Math.floor(count / 2)))
                return (
                  <button
                    key={name}
                    type="button"
                    className={`tag-chip ${activeTag === name ? 'active' : ''}`}
                    style={{ fontSize: `${size}px` }}
                    onClick={() => onTagClick(name)}
                  >
                    #{name}
                    <span className="count">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        <section className="home-main">
          <div className="section-head">
            <h2 className="section-title">
              {isFiltered ? '筛选结果' : '最新文章'}
              <span className="count-badge">{filtered.length}</span>
            </h2>
          </div>

          {!loading && !error && filtered.length === 0 && (
            <div className="empty-state">
              <p>{isFiltered ? '没有符合条件的文章。' : '暂无文章。'}</p>
              {isFiltered && (
                <button className="btn btn-sm btn-primary" onClick={clearFilters}>
                  清除筛选
                </button>
              )}
              {!isFiltered && <p className="muted">管理员登录后即可发布第一篇文章。</p>}
            </div>
          )}

          <div className="post-list">
            {filtered.map((post) => (
              <article
                key={post.id}
                className="post-card"
                onClick={() => navigate(`/post/${encodeURIComponent(post.slug)}`)}
              >
                <div className="post-card-top">
                  {post.category && (
                    <span className="cat-badge">{post.category}</span>
                  )}
                  <span className="post-date">{formatDateShort(post.createdAt)}</span>
                </div>
                <h3 className="post-card-title">{post.title}</h3>
                <p className="post-card-excerpt">
                  {post.excerpt || '（无摘要）'}
                </p>
                <div className="post-card-meta">
                  <span>
                    👁 {Number(post.views || 0)}
                  </span>
                  {post.tags?.length > 0 && (
                    <span className="tags">
                      {post.tags.slice(0, 3).map((t) => (
                        <span key={t} className="tag">#{t}</span>
                      ))}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
