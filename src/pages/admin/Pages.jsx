import { useEffect, useState, useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { DataStore } from '../../datastore.js'
import { useDocumentMeta } from '../../useDocumentMeta.js'
import { formatDate } from '../../utils.js'
import {
  PlusIcon, EditIcon, TrashIcon, SaveIcon, XIcon,
  GlobeIcon, EyeOffIcon, ChevronDownIcon
} from '../../icons.jsx'
import { useToast } from '../../components/Toast.jsx'

const EMPTY_FORM = { title: '', content: '', contentFormat: 'html', published: true, parentId: null }

export default function Pages({ navigate }) {
  useDocumentMeta({ title: '页面管理', siteTitle: '管理后台' })
  const toast = useToast()

  const [pages, setPages] = useState([])
  // null = 列表模式; 'new' = 新建; 'newSub' = 新建子页面; pageId = 编辑该页面
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldError, setFieldError] = useState('')
  const [saving, setSaving] = useState(false)

  const reload = () => {
    setPages(DataStore.Pages.getAll())
  }

  useEffect(() => {
    reload()
  }, [])

  const startNew = () => {
    setForm(EMPTY_FORM)
    setEditing('new')
    setFieldError('')
  }

  const startNewSub = (parentPage) => {
    setForm({ ...EMPTY_FORM, parentId: parentPage.id })
    setEditing('newSub')
    setFieldError('')
  }

  const startEdit = (page) => {
    const latest = DataStore.Pages.getById(page.id) || page
    setForm({
      title: latest.title || '',
      content: latest.content || '',
      contentFormat: latest.contentFormat === 'markdown' ? 'markdown' : 'html',
      published: latest.published !== false,
      parentId: latest.parentId || null
    })
    setEditing(latest.id)
    setFieldError('')
  }

  const cancelEdit = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFieldError('')
  }

  const onSave = (e) => {
    e.preventDefault()
    setFieldError('')
    if (!form.title.trim()) { setFieldError('请填写标题'); return }
    if (!form.content.trim()) { setFieldError('请填写页面内容'); return }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content,
        contentFormat: form.contentFormat,
        published: form.published,
        parentId: form.parentId || null
      }
      if (editing === 'new' || editing === 'newSub') {
        DataStore.Pages.create(payload)
      } else {
        DataStore.Pages.update(editing, payload)
      }
      reload()
      cancelEdit()
      toast.success(editing === 'new' ? '页面已创建' : editing === 'newSub' ? '子页面已创建' : '页面已更新')
    } catch (err) {
      toast.error(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const onToggle = (page) => {
    try {
      DataStore.Pages.togglePublished(page.id)
      reload()
    } catch (err) {
      toast.error('状态切换失败: ' + (err.message || err))
    }
  }

  const onDelete = (page) => {
    const children = DataStore.Pages.getAllChildren(page.id)
    const msg = children.length > 0
      ? `确定删除页面《${page.title}》?该页面下有 ${children.length} 个子页面,删除后子页面将提升为顶级页面。此操作不可恢复。`
      : `确定删除页面《${page.title}》?此操作不可恢复。`
    if (!window.confirm(msg)) return
    try {
      DataStore.Pages.delete(page.id)
      if (editing === page.id) cancelEdit()
      reload()
      toast.success('页面已删除')
    } catch (err) {
      toast.error('删除失败: ' + (err.message || err))
    }
  }

  const mdPreview = useMemo(() => {
    return form.content
      ? DOMPurify.sanitize(marked.parse(form.content))
      : '<p class="muted">在左侧输入 Markdown 内容后,这里会显示预览。</p>'
  }, [form.content])

  // 构建分层列表：顶级页面 + 缩进的子页面
  const flatList = useMemo(() => {
    const topLevel = pages.filter((p) => !p.parentId)
    const result = []
    for (const parent of topLevel) {
      result.push({ ...parent, _level: 0 })
      const children = pages.filter((c) => c.parentId === parent.id)
      for (const child of children) {
        result.push({ ...child, _level: 1 })
      }
    }
    // 孤儿页面 (parentId 指向不存在的页面)
    const knownIds = pages.map((p) => p.id)
    const orphans = pages.filter((p) => p.parentId && !knownIds.includes(p.parentId))
    for (const orphan of orphans) {
      result.push({ ...orphan, _level: 0 })
    }
    return result
  }, [pages])

  // 可选的父页面列表 (排除自身和自己的子页面)
  const parentOptions = useMemo(() => {
    if (editing === null || editing === 'new') return pages.filter((p) => !p.parentId)
    const childIds = new Set()
    const collectChildren = (pid) => {
      pages.filter((p) => p.parentId === pid).forEach((c) => {
        childIds.add(c.id)
        collectChildren(c.id)
      })
    }
    collectChildren(Number(editing))
    return pages.filter((p) => !p.parentId && p.id !== Number(editing) && !childIds.has(p.id))
  }, [pages, editing])

  return (
    <div className="admin-pages">
      <div className="dashboard-header">
        <div>
          <h2>页面管理</h2>
          <p className="muted">独立页面 (如"关于"、"友链") · 支持子页面 · 共 {pages.length} 个</p>
        </div>
        {editing === null && (
          <button className="btn btn-primary" onClick={startNew}>
            <PlusIcon size={16} /> 新建页面
          </button>
        )}
      </div>

      {editing !== null && (
        <form className="editor-form" onSubmit={onSave}>
          <div className="editor-header">
            <h2>
              {editing === 'new' ? '新建页面' : editing === 'newSub' ? '新建子页面' : '编辑页面'}
            </h2>
          </div>

          <label className="form-label">
            标题
            <input
              type="text"
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="例如:关于、友链"
              required
            />
          </label>

          <div className="row-two">
            <label className="form-label">
              内容格式
              <div className="segmented">
                <button
                  type="button"
                  className={`seg-btn ${form.contentFormat === 'html' ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, contentFormat: 'html' })}
                >
                  HTML
                </button>
                <button
                  type="button"
                  className={`seg-btn ${form.contentFormat === 'markdown' ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, contentFormat: 'markdown' })}
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
                  className={`seg-btn ${form.published ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, published: true })}
                >
                  上线
                </button>
                <button
                  type="button"
                  className={`seg-btn ${!form.published ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, published: false })}
                >
                  下线
                </button>
              </div>
            </label>
          </div>

          <label className="form-label">
            父级页面
            <select
              className="input"
              value={form.parentId || ''}
              onChange={(e) => setForm({ ...form, parentId: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">— 顶级页面 (无父级) —</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </label>

          {form.contentFormat === 'html' ? (
            <div className="editor-pane">
              <label className="pane-label">正文 (HTML)</label>
              <textarea
                className="editor-textarea"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder={'<p>在这里编写页面 HTML 内容…</p>'}
              />
            </div>
          ) : (
            <div className="editor-split">
              <div className="editor-pane">
                <label className="pane-label">正文 (Markdown)</label>
                <textarea
                  className="editor-textarea"
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder={'# 标题\n\n在这里使用 Markdown 编写页面内容…'}
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
              <SaveIcon size={16} /> {saving ? '保存中…' : '保存'}
            </button>
            <button type="button" className="btn" onClick={cancelEdit} disabled={saving}>
              <XIcon size={16} /> 取消
            </button>
          </div>
        </form>
      )}

      {editing === null && (
        <>
          {pages.length === 0 ? (
            <div className="empty-state">
              <p>还没有独立页面。</p>
              <button className="btn btn-primary" onClick={startNew}>
                <PlusIcon size={16} /> 创建第一个页面
              </button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>标题</th>
                    <th>slug</th>
                    <th>状态</th>
                    <th>更新时间</th>
                    <th className="col-actions">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {flatList.map((page) => (
                    <tr key={page.id} className={page._level === 1 ? 'sub-page-row' : ''}>
                      <td className="cell-title">
                        <span className="page-tree-indent" style={{ paddingLeft: page._level * 24 }}>
                          {page._level === 1 && <span className="sub-page-arrow">└</span>}
                          <a
                            href={`#/page/${encodeURIComponent(page.slug)}`}
                            onClick={(e) => {
                              e.preventDefault()
                              navigate(`/page/${encodeURIComponent(page.slug)}`)
                            }}
                          >
                            {page.title}
                          </a>
                        </span>
                      </td>
                      <td className="muted small">/{page.slug}</td>
                      <td>
                        <button
                          type="button"
                          className={`status-pill ${page.published ? 'published' : 'draft'}`}
                          onClick={() => onToggle(page)}
                          title="点击切换上/下线"
                        >
                          {page.published
                            ? (<><GlobeIcon size={13} /> 在线</>)
                            : (<><EyeOffIcon size={13} /> 下线</>)}
                        </button>
                      </td>
                      <td>{formatDate(page.updatedAt)}</td>
                      <td className="col-actions">
                        <button className="btn btn-sm" onClick={() => startNewSub(page)} title="创建子页面">
                          <PlusIcon size={14} /> 子页面
                        </button>
                        <button className="btn btn-sm" onClick={() => startEdit(page)}>
                          <EditIcon size={14} /> 编辑
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => onDelete(page)}>
                          <TrashIcon size={14} /> 删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
