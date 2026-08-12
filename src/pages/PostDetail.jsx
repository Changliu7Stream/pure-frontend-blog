import { useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { DataStore } from '../datastore.js'
import { formatDate } from '../utils.js'
import { useDocumentMeta } from '../useDocumentMeta.js'
import { ArrowLeftIcon, EyeIcon, EditIcon, TrashIcon, MessageIcon } from '../icons.jsx'
import { useToast } from '../components/Toast.jsx'

marked.setOptions({ breaks: true, gfm: true })

const PURIFY_CONFIG = {
  ADD_ATTR: ['target', 'rel'],
  ADD_URI_SAFE_ATTR: ['src', 'href'],
  ALLOW_DATA_ATTR: true,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|ftp|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))|^data:image\/(?:png|jpe?g|gif|webp|svg\+xml|bmp)/i
}

export default function PostDetail({ slug, navigate, authed }) {
  const [post, setPost] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [views, setViews] = useState(0)

  // 评论
  const [comments, setComments] = useState([])
  const [commentAuthor, setCommentAuthor] = useState('')
  const [commentContent, setCommentContent] = useState('')
  const [commentSubmitted, setCommentSubmitted] = useState(false)

  const commentTimerRef = useRef(null)
  const viewedRef = useRef(false)
  const lastSlugRef = useRef(undefined)

  const settings = DataStore.Settings.get()
  const siteTitle = settings.blogName || '我的博客'

  useEffect(() => {
    setNotFound(false)
    setPost(null)

    // Reset the view guard only when the slug actually changes,
    // not on StrictMode's double-invoked effect runs.
    if (lastSlugRef.current !== slug) {
      viewedRef.current = false
      lastSlugRef.current = slug
    }

    const data = DataStore.Posts.getBySlug(slug)
    if (!data) {
      setNotFound(true)
      return
    }
    setPost(data)
    setViews(Number(data.views || 0))
    if (!viewedRef.current) {
      DataStore.Posts.incrementViews(data.id)
      setViews((v) => v + 1)
      viewedRef.current = true
    }
    setComments(DataStore.Comments.getByPostId(data.id))
  }, [slug])

  useEffect(() => {
    return () => {
      if (commentTimerRef.current) {
        clearTimeout(commentTimerRef.current)
      }
    }
  }, [])

  useDocumentMeta({
    title: post?.title || '',
    description: post?.excerpt || '',
    siteTitle
  })
  const toast = useToast()

  const renderedHtml = useMemo(() => {
    if (!post) return ''
    try {
      const raw = post.contentFormat === 'markdown'
        ? marked.parse(post.content || '')
        : post.content || ''
      return DOMPurify.sanitize(raw, PURIFY_CONFIG)
    } catch {
      return '<p class="muted">内容渲染失败。</p>'
    }
  }, [post])

  const onDelete = () => {
    if (!post) return
    if (!window.confirm(`确定删除文章《${post.title}》?此操作不可恢复。`)) return
    try {
      DataStore.Posts.delete(post.id)
      navigate('/')
    } catch (err) {
      toast.error('删除失败: ' + (err.message || err))
    }
  }

  const onSubmitComment = (e) => {
    e.preventDefault()
    if (!commentContent.trim()) return
    try {
      DataStore.Comments.create({
        postId: post.id,
        author: commentAuthor.trim() || '匿名访客',
        content: commentContent.trim()
      })
    } catch (err) {
      toast.error('评论提交失败: ' + (err.message || err))
      return
    }
    setCommentContent('')
    setCommentSubmitted(true)
    // 刷新评论列表 (新评论可能需要审核)
    setComments(DataStore.Comments.getByPostId(post.id))
    if (commentTimerRef.current) {
      clearTimeout(commentTimerRef.current)
    }
    commentTimerRef.current = setTimeout(() => setCommentSubmitted(false), 3000)
  }

  if (notFound) {
    return (
      <div className="post-detail">
        <button className="back-link" onClick={() => navigate('/')}>
          <ArrowLeftIcon size={15} /> 返回列表
        </button>
        <div className="empty-state">
          <p>文章不存在或已被删除。</p>
        </div>
      </div>
    )
  }

  if (!post) return <p className="muted">加载中…</p>

  const statusLabel = post.status === 'draft' ? '草稿' : post.status === 'scheduled' ? '定时发布' : '已发布'

  return (
    <article className="post-detail">
      <button className="back-link" onClick={() => navigate('/')}>
        <ArrowLeftIcon size={15} /> 返回列表
      </button>

      <div className="post-detail-head">
        {post.category && <span className="cat-badge">{post.category}</span>}
        <h1 className="post-title">{post.title}</h1>
        <div className="post-meta">
          <span>发布于 {formatDate(post.createdAt)}</span>
          {post.updatedAt && post.updatedAt !== post.createdAt && (
            <span>更新于 {formatDate(post.updatedAt)}</span>
          )}
          <span className="views-count"><EyeIcon size={14} /> {views}</span>
        </div>
        {post.tags?.length > 0 && (
          <div className="tags post-tags">
            {post.tags.map((t) => (
              <a
                key={t}
                className="tag"
                href="#/"
                onClick={(e) => { e.preventDefault(); navigate(`/?tag=${encodeURIComponent(t)}`) }}
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
            <EditIcon size={15} /> 编辑
          </button>
          <button className="btn btn-danger" onClick={onDelete}>
            <TrashIcon size={15} /> 删除
          </button>
          <span className="post-status-pill">{statusLabel}</span>
        </div>
      )}

      {/* 评论区 */}
      {settings.commentEnabled !== false && (
        <div className="comments-section">
          <h3 className="comments-title">
            <MessageIcon size={18} /> 评论 {comments.length > 0 && `(${comments.length})`}
          </h3>

          {/* 提交评论表单 */}
          <form className="comment-form" onSubmit={onSubmitComment}>
            <input
              type="text"
              className="input"
              placeholder="昵称 (可选)"
              value={commentAuthor}
              onChange={(e) => setCommentAuthor(e.target.value)}
              maxLength={50}
            />
            <textarea
              className="input"
              placeholder="写下你的评论…"
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              rows={3}
              maxLength={2000}
              required
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={!commentContent.trim()}>
              发表评论
            </button>
            {commentSubmitted && (
              <span className="comment-hint">
                {settings.commentNeedReview !== false
                  ? '评论已提交,等待管理员审核后显示。'
                  : '评论已发表。'}
              </span>
            )}
          </form>

          {/* 评论列表 */}
          {comments.length === 0 ? (
            <p className="muted small">还没有评论,来说两句吧。</p>
          ) : (
            <div className="comment-list">
              {comments.map((c) => (
                <div key={c.id} className="comment-item">
                  <div className="comment-head">
                    <span className="comment-author">{c.author}</span>
                    <span className="comment-date">{formatDate(c.createdAt)}</span>
                  </div>
                  <p className="comment-content">{c.content}</p>
                  {c.reply && (
                    <div className="comment-reply">
                      <span className="reply-label">管理员回复:</span>
                      <span>{c.reply}</span>
                      {c.replyAt && <span className="reply-date">{formatDate(c.replyAt)}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  )
}
