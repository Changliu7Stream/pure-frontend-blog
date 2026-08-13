import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Editor, Toolbar } from '@wangeditor/editor-for-react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { DataStore } from '../datastore.js'
import { excerptFromContent } from '../utils.js'
import { useDocumentMeta } from '../useDocumentMeta.js'
import { ArrowLeftIcon, SaveIcon, ClockIcon } from '../icons.jsx'
import { useToast } from '../components/Toast.jsx'

import '@wangeditor/editor/dist/css/style.css'

const DRAFT_KEY = 'post_editor_draft'
const AUTOSAVE_INTERVAL = 5000 // 5 秒自动保存草稿

export default function PostEditor({ navigate, mode, postId }) {
  useDocumentMeta({ title: mode === 'edit' ? '编辑文章' : '写新文章', siteTitle: '管理后台' })
  const toast = useToast()

  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [category, setCategory] = useState('未分类')
  const [newCategory, setNewCategory] = useState('')
  const [categories, setCategories] = useState(['未分类'])
  const [excerpt, setExcerpt] = useState('')
  const [autoExcerpt, setAutoExcerpt] = useState(true)
  const [contentFormat, setContentFormat] = useState('html')
  const [status, setStatus] = useState('published') // published | draft | scheduled
  const [scheduledAt, setScheduledAt] = useState('')

  const [htmlContent, setHtmlContent] = useState('')
  const [editor, setEditor] = useState(null)
  const [mdContent, setMdContent] = useState('')

  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [fieldError, setFieldError] = useState('')
  const [autoSavedAt, setAutoSavedAt] = useState(null)
  const [draftRestored, setDraftRestored] = useState(false)

  const draftTimer = useRef(null)

  const editorConfig = {
    placeholder: '请输入正文内容,支持直接粘贴图片…',
    MENU_CONF: {
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

  // 加载分类列表
  useEffect(() => {
    setCategories(DataStore.Categories.getAll())
  }, [])

  // 编辑模式: 加载已有文章
  useEffect(() => {
    if (mode !== 'edit') {
      // 新建模式: 检查是否有未恢复的草稿
      const draft = DataStore.Drafts.get(DRAFT_KEY)
      if (draft && !draftRestored) {
        if (window.confirm('检测到未保存的草稿,是否恢复?')) {
          setTitle(draft.title || '')
          setTags(draft.tags || '')
          setCategory(draft.category || '未分类')
          setExcerpt(draft.excerpt || '')
          setAutoExcerpt(!draft.excerpt)
          setContentFormat(draft.contentFormat || 'html')
          setStatus(draft.status || 'published')
          setScheduledAt(draft.scheduledAt ? toDateTimeLocal(draft.scheduledAt) : '')
          if (draft.contentFormat === 'html') setHtmlContent(draft.content || '')
          else setMdContent(draft.content || '')
        } else {
          DataStore.Drafts.delete(DRAFT_KEY)
        }
        setDraftRestored(true)
      }
      return
    }
    setLoading(true)
    const p = DataStore.Posts.getById(postId)
    if (!p) {
      toast.error('文章不存在')
      setLoading(false)
      return
    }
    setTitle(p.title)
    setTags((p.tags || []).join(', '))
    setCategory(p.category || '未分类')
    setExcerpt(p.excerpt || '')
    setAutoExcerpt(!p.excerpt)
    setStatus(p.status || 'published')
    setScheduledAt(p.scheduledAt ? toDateTimeLocal(p.scheduledAt) : '')
    const fmt = p.contentFormat === 'html' ? 'html' : 'markdown'
    setContentFormat(fmt)
    if (fmt === 'html') setHtmlContent(p.content || '')
    else setMdContent(p.content || '')
    setLoading(false)
  }, [mode, postId])

  // 销毁编辑器
  useEffect(() => {
    return () => { if (editor) editor.destroy() }
  }, [editor])

  // 切换编辑器模式时同步内容
  useEffect(() => {
    if (contentFormat === 'html' && editor) {
      editor.setHtml(htmlContent || '')
    }
  }, [contentFormat])

  // 自动保存草稿
  const saveDraft = useCallback(() => {
    if (mode === 'edit') return
    if (saving || loading) return
    const rawContent = contentFormat === 'html' ? htmlContent : mdContent
    if (!title.trim() && !rawContent) return
    DataStore.Drafts.save(DRAFT_KEY, {
      title, tags, category, excerpt, autoExcerpt,
      contentFormat, status, scheduledAt: scheduledAt ? new Date(scheduledAt).getTime() : null,
      content: rawContent,
      mode, postId
    })
    setAutoSavedAt(Date.now())
  }, [title, tags, category, excerpt, autoExcerpt, contentFormat, status, scheduledAt, htmlContent, mdContent, mode, postId, saving, loading])

  useEffect(() => {
    if (draftTimer.current) clearInterval(draftTimer.current)
    draftTimer.current = setInterval(saveDraft, AUTOSAVE_INTERVAL)
    return () => { if (draftTimer.current) clearInterval(draftTimer.current) }
  }, [saveDraft])

  const addNewCategory = () => {
    const n = newCategory.trim()
    if (!n) return
    try {
      DataStore.Categories.add(n)
      setCategories(DataStore.Categories.getAll())
      setCategory(n)
      setNewCategory('')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setFieldError('')
    if (!title.trim()) { setFieldError('请填写标题'); return }
    const rawContent = contentFormat === 'html' ? htmlContent : mdContent
    if (!rawContent || (contentFormat === 'html' && htmlContent === '<p><br></p>')) {
      setFieldError('请填写正文内容')
      return
    }
    const tagArr = tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
    const finalExcerpt = autoExcerpt ? excerptFromContent(rawContent) : excerpt.trim()

    // 定时发布验证
    let finalStatus = status
    let finalScheduledAt = null
    if (status === 'scheduled') {
      if (!scheduledAt) { setFieldError('请选择定时发布时间'); return }
      finalScheduledAt = new Date(scheduledAt).getTime()
      if (scheduledAt && Number.isNaN(finalScheduledAt)) {
        toast.error('定时发布时间格式无效')
        return
      }
      if (finalScheduledAt <= Date.now()) {
        setFieldError('定时发布时间必须晚于当前时间')
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        title,
        content: rawContent,
        contentFormat,
        excerpt: finalExcerpt,
        tags: tagArr,
        category,
        status: finalStatus,
        scheduledAt: finalScheduledAt
      }
      if (mode === 'edit') {
        DataStore.Posts.update(postId, payload)
      } else {
        DataStore.Posts.create(payload)
        DataStore.Drafts.delete(DRAFT_KEY) // 发布后清除草稿
      }
      navigate('/admin/posts')
    } catch (err) {
      toast.error(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const mdPreview = useMemo(() => mdContent ? DOMPurify.sanitize(marked.parse(mdContent)) : '<p class="muted">在左侧输入 Markdown 内容后,这里会显示预览。</p>', [mdContent])

  if (loading) return <p className="muted">加载中…</p>

  return (
    <div className="post-editor">
      <div className="editor-header">
        <h2>{mode === 'edit' ? '编辑文章' : '写新文章'}</h2>
        <div className="editor-header-right">
          {autoSavedAt && (
            <span className="autosave-hint">
              <SaveIcon size={13} /> 草稿已自动保存 {formatTime(autoSavedAt)}
            </span>
          )}
          <button className="btn btn-link" onClick={() => navigate('/admin/posts')}>
            <ArrowLeftIcon size={15} /> 返回列表
          </button>
        </div>
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
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewCategory() } }}
              />
              <button type="button" className="btn btn-sm" onClick={addNewCategory} disabled={!newCategory.trim()}>
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
              <button type="button" className={`seg-btn ${contentFormat === 'html' ? 'active' : ''}`} onClick={() => setContentFormat('html')}>
                富文本 (HTML)
              </button>
              <button type="button" className={`seg-btn ${contentFormat === 'markdown' ? 'active' : ''}`} onClick={() => setContentFormat('markdown')}>
                Markdown
              </button>
            </div>
          </label>

          <label className="form-label">
            发布状态
            <div className="segmented">
              <button type="button" className={`seg-btn ${status === 'published' ? 'active' : ''}`} onClick={() => setStatus('published')}>
                已发布
              </button>
              <button type="button" className={`seg-btn ${status === 'draft' ? 'active' : ''}`} onClick={() => setStatus('draft')}>
                草稿
              </button>
              <button type="button" className={`seg-btn ${status === 'scheduled' ? 'active' : ''}`} onClick={() => setStatus('scheduled')}>
                <ClockIcon size={13} /> 定时
              </button>
            </div>
          </label>
        </div>

        {status === 'scheduled' && (
          <label className="form-label">
            定时发布时间
            <input
              type="datetime-local"
              className="input"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
            />
          </label>
        )}

        <div className="excerpt-row">
          <label className="form-checkbox">
            <input type="checkbox" checked={autoExcerpt} onChange={(e) => setAutoExcerpt(e.target.checked)} />
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

        {fieldError && <div className="alert alert-error">{fieldError}</div>}

        <div className="editor-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <SaveIcon size={15} /> {saving ? '保存中…' : mode === 'edit' ? '保存修改' : '发布文章'}
          </button>
          <button type="button" className="btn" onClick={() => navigate('/admin/posts')} disabled={saving}>
            取消
          </button>
        </div>
      </form>
    </div>
  )
}

// 工具: 时间戳转 datetime-local 输入值
function toDateTimeLocal(ts) {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 工具: 格式化自动保存时间
function formatTime(ts) {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
