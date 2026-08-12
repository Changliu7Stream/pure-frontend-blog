import { useEffect, useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { DataStore } from '../datastore.js'
import { useDocumentMeta } from '../useDocumentMeta.js'
import { ArrowLeftIcon } from '../icons.jsx'

marked.setOptions({ breaks: true, gfm: true })

const PURIFY_CONFIG = {
  ADD_ATTR: ['target', 'rel'],
  ADD_URI_SAFE_ATTR: ['src', 'href'],
  ALLOW_DATA_ATTR: true,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|ftp|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))|^data:image\/(?:png|jpe?g|gif|webp|svg\+xml|bmp)/i
}

export default function PageView({ slug, navigate }) {
  const [page, setPage] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const data = DataStore.Pages.getBySlug(slug)
    setPage(data)
    setNotFound(!data)
  }, [slug])

  const siteTitle = DataStore.Settings.get().blogName || '我的博客'
  useDocumentMeta({
    title: page?.title || '页面未找到',
    description: page?.title ? `${page.title} - ${siteTitle}` : '',
    siteTitle
  })

  const renderedHtml = useMemo(() => {
    if (!page) return ''
    try {
      const raw = page.contentFormat === 'markdown'
        ? marked.parse(page.content || '')
        : page.content || ''
      return DOMPurify.sanitize(raw, PURIFY_CONFIG)
    } catch {
      return '<p class="muted">内容渲染失败。</p>'
    }
  }, [page])

  if (notFound || (page && !page.published)) {
    return (
      <div className="post-detail">
        <button className="back-link" onClick={() => navigate('/')}>
          <ArrowLeftIcon size={15} /> 返回首页
        </button>
        <div className="empty-state">
          <h2>页面不存在或已下线</h2>
          <p className="muted">该页面可能已被删除或设为下线状态。</p>
        </div>
      </div>
    )
  }

  if (!page) return <p className="muted">加载中…</p>

  return (
    <article className="post-detail">
      <button className="back-link" onClick={() => navigate('/')}>
        <ArrowLeftIcon size={15} /> 返回首页
      </button>
      <h1 className="post-title">{page.title}</h1>
      <div
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </article>
  )
}
