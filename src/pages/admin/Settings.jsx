import { useEffect, useMemo, useRef, useState } from 'react'
import { DataStore } from '../../datastore.js'
import { useDocumentMeta } from '../../useDocumentMeta.js'
import { useTheme } from '../../theme.jsx'
import { SaveIcon, CheckIcon, TrashIcon, UploadIcon, PaintIcon, ImageIcon } from '../../icons.jsx'

const THEME_PRESETS = [
  { name: '星空蓝', primary: '#3B82F6', accent: '#6366F1' },
  { name: '翠叶绿', primary: '#10B981', accent: '#06B6D4' },
  { name: '落日橙', primary: '#F59E0B', accent: '#EF4444' },
  { name: '浪漫粉', primary: '#EC4899', accent: '#F472B6' },
  { name: '暗夜紫', primary: '#8B5CF6', accent: '#A855F7' },
  { name: '热情红', primary: '#EF4444', accent: '#F97316' },
  { name: '海洋青', primary: '#06B6D4', accent: '#3B82F6' },
  { name: '岩石灰', primary: '#64748B', accent: '#475569' }
]

const DEFAULT_COLORS = { primary: '#3B82F6', accent: '#6366F1' }

const EMPTY_FORM = {
  blogName: '',
  subtitle: '',
  logo: '',
  logoData: '',
  footer: '',
  commentEnabled: false,
  commentNeedReview: false,
  themeColors: { primary: '#3B82F6', accent: '#6366F1' }
}

// logo 图片最大允许宽度 (超过则压缩到该宽度,节省 localStorage 空间)
const LOGO_MAX_SIZE = 256

/**
 * 将上传的图片文件压缩为 1:1 正方形 logo,返回 base64 Data URL
 * 读取 → 绘制到 Canvas (裁剪为正方形 + 限制最大尺寸) → 导出为 PNG
 */
function processLogoFile(file, maxSize = LOGO_MAX_SIZE) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('未选择文件'))
    if (!/^image\//.test(file.type)) return reject(new Error('请选择图片文件'))

    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        // 裁剪为正方形(从中心)
        const size = Math.min(img.width, img.height)
        const sx = (img.width - size) / 2
        const sy = (img.height - size) / 2
        const outSize = Math.min(size, maxSize)

        const canvas = document.createElement('canvas')
        canvas.width = outSize
        canvas.height = outSize
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, sx, sy, size, size, 0, 0, outSize, outSize)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => reject(new Error('图片解析失败'))
      img.src = String(ev.target.result)
    }
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

