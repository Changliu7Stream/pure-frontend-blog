import { useEffect, useMemo, useState } from 'react'
import { DataStore } from '../datastore.js'
import { formatDateShort } from '../utils.js'
import { useDocumentMeta } from '../useDocumentMeta.js'
import { useTheme } from '../theme.jsx'
import { EyeIcon } from '../icons.jsx'

export default function Home({ navigate, initialQuery }) {
  const settings = DataStore.Settings.get()
  const siteTitle = settings.blogName || '我的博客'
  useDocumentMeta({ title: '', description: `${siteTitle} - ${settings.subtitle || ''}`, siteTitle })
  useTheme()

  const [posts, setPosts] = useState([])
  const [tags, setTags] = useState([])
  const [catCounts, setCatCounts] = useState([])

  const [query, setQuery] = useState(initialQuery?.get('q') || '')
  const [activeCategory, setActiveCategory] = useState('')
  const [activeTag, setActiveTag] = useState(initialQuery?.get('tag') || '')

  useEffect(() => {
    setPosts(DataStore.Posts.getAll())
    setTags(DataStore.Tags.getAll())
    setCatCounts(DataStore.Categories.getWithCounts())
  }, [])

  const filtered = useMemo(() => {
    let list = posts
    if (activeTag) list = DataStore.Posts.filterByTag(list, activeTag)
    if (activeCategory) list = DataStore.Posts.filterByCategory(list, activeCategory)
    if (query) list = DataStore.Posts.search(list, query)
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
      <section className="hero hero-compact" style={{ display: settings.heroEnabled === false ? 'none' : '' }}>
        <h1>欢迎来到 {siteTitle}</h1>
        <p>{settings.subtitle || '收录技术与生活随笔'}</p>
      </section>

      {(isFiltered) && (
        <div className="filter-status-bar">
          <span className="muted small">
            {activeTag && <span className="filter-tag">标签: #{activeTag}</span>}
            {activeCategory && <span className="filter-tag">分类: {activeCategory}</span>}
            {query && <span className="filter-tag">关键词: {query}</span>}
          </span>
          <button className="btn btn-sm" onClick={clearFilters}>清除筛选</button>
        </div>
      )}

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

          {filtered.length === 0 && (
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
                  {post.category && <span className="cat-badge">{post.category}</span>}
                  <span className="post-date">{formatDateShort(post.createdAt)}</span>
                </div>
                <h3 className="post-card-title">{post.title}</h3>
                <p className="post-card-excerpt">{post.excerpt || '（无摘要）'}</p>
                <div className="post-card-meta">
                  <span className="views-count">
                    <EyeIcon size={14} /> {Number(post.views || 0)}
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
