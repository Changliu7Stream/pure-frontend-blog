import { useEffect, useState } from 'react'
import { DataStore } from '../../datastore.js'
import { useDocumentMeta } from '../../useDocumentMeta.js'
import { SaveIcon, CheckIcon } from '../../icons.jsx'

const EMPTY_FORM = {
  blogName: '',
  subtitle: '',
  logo: '',
  footer: '',
  commentEnabled: false,
  commentNeedReview: false
}

export default function Settings({ navigate }) {
  useDocumentMeta({ title: '系统设置', siteTitle: '管理后台' })

  const [form, setForm] = useState(EMPTY_FORM)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(DataStore.Settings.get())
  }, [])

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const handleSave = (e) => {
    if (e) e.preventDefault()
    try {
      const next = DataStore.Settings.update({
        blogName: (form.blogName || '').trim(),
        subtitle: (form.subtitle || '').trim(),
        logo: (form.logo || '').trim(),
        footer: form.footer || '',
        commentEnabled: !!form.commentEnabled,
        commentNeedReview: form.commentEnabled ? !!form.commentNeedReview : false
      })
      setForm(next)
      setMessage('设置已保存。')
      setError('')
    } catch (err) {
      setError('保存失败: ' + (err.message || err))
      setMessage('')
    }
  }

  const handleReset = () => {
    if (!window.confirm('确定要将所有设置重置为默认值吗?此操作不可恢复。')) return
    try {
      const defaults = DataStore.Settings.reset()
      setForm(defaults)
      setMessage('设置已重置为默认值。')
      setError('')
    } catch (err) {
      setError('重置失败: ' + (err.message || err))
      setMessage('')
    }
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div>
          <h2>系统设置</h2>
          <p className="muted">配置博客基本信息与评论规则,保存后立即生效</p>
        </div>
      </div>

      {message && (
        <div
          className="alert"
          style={{ background: 'var(--ok-soft)', color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <CheckIcon size={16} />
          <span>{message}</span>
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
        <label className="form-label">
          <span>博客名称</span>
          <input
            className="input"
            type="text"
            value={form.blogName}
            onChange={(e) => update('blogName', e.target.value)}
            placeholder="我的博客"
          />
        </label>

        <label className="form-label">
          <span>副标题</span>
          <input
            className="input"
            type="text"
            value={form.subtitle}
            onChange={(e) => update('subtitle', e.target.value)}
            placeholder="一句话描述你的博客"
          />
        </label>

        <label className="form-label">
          <span>
            Logo URL <span className="muted">(可选,留空则显示文字 Logo)</span>
          </span>
          <input
            className="input"
            type="text"
            value={form.logo}
            onChange={(e) => update('logo', e.target.value)}
            placeholder="https://example.com/logo.png"
          />
        </label>

        <label className="form-label">
          <span>页脚文字</span>
          <textarea
            className="input"
            rows={3}
            value={form.footer}
            onChange={(e) => update('footer', e.target.value)}
            placeholder="版权信息或备案号"
          />
        </label>

        <label className="form-checkbox">
          <input
            type="checkbox"
            checked={!!form.commentEnabled}
            onChange={(e) => update('commentEnabled', e.target.checked)}
          />
          <span>启用评论功能</span>
        </label>

        {form.commentEnabled && (
          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={!!form.commentNeedReview}
              onChange={(e) => update('commentNeedReview', e.target.checked)}
            />
            <span>评论需要审核后才显示</span>
          </label>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="submit" className="btn btn-primary">
            <SaveIcon size={16} /> 保存设置
          </button>
          <button type="button" className="btn btn-danger" onClick={handleReset}>
            重置为默认
          </button>
        </div>
      </form>
    </div>
  )
}
