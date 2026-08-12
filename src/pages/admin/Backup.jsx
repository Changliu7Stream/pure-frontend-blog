import { useEffect, useRef, useState } from 'react'
import { DataStore } from '../../datastore.js'
import { useDocumentMeta } from '../../useDocumentMeta.js'
import { DownloadIcon, UploadIcon, CheckIcon } from '../../icons.jsx'

function pad2(n) {
  return String(n).padStart(2, '0')
}

function ymd(date) {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`
}

function formatTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export default function Backup({ navigate }) {
  useDocumentMeta({ title: '数据备份', siteTitle: '管理后台' })

  const [summary, setSummary] = useState({ posts: 0, pages: 0, comments: 0, categories: 0 })
  const [preview, setPreview] = useState(null)
  const [importMode, setImportMode] = useState('overwrite')
  const [confirmText, setConfirmText] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const reloadSummary = () => {
    const data = DataStore.Backup.exportAll()
    setSummary({
      posts: (data.posts || []).length,
      pages: (data.pages || []).length,
      comments: (data.comments || []).length,
      categories: (data.categories || []).length
    })
  }

  useEffect(() => {
    reloadSummary()
  }, [])

  const handleExport = () => {
    try {
      const data = DataStore.Backup.exportAll()
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `blog-backup-${ymd(new Date())}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setMessage('数据已成功导出到本地文件。')
      setError('')
    } catch (err) {
      setError('导出失败: ' + (err.message || err))
      setMessage('')
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setMessage('')
    setError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = String((ev.target && ev.target.result) || '')
        const data = JSON.parse(text)
        if (!data || typeof data !== 'object') throw new Error('无效的数据格式')
        if (!data.version) throw new Error('数据缺少版本信息,可能是无效的备份文件')
        setPreview({
          version: data.version,
          exportedAt: data.exportedAt,
          posts: Array.isArray(data.posts) ? data.posts.length : 0,
          pages: Array.isArray(data.pages) ? data.pages.length : 0,
          comments: Array.isArray(data.comments) ? data.comments.length : 0,
          categories: Array.isArray(data.categories) ? data.categories.length : 0,
          hasSettings: !!data.settings,
          raw: data
        })
        setConfirmText('')
      } catch (err) {
        setError('解析备份文件失败: ' + (err.message || err))
        setPreview(null)
      }
    }
    reader.onerror = () => {
      setError('读取文件失败,请重试。')
      setPreview(null)
    }
    reader.readAsText(file)
  }

  const handleImport = () => {
    if (!preview) return
    const overwrite = importMode === 'overwrite'
    try {
      DataStore.Backup.importAll(preview.raw, { overwrite })
      setMessage(overwrite ? '数据已覆盖导入完成。' : '数据已追加导入完成。')
      setError('')
      setPreview(null)
      setConfirmText('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      reloadSummary()
    } catch (err) {
      setError('导入失败: ' + (err.message || err))
      setMessage('')
    }
  }

  const cancelPreview = () => {
    setPreview(null)
    setConfirmText('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const confirmed = confirmText.trim().toLowerCase() === 'confirm'

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div>
          <h2>数据备份与恢复</h2>
          <p className="muted">导出全部数据为 JSON 文件,或从备份文件恢复</p>
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

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">文章</div>
          <div className="stat-num">{summary.posts}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">独立页面</div>
          <div className="stat-num">{summary.pages}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">评论</div>
          <div className="stat-num">{summary.comments}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">分类</div>
          <div className="stat-num">{summary.categories}</div>
        </div>
      </div>

      <div
        className="stat-card"
        style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}
      >
        <div>
          <h3 style={{ margin: '0 0 6px' }}>导出全部数据</h3>
          <p className="muted" style={{ margin: 0 }}>
            将文章、页面、评论、分类与设置打包为 JSON 文件保存到本地。
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleExport}>
          <DownloadIcon size={16} /> 导出备份
        </button>
      </div>

      <div className="stat-card" style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 6px' }}>从备份文件恢复</h3>
        <p className="muted" style={{ margin: '0 0 14px' }}>
          选择之前导出的 JSON 备份文件,预览后将确认导入。
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="input"
          style={{ padding: 8 }}
        />

        {preview && (
          <div style={{ marginTop: 16 }}>
            <div className="alert" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <strong>备份预览</strong>
              <div
                style={{
                  marginTop: 8,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 8
                }}
              >
                <div><span className="muted">版本:</span> v{preview.version}</div>
                <div><span className="muted">导出时间:</span> {formatTime(preview.exportedAt)}</div>
                <div><span className="muted">文章:</span> {preview.posts}</div>
                <div><span className="muted">页面:</span> {preview.pages}</div>
                <div><span className="muted">评论:</span> {preview.comments}</div>
                <div><span className="muted">分类:</span> {preview.categories}</div>
                <div><span className="muted">含设置:</span> {preview.hasSettings ? '是' : '否'}</div>
              </div>
            </div>

            <div
              className="alert alert-error"
              style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}
            >
              <span style={{ fontWeight: 700, flexShrink: 0 }}>警告:</span>
              <span>
                覆盖导入将用备份内容<strong>替换</strong>当前所有数据(不可恢复);
                追加导入仅写入当前不存在的条目。请谨慎操作。
              </span>
            </div>

            <div style={{ marginTop: 14 }}>
              <span className="muted" style={{ fontSize: 13, marginRight: 10 }}>导入模式:</span>
              <div className="segmented">
                <button
                  type="button"
                  className={`seg-btn ${importMode === 'overwrite' ? 'active' : ''}`}
                  onClick={() => setImportMode('overwrite')}
                >
                  覆盖导入
                </button>
                <button
                  type="button"
                  className={`seg-btn ${importMode === 'merge' ? 'active' : ''}`}
                  onClick={() => setImportMode('merge')}
                >
                  追加导入
                </button>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label className="form-label" style={{ maxWidth: 320 }}>
                <span>请输入 <code>confirm</code> 以确认操作</span>
                <input
                  className="input"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="confirm"
                  autoComplete="off"
                />
              </label>
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={handleImport} disabled={!confirmed}>
                <UploadIcon size={16} /> 确认导入
              </button>
              <button className="btn" onClick={cancelPreview}>
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
