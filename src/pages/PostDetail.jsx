import { useEffect, useState } from 'react'
import { marked } from 'marked'
import { getPostBySlug, deletePost } from '../db.js'
import { formatDate } from '../utils.js'

marked.setOptions({ breaks: true, gfm: true })

export default function PostDetail({ slug, navigate, authed }) {
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    getPostBySlug(decodeURIComponent(slug))
      .then((data) => {
        if (!active) return
        if (!data) {
          setError('文章不存在或已被删除')
        } else {
          setPost(data)
        }
      })
      .catch((err) => active && setError(err.message || '加载失败'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [slug])

  const onDelete = async () => {
    if (!post) return
    if (!window.confirm(`确定删除文章《${post.title}》?此操作不可恢复。`)) return
    try {
      await deletePost(post.id)
      navigate('/')
    } catch (err) {
      window.alert('删除失败: ' + (err.message || err))
    }
  }

  if (loading) return <p className="muted">加载中…</p>
  if (error) {
    return (
      <div className="alert alert-error">{error}</div>
    )
  }

  const html = marked.parse(post.content || '')

  return (
    <article className="post-detail">
      <button className="back-link" onClick={() => navigate('/')}>
        ← 返回列表
      </button>
      <h1 className="post-title">{post.title}</h1>
      <div className="post-meta">
        <span>发布于 {formatDate(post.createdAt)}</span>
        {post.updatedAt && post.updatedAt !== post.createdAt && (
          <span>· 更新于 {formatDate(post.updatedAt)}</span>
        )}
      </div>
      {post.tags?.length > 0 && (
        <div className="tags post-tags">
          {post.tags.map((t) => (
            <span key={t} className="tag">{t}</span>
          ))}
        </div>
      )}
      <div
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {authed && (
        <div className="post-actions">
          <button className="btn btn-primary" onClick={() => navigate(`/admin/edit/${post.id}`)}>
            编辑
          </button>
          <button className="btn btn-danger" onClick={onDelete}>
            删除
          </button>
        </div>
      )}
    </article>
  )
}
