import { useEffect, useState } from 'react'
import { getAllPosts } from '../db.js'
import { formatDateShort, excerptFromContent } from '../utils.js'

export default function Home({ navigate }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    getAllPosts()
      .then((data) => {
        if (active) {
          setPosts(data)
          setError('')
        }
      })
      .catch((err) => active && setError(err.message || '加载失败'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="home">
      <section className="hero">
        <h1>欢迎来到博客</h1>
        <p>这里收录管理员发布的技术与生活随笔。所有内容均存储于浏览器本地数据库。</p>
      </section>

      <h2 className="section-title">文章列表</h2>

      {loading && <p className="muted">加载中…</p>}
      {error && <p className="alert alert-error">{error}</p>}
      {!loading && !error && posts.length === 0 && (
        <div className="empty-state">
          <p>暂无文章。</p>
          <p className="muted">管理员登录后即可发布第一篇文章。</p>
        </div>
      )}

      <div className="post-list">
        {posts.map((post) => (
          <article
            key={post.id}
            className="post-card"
            onClick={() => navigate(`/post/${encodeURIComponent(post.slug)}`)}
          >
            <h3 className="post-card-title">{post.title}</h3>
            <p className="post-card-excerpt">
              {post.excerpt || excerptFromContent(post.content)}
            </p>
            <div className="post-card-meta">
              <span>{formatDateShort(post.createdAt)}</span>
              {post.tags?.length > 0 && (
                <span className="tags">
                  {post.tags.slice(0, 3).map((t) => (
                    <span key={t} className="tag">{t}</span>
                  ))}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
