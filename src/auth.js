// 管理员认证模块
// 密码从环境变量 VITE_ADMIN_PASSWORD 读取 (构建时注入)
// 登录状态保存在 sessionStorage 中,关闭标签页后自动登出

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || ''
const SESSION_KEY = 'blog_admin_session'
// 简单的会话有效期: 8 小时
const SESSION_TTL = 8 * 60 * 60 * 1000

/**
 * 是否已配置管理员密码
 */
export function isAdminConfigured() {
  return Boolean(ADMIN_PASSWORD)
}

/**
 * 尝试用密码登录
 * @returns {boolean} 是否登录成功
 */
export function login(password) {
  if (!ADMIN_PASSWORD) {
    throw new Error('未配置管理员密码 (VITE_ADMIN_PASSWORD),无法登录')
  }
  // 简单的常量时间比较,防止侧信道计时攻击
  const a = String(password || '')
  const b = ADMIN_PASSWORD
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  if (diff !== 0) return false

  const session = {
    loggedInAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  // 触发状态变更事件,供组件监听
  window.dispatchEvent(new Event('admin-session-change'))
  return true
}

/**
 * 登出
 */
export function logout() {
  sessionStorage.removeItem(SESSION_KEY)
  window.dispatchEvent(new Event('admin-session-change'))
}

/**
 * 当前是否处于已登录状态
 */
export function isAuthenticated() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return false
    const session = JSON.parse(raw)
    if (!session?.expiresAt) return false
    if (Date.now() > session.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}
