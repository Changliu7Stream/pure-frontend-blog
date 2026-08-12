import { useEffect, useMemo, useState } from 'react'
import { DataStore } from '../datastore.js'
import { formatDateShort } from '../utils.js'
import { useDocumentMeta } from '../useDocumentMeta.js'

export default function Archive({ navigate }) {
  const settings = DataStore.Settings.get()
  const siteTitle = settings.blogName || '我的博客'
  useDocumentMeta({
    title: '文章归档',
    description: `${siteTitle} - 按年月归档的全部文章列表。`,
    siteTitle
  })

  const [posts, setPosts] = useState([])

  useEffect(() => {
    setPosts(DataStore.Posts.getAll())
  }, [])

  const { groups, years } = useMemo(() => DataStore.Posts.groupByYearMonth(posts), [posts])

  return (
    <div className="archive-page">
      <header className="archive-header">
        <h1>文章归档</h1>
        <p className="muted">共 {posts.length} 篇文章,按年月倒序展示。</p>
      </header>

      {posts.length === 0 && (
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
