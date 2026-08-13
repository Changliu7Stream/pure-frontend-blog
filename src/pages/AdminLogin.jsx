import { useState } from 'react'
import { login, isAdminConfigured, setupAdmin } from '../auth.js'
import { useDocumentMeta } from '../useDocumentMeta.js'
import { LoginIcon, SettingsIcon } from '../icons.jsx'
import { useToast } from '../components/Toast.jsx'

export default function AdminLogin({ navigate }) {
  useDocumentMeta({ title: '管理员登录', siteTitle: '管理后台' })
  const toast = useToast()

  const configured = isAdminConfigured()
  const [mode, setMode] = useState(configured ? 'login' : 'setup')

  // 登录表单
  const [password, setPassword] = useState('')
  const [logging, setLogging] = useState(false)

  // 设置表单
  const [username, setUsername] = useState('')
  const [setupPassword, setSetupPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [setupFieldError, setSetupFieldError] = useState('')
  const [setting, setSetting] = useState(false)

  const onLogin = async (e) => {
    e.preventDefault()
    setLogging(true)
    try {
      const ok = await login(password)
      if (ok) {
        navigate('/admin')
      } else {
        toast.error('密码错误,请重试。')
        setPassword('')
      }
    } catch (err) {
      toast.error(err.message || '登录失败')
    } finally {
      setLogging(false)
    }
  }

  const onSetup = async (e) => {
    e.preventDefault()
    setSetupFieldError('')
    if (!username.trim()) { setSetupFieldError('请输入管理员用户名'); return }
    if (!setupPassword) { setSetupFieldError('请输入密码'); return }
    if (setupPassword.length < 6) { setSetupFieldError('密码长度至少 6 位'); return }
    if (setupPassword !== confirmPassword) { setSetupFieldError('两次输入的密码不一致'); return }
    setSetting(true)
    try {
      await setupAdmin({ username, password: setupPassword })
      // 设置成功后自动登录
      const ok = await login(setupPassword)
      if (ok) {
        navigate('/admin')
      } else {
        toast.error('登录失败,请重试')
      }
    } catch (err) {
      toast.error(err.message || '设置失败')
    } finally {
      setSetting(false)
    }
  }

  // ---- 首次设置引导 ----
  if (mode === 'setup' && !configured) {
    return (
      <div className="auth-page">
        <form className="auth-card" onSubmit={onSetup}>
          <div className="auth-card-head">
            <SettingsIcon size={28} />
            <h2>首次设置</h2>
          </div>
          <p className="muted">检测到尚未配置管理员账号,请先设置管理员用户名和密码。密码将使用 SHA-256 加密后存储在浏览器本地。</p>
          <label className="form-label">
            管理员用户名
            <input
              type="text"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="例如: admin"
              autoFocus
              required
            />
          </label>
          <label className="form-label">
            密码 (至少 6 位)
            <input
              type="password"
              className="input"
              value={setupPassword}
              onChange={(e) => setSetupPassword(e.target.value)}
              placeholder="设置登录密码"
              required
            />
          </label>
          <label className="form-label">
            确认密码
            <input
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入密码"
              required
            />
          </label>
          {setupFieldError && <div className="alert alert-error">{setupFieldError}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={setting}>
            {setting ? '设置中…' : '完成设置并登录'}
          </button>
          <button type="button" className="btn btn-link" onClick={() => navigate('/')}>
            返回首页
          </button>
        </form>
      </div>
    )
  }

  // ---- 登录 ----
  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onLogin}>
        <div className="auth-card-head">
          <LoginIcon size={28} />
          <h2>管理员登录</h2>
        </div>
        <p className="muted">仅管理员可发布与管理文章。</p>
        <label className="form-label">
          密码
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入管理员密码"
            autoFocus
            required
          />
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={logging}>登录</button>
        <button type="button" className="btn btn-link" onClick={() => navigate('/')}>
          返回首页
        </button>
      </form>
    </div>
  )
}
