import { useEffect, useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { getPostBySlug, deletePost, incrementViews } from '../db.js'
import { formatDate } from '../utils.js'
import { useDocumentMeta } from '../useDocumentMeta.js'

marked.setOptions({ breaks: true, gfm: true })

// DOMPurify 默认会保留 safe HTML,拦截 script/style/onX/iframe 等危险内容
// 此处配置允许常见富文本和图片 base64
const PURIFY_CONFIG = {
  ADD_ATTR: ['target', 'rel', 'data-*'],
  ADD_URI_SAFE_ATTR: ['src', 'href'],
  ALLOW_DATA_ATTR: true,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|ftp|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))|^data:image\/(?:png|jpe?g|gif|webp|svg\+xml|bmp)/i
}

export default function PostDetail({ slug, navigate, authed }) {
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [views, setViews] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    getPostBySlug(decodeURIComponent(slug))
      .then((data) => {
        if (!active) return
        if (!data) {
          setError('文章不存在或已被删除')
          return
        }
        setPost(data)
        setViews(Number(data.views || 0))
        // 阅读量 +1, 静默异步
        incrementViews(data.id).then(() => {
          if (active) setViews((v) => v + 1)
        })
      })
      .catch((err) => active && setError(err.message || '加载失败'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [slug])

  useDocumentMeta({
    title: post?.title || '',
    description: post?.excerpt || '',
    siteTitle: import.meta.env.VITE_SITE_TITLE || '我的博客'
  })

  // 根据 contentFormat 渲染, 使用 DOMPurify 防止 XSS
  const renderedHtml = useMemo(() => {
    if (!post) return ''
    const fmt = post.contentFormat === 'html' ? 'html' : 'markdown'
    try {
      const raw = fmt === 'html'
        ? post.content || ''
        : marked.parse(post.content || '')
      return DOMPurify.sanitize(raw, PURIFY_CONFIG)
    } catch (e) {
      console.error('渲染失败:', e)
      return '<p class="muted">内容渲染失败。</p>'
    }
  }, [post])

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
  if (error) return <div className="alert alert-error">{error}</div>

  return (
    <article className="post-detail">
      <button className="back-link" onClick={() => navigate('/')}>
        ← 返回列表
      </button>

      <div className="post-detail-head">
        {post.category && <span className="cat-badge">{post.category}</span>}
        <h1 className="post-title">{post.title}</h1>
        <div className="post-meta">
          <span>发布于 {formatDate(post.createdAt)}</span>
          {post.updatedAt && post.updatedAt !== post.createdAt && (
            <span>· 更新于 {formatDate(post.updatedAt)}</span>
          )}
          <span>· 阅读 👁 {views}</span>
        </div>
        {post.tags?.length > 0 && (
          <div className="tags post-tags">
            {post.tags.map((t) => (
              <a
                key={t}
                className="tag"
                href="#/"
                onClick={(e) => {
                  e.preventDefault()
                  // 通过首页传参的方式实现: 直接导航到首页, 由 Home 组件自己通过 query string 过滤
                  navigate(`/?tag=${encodeURIComponent(t)}`)
                }}
              >
                #{t}
              </a>
            ))}
          </div>
        )}
      </div>

      <div
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />

      {authed && (
        <div className="post-actions">
          <button className="btn btn-primary" onClick={() => navigate(`/admin/edit/${post.id}`)}>
            编辑
          </button>
          <button className="btn btn-danger" onClick={onDelete}>
            删除
          </button>
          <span className="post-status-pill">
            {post.published === false ? '状态: 草稿' : '状态: 已发布'}
          </span>
        </div>
      )}
    </article>
  )
}
