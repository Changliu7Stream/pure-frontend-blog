import { useEffect, useRef, useState } from 'react'
import { DataStore } from '../../datastore.js'
import { useDocumentMeta } from '../../useDocumentMeta.js'
import { useToast } from '../../components/Toast.jsx'
import {
  DownloadIcon, UploadIcon, CheckIcon, CloudIcon, RefreshIcon,
  AlertTriangleIcon, ServerIcon, TrashIcon
} from '../../icons.jsx'
import {
  saveWebDAVConfig, getWebDAVConfig, clearWebDAVConfig, hasWebDAVConfig,
  testConnection, uploadFile, listFiles, downloadFile, deleteFile,
  formatFileSize, formatWebDAVDate, generateBackupFilename
} from '../../webdav.js'

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
  useDocumentMeta({ title: '备份恢复', siteTitle: '管理后台' })
  const toast = useToast()

  // ---- 本地数据摘要 ----
  const [summary, setSummary] = useState({ posts: 0, pages: 0, comments: 0, categories: 0 })

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

  // ---- WebDAV 配置 ----
  const [webdavUrl, setWebdavUrl] = useState('')
  const [webdavUser, setWebdavUser] = useState('')
  const [webdavPass, setWebdavPass] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null) // { ok, message }
  const [backing, setBacking] = useState(false)

  // ---- 云端文件列表 ----
  const [cloudFiles, setCloudFiles] = useState([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [cloudError, setCloudError] = useState('')
  const [cloudEmpty, setCloudEmpty] = useState(false)

  // ---- 本地恢复预览 ----
  const [localPreview, setLocalPreview] = useState(null)
  const [localConfirmText, setLocalConfirmText] = useState('')
  const localFileRef = useRef(null)

  // ---- 云端恢复确认 ----
  const [cloudRestoreTarget, setCloudRestoreTarget] = useState(null) // { filename }
  const [cloudConfirmText, setCloudConfirmText] = useState('')

  // ---- 删除确认 ----
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  // ==================== 初始化: 加载已保存的 WebDAV 配置 ====================
  useEffect(() => {
    const config = getWebDAVConfig()
    if (config && config.url) {
      setWebdavUrl(config.url)
      setWebdavUser(config.username)
      setWebdavPass(config.password)
      setConfigSaved(true)
      // 自动加载云端文件列表
      loadCloudFiles(config.url, config.username, config.password)
    }
  }, [])

  // ==================== WebDAV 操作 ====================

  const onTestConnection = async () => {
    if (!webdavUrl.trim() || !webdavUser.trim()) {
      toast.error('请填写服务器地址和用户名')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testConnection(webdavUrl, webdavUser, webdavPass)
      setTestResult(result)
      if (result.ok) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } finally {
      setTesting(false)
    }
  }

  const onSaveConfig = () => {
    if (!webdavUrl.trim() || !webdavUser.trim()) {
      toast.error('请填写服务器地址和用户名')
      return
    }
    saveWebDAVConfig({ url: webdavUrl, username: webdavUser, password: webdavPass })
    setConfigSaved(true)
    toast.success('WebDAV 配置已保存 (密码已加密存储)')
  }

  const onClearConfig = () => {
    if (!window.confirm('确定清除已保存的 WebDAV 配置?')) return
    clearWebDAVConfig()
    setWebdavUrl('')
    setWebdavUser('')
    setWebdavPass('')
    setConfigSaved(false)
    setCloudFiles([])
    setTestResult(null)
    toast.info('已清除 WebDAV 配置')
  }

  const onBackupNow = async () => {
    if (!webdavUrl.trim() || !webdavUser.trim()) {
      toast.error('请先填写并保存 WebDAV 配置')
      return
    }
    setBacking(true)
    try {
      const data = DataStore.Backup.exportAll()
      const payload = {
        meta: {
          version: '1.0',
          time: new Date().toISOString(),
          source: 'pure-frontend-blog'
        },
        data: {
          articles: data.posts || [],
          pages: data.pages || [],
          comments: data.comments || [],
          categories: data.categories || [],
          settings: data.settings || {}
        }
      }
      const filename = generateBackupFilename()
      const content = JSON.stringify(payload, null, 2)
      const result = await uploadFile(webdavUrl, webdavUser, webdavPass, filename, content)
      if (result.ok) {
        toast.success(result.message)
        // 刷新云端列表
        await loadCloudFiles(webdavUrl, webdavUser, webdavPass)
      } else {
        toast.error(result.message)
      }
    } catch (err) {
      toast.error('备份失败: ' + (err.message || err))
    } finally {
      setBacking(false)
    }
  }

  const loadCloudFiles = async (url, user, pass) => {
    const targetUrl = url || webdavUrl
    const targetUser = user || webdavUser
    const targetPass = pass || webdavPass
    if (!targetUrl.trim() || !targetUser.trim()) {
      setCloudError('请先配置 WebDAV')
      setCloudEmpty(false)
      return
    }
    setLoadingFiles(true)
    setCloudError('')
    const result = await listFiles(targetUrl, targetUser, targetPass)
    if (result.ok) {
      setCloudFiles(result.files)
      if (result.files.length === 0) {
        setCloudEmpty(true)
      } else {
        setCloudEmpty(false)
      }
    } else {
      setCloudFiles([])
      setCloudError(result.message)
      setCloudEmpty(false)
    }
    setLoadingFiles(false)
  }

  const onRefreshFiles = () => {
    loadCloudFiles()
  }

  // ---- 本地导出 ----
  const onExportLocal = () => {
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
      toast.success('数据已导出到本地文件')
    } catch (err) {
      toast.error('导出失败: ' + (err.message || err))
    }
  }

  // ---- 本地恢复 ----
  const onLocalFileChange = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = String((ev.target && ev.target.result) || '')
        const data = JSON.parse(text)
        // 兼容两种格式: DataStore 原生格式 (version/exportedAt/posts) 和 WebDAV 格式 (meta/data)
        const isWebDAVFormat = data.meta && data.data
        const normalized = isWebDAVFormat
          ? {
              version: 2,
              exportedAt: new Date(data.meta.time).getTime() || Date.now(),
              posts: data.data.articles || [],
              pages: data.data.pages || [],
              comments: data.data.comments || [],
              categories: data.data.categories || [],
              settings: data.data.settings || {}
            }
          : data

        if (!normalized || typeof normalized !== 'object') throw new Error('无效的数据格式')
        if (!normalized.version) throw new Error('数据缺少版本信息,可能是无效的备份文件')

        setLocalPreview({
          version: normalized.version,
          exportedAt: normalized.exportedAt,
          posts: Array.isArray(normalized.posts) ? normalized.posts.length : 0,
          pages: Array.isArray(normalized.pages) ? normalized.pages.length : 0,
          comments: Array.isArray(normalized.comments) ? normalized.comments.length : 0,
          categories: Array.isArray(normalized.categories) ? normalized.categories.length : 0,
          hasSettings: !!normalized.settings,
          raw: normalized
        })
        setLocalConfirmText('')
      } catch (err) {
        toast.error('解析备份文件失败: ' + (err.message || err))
        setLocalPreview(null)
      }
    }
    reader.onerror = () => {
      toast.error('读取文件失败,请重试')
      setLocalPreview(null)
      if (localFileRef.current) localFileRef.current.value = ''
    }
    reader.readAsText(file)
  }

  const onLocalImport = () => {
    if (!localPreview) return
    try {
      DataStore.Backup.importAll(localPreview.raw, { overwrite: true })
      toast.success('恢复成功,即将刷新页面…')
      setLocalPreview(null)
      setLocalConfirmText('')
      if (localFileRef.current) localFileRef.current.value = ''
      reloadSummary()
      setTimeout(() => window.location.reload(), 1200)
    } catch (err) {
      toast.error('导入失败: ' + (err.message || err))
    }
  }

  const cancelLocalPreview = () => {
    setLocalPreview(null)
    setLocalConfirmText('')
    if (localFileRef.current) localFileRef.current.value = ''
  }

  // ---- 云端恢复 ----
  const onCloudRestoreClick = (filename) => {
    setCloudRestoreTarget({ filename })
    setCloudConfirmText('')
  }

  const onCloudRestoreConfirm = async () => {
    if (!cloudRestoreTarget) return
    const { filename } = cloudRestoreTarget
    const result = await downloadFile(webdavUrl, webdavUser, webdavPass, filename)
    if (!result.ok || !result.content) {
      toast.error(result.message || '下载失败')
      setCloudRestoreTarget(null)
      return
    }
    try {
      let data = JSON.parse(result.content)
      // 兼容 WebDAV 格式
      const isWebDAVFormat = data.meta && data.data
      const normalized = isWebDAVFormat
        ? {
            version: 2,
            exportedAt: new Date(data.meta.time).getTime() || Date.now(),
            posts: data.data.articles || [],
            pages: data.data.pages || [],
            comments: data.data.comments || [],
            categories: data.data.categories || [],
            settings: data.data.settings || {}
          }
        : data

      if (!normalized.version) throw new Error('备份文件格式无效')
      DataStore.Backup.importAll(normalized, { overwrite: true })
      toast.success('恢复成功,即将刷新页面…')
      setCloudRestoreTarget(null)
      reloadSummary()
      setTimeout(() => window.location.reload(), 1200)
    } catch (err) {
      toast.error('解析备份文件失败: ' + (err.message || err))
      setCloudRestoreTarget(null)
    }
  }

  // ---- 云端删除 ----
  const onCloudDeleteClick = (filename) => {
    setDeleteTarget({ filename })
    setDeleteConfirmText('')
  }

  const onCloudDeleteConfirm = async () => {
    if (!deleteTarget) return
    const { filename } = deleteTarget
    const result = await deleteFile(webdavUrl, webdavUser, webdavPass, filename)
    if (result.ok) {
      toast.success(result.message)
      setCloudFiles((prev) => prev.filter((f) => f.filename !== filename))
    } else {
      toast.error(result.message)
    }
    setDeleteTarget(null)
    setDeleteConfirmText('')
  }

  // ==================== 渲染 ====================

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div>
          <h2>备份恢复</h2>
          <p className="muted">本地备份 / WebDAV 云端备份 · 所有数据真实持久化</p>
        </div>
      </div>

      {/* 数据摘要 */}
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

      {/* 两栏布局: 左侧配置 + 右侧云端文件 */}
      <div className="backup-layout">
        {/* ==================== 左栏: 配置与手动操作 ==================== */}
        <div className="backup-left">
          {/* WebDAV 配置 */}
          <div className="backup-section">
            <h3 className="backup-section-title">
              <ServerIcon size={18} /> WebDAV 配置
            </h3>

            <label className="form-label">
              服务器地址 (URL)
              <input
                type="url"
                className="input"
                value={webdavUrl}
                onChange={(e) => { setWebdavUrl(e.target.value); setConfigSaved(false); setTestResult(null) }}
                placeholder="https://dav.jianguoyun.com/dav/"
                autoComplete="off"
              />
            </label>

            <label className="form-label">
              用户名
              <input
                type="text"
                className="input"
                value={webdavUser}
                onChange={(e) => { setWebdavUser(e.target.value); setConfigSaved(false); setTestResult(null) }}
                placeholder="WebDAV 用户名"
                autoComplete="off"
              />
            </label>

            <label className="form-label">
              密码
              <div className="password-row">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  value={webdavPass}
                  onChange={(e) => { setWebdavPass(e.target.value); setConfigSaved(false); setTestResult(null) }}
                  placeholder="WebDAV 密码 / 应用密码"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? '隐藏' : '显示'}
                </button>
              </div>
            </label>

            {testResult && (
              <div
                className="alert"
                style={{
                  background: testResult.ok ? 'var(--ok-soft)' : 'var(--danger-soft)',
                  color: testResult.ok ? 'var(--ok)' : 'var(--danger)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 12
                }}
              >
                {testResult.ok ? <CheckIcon size={16} /> : <AlertTriangleIcon size={16} />}
                <span>{testResult.message}</span>
              </div>
            )}

            <div className="backup-btn-row">
              <button
                className="btn"
                onClick={onTestConnection}
                disabled={testing}
              >
                {testing ? '测试中…' : '测试连接'}
              </button>
              <button
                className="btn btn-primary"
                onClick={onSaveConfig}
                disabled={!webdavUrl.trim() || !webdavUser.trim()}
              >
                <CheckIcon size={15} /> 保存配置
              </button>
              {configSaved && (
                <button className="btn btn-danger" onClick={onClearConfig}>
                  清除配置
                </button>
              )}
            </div>

            {configSaved && (
              <p className="muted small" style={{ marginTop: 8 }}>
                配置已保存,密码已加密存储。下次刷新无需重新输入。
              </p>
            )}
          </div>

          {/* 手动操作 */}
          <div className="backup-section">
            <h3 className="backup-section-title">
              <CloudIcon size={18} /> 手动操作
            </h3>

            <div className="manual-action">
              <div className="manual-action-info">
                <strong>立即备份到云端</strong>
                <p className="muted small">将所有博客数据打包上传到 WebDAV 服务器</p>
              </div>
              <button
                className="btn btn-primary"
                onClick={onBackupNow}
                disabled={backing || !webdavUrl.trim() || !webdavUser.trim()}
              >
                {backing ? '备份中…' : '立即备份'}
              </button>
            </div>

            <div className="manual-action">
              <div className="manual-action-info">
                <strong>导出到本地文件</strong>
                <p className="muted small">下载 JSON 备份文件到本地</p>
              </div>
              <button className="btn" onClick={onExportLocal}>
                <DownloadIcon size={15} /> 导出本地
              </button>
            </div>

            <div className="manual-action">
              <div className="manual-action-info">
                <strong>从本地文件恢复</strong>
                <p className="muted small">选择本地 JSON 备份文件恢复数据 (将覆盖现有数据)</p>
              </div>
              <label className="btn">
                <UploadIcon size={15} /> 选择文件
                <input
                  ref={localFileRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={onLocalFileChange}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* 本地恢复预览 */}
            {localPreview && (
              <div className="restore-preview">
                <div className="restore-preview-head">
                  <AlertTriangleIcon size={18} />
                  <span>备份文件预览</span>
                </div>
                <div className="restore-preview-grid">
                  <div><span className="muted">版本:</span> v{localPreview.version}</div>
                  <div><span className="muted">导出时间:</span> {formatTime(localPreview.exportedAt)}</div>
                  <div><span className="muted">文章:</span> {localPreview.posts}</div>
                  <div><span className="muted">页面:</span> {localPreview.pages}</div>
                  <div><span className="muted">评论:</span> {localPreview.comments}</div>
                  <div><span className="muted">分类:</span> {localPreview.categories}</div>
                  <div><span className="muted">含设置:</span> {localPreview.hasSettings ? '是' : '否'}</div>
                </div>
                <div className="alert alert-error" style={{ marginTop: 12 }}>
                  此操作将<strong>覆盖</strong>当前所有数据,不可恢复。请输入 <code>confirm</code> 确认。
                </div>
                <div className="confirm-row">
                  <input
                    className="input confirm-input"
                    type="text"
                    value={localConfirmText}
                    onChange={(e) => setLocalConfirmText(e.target.value)}
                    placeholder="confirm"
                    autoComplete="off"
                  />
                  <button
                    className="btn btn-primary"
                    onClick={onLocalImport}
                    disabled={localConfirmText.trim().toLowerCase() !== 'confirm'}
                  >
                    <UploadIcon size={15} /> 确认恢复
                  </button>
                  <button className="btn" onClick={cancelLocalPreview}>取消</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ==================== 右栏: 云端备份文件管理 ==================== */}
        <div className="backup-right">
          <div className="backup-section">
            <div className="backup-section-head">
              <h3 className="backup-section-title">
                <CloudIcon size={18} /> 云端备份文件
              </h3>
              <button
                className="btn btn-sm"
                onClick={onRefreshFiles}
                disabled={loadingFiles || !webdavUrl.trim()}
              >
                <RefreshIcon size={14} /> 刷新列表
              </button>
            </div>

            {!webdavUrl.trim() && (
              <div className="empty-state">
                <p>请先配置 WebDAV 服务器地址。</p>
              </div>
            )}

            {webdavUrl.trim() && loadingFiles && (
              <p className="muted">正在加载云端文件列表…</p>
            )}

            {webdavUrl.trim() && !loadingFiles && cloudError && cloudFiles.length === 0 && (
              <div className="alert alert-error">
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <AlertTriangleIcon size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p style={{ margin: '0 0 8px' }}>{cloudError}</p>
                    {cloudError.includes('CORS') && (
                      <p className="muted small" style={{ margin: 0 }}>
                        提示: 需要在 WebDAV 服务器端 (Nginx / 坚果云 / Nextcloud) 开启 CORS 跨域访问,
                        或在应用前端配置代理服务转发请求。
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {cloudFiles.length > 0 && (
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>文件名</th>
                      <th>大小</th>
                      <th>修改时间</th>
                      <th className="col-actions">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cloudFiles.map((file) => (
                      <tr key={file.filename}>
                        <td className="cell-title">{file.filename}</td>
                        <td>{formatFileSize(file.size)}</td>
                        <td>{formatWebDAVDate(file.lastModified)}</td>
                        <td className="col-actions">
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => onCloudRestoreClick(file.filename)}
                          >
                            <UploadIcon size={14} /> 恢复
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => onCloudDeleteClick(file.filename)}
                          >
                            <TrashIcon size={14} /> 删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {webdavUrl.trim() && !loadingFiles && cloudEmpty && (
              <div className="empty-state">
                <p>暂无云端备份文件。</p>
                <p className="muted small">点击"立即备份"将数据上传到 WebDAV 服务器。</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================== 云端恢复确认弹窗 ==================== */}
      {cloudRestoreTarget && (
        <div className="modal-overlay" onClick={() => setCloudRestoreTarget(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>
              <AlertTriangleIcon size={20} /> 确认从云端恢复
            </h3>
            <p>
              即将从云端文件 <strong>{cloudRestoreTarget.filename}</strong> 下载数据并覆盖当前所有博客内容。
            </p>
            <div className="alert alert-error">
              此操作将覆盖当前所有数据 (文章、页面、评论、分类、设置),不可恢复。
            </div>
            <p>请输入 <code>confirm</code> 以确认操作:</p>
            <input
              className="input confirm-input"
              type="text"
              value={cloudConfirmText}
              onChange={(e) => setCloudConfirmText(e.target.value)}
              placeholder="confirm"
              autoComplete="off"
              autoFocus
            />
            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={onCloudRestoreConfirm}
                disabled={cloudConfirmText.trim().toLowerCase() !== 'confirm'}
              >
                确认恢复
              </button>
              <button className="btn" onClick={() => setCloudRestoreTarget(null)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 云端删除确认弹窗 ==================== */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>
              <TrashIcon size={20} /> 确认删除云端文件
            </h3>
            <p>即将删除云端备份文件: <strong>{deleteTarget.filename}</strong></p>
            <p className="muted small">此操作不可恢复,删除后无法找回该备份文件。</p>
            <p>请输入 <code>delete</code> 以确认删除:</p>
            <input
              className="input confirm-input"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="delete"
              autoComplete="off"
              autoFocus
            />
            <div className="modal-actions">
              <button
                className="btn btn-danger"
                onClick={onCloudDeleteConfirm}
                disabled={deleteConfirmText.trim().toLowerCase() !== 'delete'}
              >
                确认删除
              </button>
              <button className="btn" onClick={() => setDeleteTarget(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
