import { useEffect, useMemo, useState } from 'react'
import { getAllPosts, groupPostsByYearMonth } from '../db.js'
import { formatDateShort } from '../utils.js'
import { useDocumentMeta } from '../useDocumentMeta.js'

export default function Archive({ navigate }) {
  const siteTitle = import.meta.env.VITE_SITE_TITLE || '我的博客'
  useDocumentMeta({
    title: '文章归档',
    description: `${siteTitle} - 按年月归档的全部文章列表。`,
    siteTitle
  })

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getAllPosts()
      .then((list) => active && setPosts(list))
      .catch((err) => active && setError(err.message || '加载失败'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const { groups, years } = useMemo(() => groupPostsByYearMonth(posts), [posts])

  return (
    <div className="archive-page">
      <header className="archive-header">
        <h1>文章归档</h1>
        <p className="muted">共 {posts.length} 篇文章，按年月倒序展示。</p>
      </header>

      {loading && <p className="muted">加载中…</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && posts.length === 0 && (
        <div className="empty-state">
          <p>暂无文章。</p>
        </div>
      )}

      <div className="archive-timeline">
        {years.map((year) => (
          <section key={year} className="archive-year">
            <h2 className="archive-year-title">{year} 年</h2>
            {Object.keys(groups[year]).map((month) => (
              <div key={month} className="archive-month">
                <h3 className="archive-month-title">
                  {month} 月
                  <span className="count-badge">{groups[year][month].length}</span>
                </h3>
                <ul className="archive-list">
                  {groups[year][month].map((post) => (
                    <li key={post.id} className="archive-item">
                      <span className="archive-day">
                        {formatDateShort(post.createdAt).slice(5)}
                      </span>
                      <a
                        className="archive-link"
                        href={`#/post/${encodeURIComponent(post.slug)}`}
                        onClick={(e) => {
                          e.preventDefault()
                          navigate(`/post/${encodeURIComponent(post.slug)}`)
                        }}
                      >
                        {post.category && <span className="cat-badge cat-sm">{post.category}</span>}
                        {post.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
