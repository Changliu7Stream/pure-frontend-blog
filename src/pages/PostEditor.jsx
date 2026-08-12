import { useEffect, useState } from 'react'
import { marked } from 'marked'
import { createPost, updatePost, getPostById } from '../db.js'
import { excerptFromContent } from '../utils.js'

export default function PostEditor({ navigate, mode, postId }) {
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('') // 逗号分隔
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [autoExcerpt, setAutoExcerpt] = useState(true)
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (mode !== 'edit') return
    let active = true
    setLoading(true)
    getPostById(postId)
      .then((p) => {
        if (!active) return
        if (!p) {
          setError('文章不存在')
          return
        }
        setTitle(p.title)
        setTags((p.tags || []).join(', '))
        setExcerpt(p.excerpt || '')
        setContent(p.content || '')
        setAutoExcerpt(!p.excerpt)
      })
      .catch((err) => active && setError(err.message || '加载失败'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [mode, postId])

  const preview = content ? marked.parse(content) : '<p class="muted">在左侧输入 Markdown 内容后,这里会显示预览。</p>'

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!title.trim()) {
      setError('请填写标题')
      return
    }
    if (!content.trim()) {
      setError('请填写正文内容')
      return
    }
    const tagArr = tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
    const finalExcerpt = autoExcerpt ? excerptFromContent(content) : excerpt.trim()
    setSaving(true)
    try {
      const payload = { title, content, excerpt: finalExcerpt, tags: tagArr }
      if (mode === 'edit') {
        await updatePost(postId, payload)
      } else {
        await createPost(payload)
      }
      navigate('/admin')
    } catch (err) {
      setError(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="muted">加载中…</p>

  return (
    <div className="post-editor">
      <div className="editor-header">
        <h2>{mode === 'edit' ? '编辑文章' : '写新文章'}</h2>
        <button className="btn btn-link" onClick={() => navigate('/admin')}>← 返回后台</button>
      </div>

      <form onSubmit={onSubmit} className="editor-form">
        <label className="form-label">
          标题
          <input
            type="text"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="请输入文章标题"
            required
          />
        </label>

        <label className="form-label">
          标签 (用逗号分隔,可选)
          <input
            type="text"
            className="input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="例如: 技术, React, 随笔"
          />
        </label>

        <div className="excerpt-row">
          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={autoExcerpt}
              onChange={(e) => setAutoExcerpt(e.target.checked)}
            />
            自动生成摘要
          </label>
          {!autoExcerpt && (
            <label className="form-label excerpt-input">
              自定义摘要
              <textarea
                className="input"
                rows={2}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="一句话简介…"
              />
            </label>
          )}
        </div>

        <div className="editor-split">
          <div className="editor-pane">
            <label className="pane-label">正文 (Markdown)</label>
            <textarea
              className="editor-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={'# 标题\n\n在这里使用 Markdown 编写正文…'}
              required
            />
          </div>
          <div className="editor-pane">
            <label className="pane-label">预览</label>
            <div
              className="markdown-body editor-preview"
              dangerouslySetInnerHTML={{ __html: preview }}
            />
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="editor-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? '保存中…' : mode === 'edit' ? '保存修改' : '发布文章'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => navigate('/admin')}
            disabled={saving}
          >
            取消
          </button>
        </div>
      </form>
    </div>
  )
}