export default function Settings({ navigate }) {
  useDocumentMeta({ title: '系统设置', siteTitle: '管理后台' })
  const { applyThemeColors } = useTheme()

  const [form, setForm] = useState(EMPTY_FORM)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const logoInputRef = useRef(null)
  const [logoUploading, setLogoUploading] = useState(false)

  useEffect(() => {
    const data = DataStore.Settings.get()
    setForm({ ...EMPTY_FORM, ...data })
    // 读取即应用当前主题色 (确保一致性)
    if (data.themeColors) applyThemeColors(data.themeColors)
  }, [applyThemeColors])

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const updateThemeColor = (key, value) => {
    const next = { ...form.themeColors, [key]: value }
    update('themeColors', next)
    // 实时预览: 直接应用到 CSS 变量
    applyThemeColors(next)
  }

  const applyPreset = (preset) => {
    const next = { primary: preset.primary, accent: preset.accent }
    update('themeColors', next)
    applyThemeColors(next)
  }

  const resetThemeColors = () => {
    update('themeColors', { ...DEFAULT_COLORS })
    applyThemeColors(DEFAULT_COLORS)
  }

  const onLogoFileChange = async (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setLogoUploading(true)
    setError('')
    try {
      const base64 = await processLogoFile(file)
      update('logoData', base64)
      update('logo', '')
    } catch (err) {
      setError('Logo 处理失败: ' + (err.message || err))
    } finally {
      setLogoUploading(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const clearLogo = () => {
    if (!window.confirm('确定移除当前 Logo?')) return
    update('logoData', '')
    update('logo', '')
  }

  const logoSrc = useMemo(() => form.logoData || form.logo || '', [form.logoData, form.logo])

  const handleSave = (e) => {
    if (e) e.preventDefault()
    try {
      const themeColors = {
        primary: form.themeColors?.primary || DEFAULT_COLORS.primary,
        accent: form.themeColors?.accent || DEFAULT_COLORS.accent
      }
      const next = DataStore.Settings.update({
        blogName: (form.blogName || '').trim(),
        subtitle: (form.subtitle || '').trim(),
        logo: (form.logo || '').trim(),
        logoData: form.logoData || '',
        footer: form.footer || '',
        commentEnabled: !!form.commentEnabled,
        commentNeedReview: form.commentEnabled ? !!form.commentNeedReview : false,
        themeColors
      })
      setForm((f) => ({ ...f, ...next }))
      applyThemeColors(next.themeColors)
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
      setForm({ ...EMPTY_FORM, ...defaults })
      applyThemeColors(defaults.themeColors || DEFAULT_COLORS)
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
          <p className="muted">配置博客基本信息、Logo、主题风格,保存后立即生效</p>
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

      <form onSubmit={handleSave} className="settings-form">
        {/* ============ 站点信息卡片 ============ */}
        <section className="settings-card">
          <h3 className="settings-card-title">站点信息</h3>
          <div className="settings-grid">
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
            <label className="form-label col-span-2">
              <span>页脚文字</span>
              <textarea
                className="input"
                rows={3}
                value={form.footer}
                onChange={(e) => update('footer', e.target.value)}
                placeholder="版权信息或备案号"
              />
            </label>
          </div>
        </section>

        {/* ============ 站点 Logo 卡片 ============ */}
        <section className="settings-card">
          <h3 className="settings-card-title"><ImageIcon size={18} /> 站点 Logo</h3>
          <div className="logo-uploader">
            <div className="logo-preview">
              {logoSrc ? (
                <img src={logoSrc} alt="Logo 预览" className="logo-preview-img" />
              ) : (
                <div className="logo-preview-empty">
                  <ImageIcon size={36} />
                  <span className="muted small">未设置 Logo</span>
                </div>
              )}
            </div>
            <div className="logo-actions">
              <p className="muted small" style={{ marginTop: 0 }}>
                支持上传任意图片,将自动裁剪为 1:1 正方形 (最大 {LOGO_MAX_SIZE}×{LOGO_MAX_SIZE},PNG 压缩)。
                上传后直接作为导航栏站点标识。
              </p>
              <div className="btn-row">
                <label className="btn">
                  <UploadIcon size={15} />
                  {logoUploading ? '处理中…' : '上传 Logo 图片'}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onLogoFileChange}
                    disabled={logoUploading}
                    style={{ display: 'none' }}
                  />
                </label>
                {logoSrc && (
                  <button type="button" className="btn btn-danger" onClick={clearLogo}>
                    <TrashIcon size={15} /> 移除 Logo
                  </button>
                )}
              </div>
              <label className="form-label" style={{ marginTop: 16 }}>
                <span>Logo URL (可选,优先级低于上传的图片)</span>
                <input
                  className="input"
                  type="url"
                  value={form.logo}
                  onChange={(e) => update('logo', e.target.value)}
                  placeholder="https://example.com/logo.svg"
                />
              </label>
            </div>
          </div>
        </section>

        {/* ============ 主题风格卡片 ============ */}
        <section className="settings-card">
          <h3 className="settings-card-title"><PaintIcon size={18} /> 主题风格 (自定义 UI 颜色)</h3>
          <p className="muted small">
            修改主色调会实时预览并应用到按钮、导航高亮、Hero 渐变等全局位置。滑动选择预设或手动调色。
          </p>

          <div className="theme-presets">
            {THEME_PRESETS.map((p) => {
              const active = form.themeColors?.primary === p.primary
              return (
                <button
                  key={p.name}
                  type="button"
                  className={`theme-preset ${active ? 'active' : ''}`}
                  onClick={() => applyPreset(p)}
                  title={p.name}
                >
                  <span
                    className="theme-preset-swatch"
                    style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.accent})` }}
                  />
                  <span className="theme-preset-name">{p.name}</span>
                </button>
              )
            })}
          </div>

          <div className="theme-pickers">
            <label className="form-label">
              <span>主色调 (Primary)</span>
              <div className="color-picker-row">
                <input
                  type="color"
                  className="color-input"
                  value={form.themeColors?.primary || DEFAULT_COLORS.primary}
                  onChange={(e) => updateThemeColor('primary', e.target.value)}
                />
                <input
                  type="text"
                  className="input color-hex"
                  value={form.themeColors?.primary || DEFAULT_COLORS.primary}
                  onChange={(e) => updateThemeColor('primary', e.target.value)}
                  maxLength={7}
                />
              </div>
            </label>

            <label className="form-label">
              <span>辅助色 (Accent)</span>
              <div className="color-picker-row">
                <input
                  type="color"
                  className="color-input"
                  value={form.themeColors?.accent || DEFAULT_COLORS.accent}
                  onChange={(e) => updateThemeColor('accent', e.target.value)}
                />
                <input
                  type="text"
                  className="input color-hex"
                  value={form.themeColors?.accent || DEFAULT_COLORS.accent}
                  onChange={(e) => updateThemeColor('accent', e.target.value)}
                  maxLength={7}
                />
              </div>
            </label>
          </div>

          <div className="theme-preview">
            <span className="muted small">实时预览:</span>
            <div className="theme-preview-row">
              <button type="button" className="btn btn-primary" style={{ pointerEvents: 'none' }}>主按钮</button>
              <span
                className="tag-pill"
                style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
              >
                标签示例
              </span>
              <span
                className="tag-pill"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                辅助色标签
              </span>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-sm" onClick={resetThemeColors}>
              恢复默认颜色
            </button>
          </div>
        </section>

        {/* ============ 评论规则卡片 ============ */}
        <section className="settings-card">
          <h3 className="settings-card-title">评论规则</h3>
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
        </section>

        <div className="settings-actions">
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
