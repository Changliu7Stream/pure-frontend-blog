import { useState } from 'react'
import { login, isAdminConfigured } from '../auth.js'

export default function AdminLogin({ navigate }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const onSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!isAdminConfigured()) {
      setError('未配置管理员密码 (VITE_ADMIN_PASSWORD),无法登录。请在 .env 中设置后重新构建。')
      return
    }
    if (login(password)) {
      navigate('/admin')
    } else {
      setError('密码错误,请重试。')
      setPassword('')
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h2>管理员登录</h2>
        <p className="muted">仅管理员可发布与编辑文章。密码通过环境变量 VITE_ADMIN_PASSWORD 配置。</p>
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
        {error && <div className="alert alert-error">{error}</div>}
        <button type="submit" className="btn btn-primary btn-block">登录</button>
        <button
          type="button"
          className="btn btn-link"
          onClick={() => navigate('/')}
        >
          返回首页
        </button>
      </form>
    </div>
  )
}
