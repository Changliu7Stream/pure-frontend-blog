import { useEffect, useState, useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { DataStore } from '../../datastore.js'
import { useDocumentMeta } from '../../useDocumentMeta.js'
import { formatDate } from '../../utils.js'
import {
  PlusIcon, EditIcon, TrashIcon, SaveIcon, XIcon,
  GlobeIcon, EyeOffIcon
} from '../../icons.jsx'
import { useToast } from '../../components/Toast.jsx'

const EMPTY_FORM = { title: '', content: '', contentFormat: 'html', published: true }

export default function Pages({ navigate }) {
  useDocumentMeta({ title: '页面管理', siteTitle: '管理后台' })
  const toast = useToast()

  const [pages, setPages] = useState([])
  // null = 列表模式; 'new' = 新建; pageId = 编辑该页面
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

  const startEdit = (page) => {
    // 取最新数据,避免列表快照过期
    const latest = DataStore.Pages.getById(page.id) || page
    setForm({
      title: latest.title || '',
      content: latest.content || '',
      contentFormat: latest.contentFormat === 'markdown' ? 'markdown' : 'html',
      published: latest.published !== false
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
        published: form.published
      }
      if (editing === 'new') {
        DataStore.Pages.create(payload)
      } else {
        DataStore.Pages.update(editing, payload)
      }
      reload()
      cancelEdit()
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
    if (!window.confirm(`确定删除页面《${page.title}》?此操作不可恢复。`)) return
    try {
      DataStore.Pages.delete(page.id)
      if (editing === page.id) cancelEdit()
      reload()
    } catch (err) {
      toast.error('删除失败: ' + (err.message || err))
    }
  }

  const mdPreview = useMemo(() => {
    return form.content
      ? DOMPurify.sanitize(marked.parse(form.content))
      : '<p class="muted">在左侧输入 Markdown 内容后,这里会显示预览。</p>'
  }, [form.content])

  return (
    <div className="admin-pages">
      <div className="dashboard-header">
        <div>
          <h2>页面管理</h2>
          <p className="muted">独立页面 (如"关于"、"友链") · 共 {pages.length} 个</p>
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
            <h2>{editing === 'new' ? '新建页面' : '编辑页面'}</h2>
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
                  {pages.map((page) => (
                    <tr key={page.id}>
                      <td className="cell-title">
                        <a
                          href={`#/page/${encodeURIComponent(page.slug)}`}
                          onClick={(e) => {
                            e.preventDefault()
                            navigate(`/page/${encodeURIComponent(page.slug)}`)
                          }}
                        >
                          {page.title}
                        </a>
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
