import { useEffect, useState } from 'react'
import { Editor, Toolbar } from '@wangeditor/editor-for-react'
import { marked } from 'marked'
import { createPost, updatePost, getPostById, getAllCategories } from '../db.js'
import { excerptFromContent } from '../utils.js'
import { useDocumentMeta } from '../useDocumentMeta.js'

// WangEditor 样式 (按需引入，避免 vite 构建时引入 css 报错不同包)
import '@wangeditor/editor/dist/css/style.css'

export default function PostEditor({ navigate, mode, postId }) {
  useDocumentMeta({ title: mode === 'edit' ? '编辑文章' : '写新文章', siteTitle: '管理后台' })

  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [category, setCategory] = useState('未分类')
  const [newCategory, setNewCategory] = useState('')
  const [categories, setCategories] = useState(['未分类'])
  const [excerpt, setExcerpt] = useState('')
  const [autoExcerpt, setAutoExcerpt] = useState(true)
  const [contentFormat, setContentFormat] = useState('html') // 'html' | 'markdown'
  const [published, setPublished] = useState(true)

  // WangEditor html 正文
  const [htmlContent, setHtmlContent] = useState('')
  const [editor, setEditor] = useState(null)

  // Markdown 正文
  const [mdContent, setMdContent] = useState('')

  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 编辑器配置
  const editorConfig = {
    placeholder: '请输入正文内容,支持直接粘贴图片…',
    MENU_CONF: {
      // 粘贴图片转换为 base64 内联 (纯前端无服务器上传)
      uploadImage: {
        customUpload(file, insertFn) {
          const reader = new FileReader()
          reader.onload = (e) => {
            const url = String(e.target?.result || '')
            insertFn(url, file.name || 'image', url)
          }
          reader.onerror = () => console.error('image read error')
          reader.readAsDataURL(file)
        }
      }
    },
    onChange(ed) {
      setHtmlContent(ed.getHtml())
    }
  }

  useEffect(() => {
    setCategories(getAllCategories())
  }, [])

  useEffect(() => {
    if (mode !== 'edit') return
    let active = true
    setLoading(true)
    getPostById(postId)
      .then((p) => {
        if (!active) return
        if (!p) { setError('文章不存在'); return }
        setTitle(p.title)
        setTags((p.tags || []).join(', '))
        setCategory(p.category || '未分类')
        setExcerpt(p.excerpt || '')
        setAutoExcerpt(!p.excerpt)
        setPublished(p.published !== false)
        const fmt = p.contentFormat === 'html' ? 'html' : 'markdown'
        setContentFormat(fmt)
        if (fmt === 'html') setHtmlContent(p.content || '')
        else setMdContent(p.content || '')
      })
      .catch((err) => active && setError(err.message || '加载失败'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [mode, postId])

  // 销毁编辑器
  useEffect(() => {
    return () => { if (editor == null) return; editor.destroy() }
  }, [editor])

  // 切换编辑器模式时先清空对侧状态
  useEffect(() => {
    if (contentFormat === 'html' && editor) {
      editor.setHtml(htmlContent || '')
    }
  }, [contentFormat])

  const addNewCategory = () => {
    const n = newCategory.trim()
    if (!n) return
    if (!categories.includes(n)) {
      const list = [...categories, n]
      setCategories(list)
      // 持久化
      try {
        localStorage.setItem('blog_categories', JSON.stringify(list))
      } catch { /* noop */ }
    }
    setCategory(n)
    setNewCategory('')
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('请填写标题'); return }
    const rawContent = contentFormat === 'html' ? htmlContent : mdContent
    if (!rawContent || (contentFormat === 'html' && htmlContent === '<p><br></p>')) {
      setError('请填写正文内容')
      return
    }
    const tagArr = tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
    const finalExcerpt = autoExcerpt ? excerptFromContent(rawContent) : excerpt.trim()
    setSaving(true)
    try {
      const payload = {
        title,
        content: rawContent,
        contentFormat,
        excerpt: finalExcerpt,
        tags: tagArr,
        category,
        published
      }
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

  const mdPreview = mdContent ? marked.parse(mdContent) : '<p class="muted">在左侧输入 Markdown 内容后,这里会显示预览。</p>'

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

        <div className="row-two">
          <label className="form-label">
            分类
            <div className="select-row">
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="text"
                className="input"
                placeholder="新建分类…"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-sm"
                onClick={addNewCategory}
                disabled={!newCategory.trim()}
              >
                添加
              </button>
            </div>
          </label>

          <label className="form-label">
            标签 (用逗号分隔)
            <input
              type="text"
              className="input"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="例如: 技术, React, 随笔"
            />
          </label>
        </div>

        <div className="row-two">
          <label className="form-label">
            编辑模式
            <div className="segmented">
              <button
                type="button"
                className={`seg-btn ${contentFormat === 'html' ? 'active' : ''}`}
                onClick={() => setContentFormat('html')}
              >
                富文本 (HTML)
              </button>
              <button
                type="button"
                className={`seg-btn ${contentFormat === 'markdown' ? 'active' : ''}`}
                onClick={() => setContentFormat('markdown')}
              >
                Markdown
              </button>
            </div>
          </label>

          <label className="form-label">
            发布状态
            <div className="segmented">
              <button
                type="button"
                className={`seg-btn ${published ? 'active' : ''}`}
                onClick={() => setPublished(true)}
              >
                已发布
              </button>
              <button
                type="button"
                className={`seg-btn ${!published ? 'active' : ''}`}
                onClick={() => setPublished(false)}
              >
                草稿
              </button>
            </div>
          </label>
        </div>

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

        {/* 富文本编辑器 */}
        {contentFormat === 'html' && (
          <div className="richtext-wrap">
            <div className="pane-label">正文 (富文本 · 支持直接粘贴图片)</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
              <Toolbar
                editor={editor}
                defaultConfig={{}}
                mode="default"
                style={{ borderBottom: '1px solid var(--border)' }}
              />
              <Editor
                defaultConfig={editorConfig}
                value={htmlContent}
                onCreated={setEditor}
                onChange={(ed) => setHtmlContent(ed.getHtml())}
                mode="default"
                style={{ height: '420px', overflowY: 'hidden' }}
              />
            </div>
          </div>
        )}

        {/* Markdown 编辑器 */}
        {contentFormat === 'markdown' && (
          <div className="editor-split">
            <div className="editor-pane">
              <label className="pane-label">正文 (Markdown)</label>
              <textarea
                className="editor-textarea"
                value={mdContent}
                onChange={(e) => setMdContent(e.target.value)}
                placeholder={'# 标题\n\n在这里使用 Markdown 编写正文…'}
              />
            </div>
            <div className="editor-pane">
              <label className="pane-label">预览</label>
              <div
                className="markdown-body editor-preview"
                dangerouslySetInnerHTML={{ __html: mdPreview }}
              />
            </div>
          </div>
        )}

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
