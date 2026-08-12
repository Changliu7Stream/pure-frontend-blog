/**
 * 管理员认证模块
 * - 首次进入引导设置管理员账号和密码
 * - 密码使用 SHA-256 (Web Crypto API) 加密后存入 localStorage
 * - 登录态通过随机 token 维持,退出时清除
 */

import { DataStore } from './datastore.js'

const AUTH_KEY = DataStore.KEYS.AUTH
const TOKEN_KEY = DataStore.KEYS.TOKEN
const SESSION_TTL = 8 * 60 * 60 * 1000 // 8 小时

// 兼容环境变量方式 (旧版部署可能仍用 VITE_ADMIN_PASSWORD)
const ENV_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || ''

/**
 * SHA-256 哈希 (使用 Web Crypto API)
 */
async function sha256(text) {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 生成随机 token
 */
function generateToken() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 是否已配置管理员账号 (localStorage 或环境变量)
 */
export function isAdminConfigured() {
  const auth = getAuthRecord()
  if (auth && auth.passwordHash) return true
  return Boolean(ENV_PASSWORD)
}

/**
 * 读取 localStorage 中的管理员记录
 */
function getAuthRecord() {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveAuthRecord(record) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(record))
}

/**
 * 首次设置管理员账号和密码
 */
export async function setupAdmin({ username, password }) {
  if (isAdminConfigured()) {
    throw new Error('管理员账号已配置,如需重置请清除浏览器 localStorage')
  }
  if (!password || password.length < 6) {
    throw new Error('密码长度至少 6 位')
  }
  const passwordHash = await sha256(password)
  const record = {
    username: (username || 'admin').trim().slice(0, 50),
    passwordHash,
    createdAt: Date.now()
  }
  saveAuthRecord(record)
  return record
}

/**
 * 尝试用密码登录
 * @returns {Promise<boolean>} 是否登录成功
 */
export async function login(password) {
  if (!password) return false

  const auth = getAuthRecord()

  // 优先使用 localStorage 中的管理员账号
  if (auth && auth.passwordHash) {
    const inputHash = await sha256(password)
    if (inputHash !== auth.passwordHash) return false
  } else if (ENV_PASSWORD) {
    // 兼容环境变量方式
    if (password !== ENV_PASSWORD) return false
  } else {
    throw new Error('未配置管理员账号,请先完成首次设置')
  }

  const token = generateToken()
  const session = {
    token,
    loggedInAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL
  }
  localStorage.setItem(TOKEN_KEY, JSON.stringify(session))
  window.dispatchEvent(new Event('admin-session-change'))
  return true
}

/**
 * 登出: 清除 token
 */
export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  window.dispatchEvent(new Event('admin-session-change'))
}

/**
 * 当前是否处于已登录状态
 */
export function isAuthenticated() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return false
    const session = JSON.parse(raw)
    if (!session?.token || !session?.expiresAt) return false
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(TOKEN_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * 获取管理员用户名 (用于显示)
 */
export function getAdminUsername() {
  const auth = getAuthRecord()
  return auth?.username || '管理员'
}
