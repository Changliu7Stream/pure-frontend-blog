/**
 * WebDAV 客户端模块
 * 使用原生 fetch 封装 WebDAV 协议请求 (PROPFIND / PUT / DELETE / GET)
 * 处理 Basic Auth 认证 (用户名:密码 的 Base64 编码)
 *
 * 注意: 浏览器环境下 WebDAV 请求可能遇到 CORS 跨域限制,
 * 需要在 WebDAV 服务器端 (Nginx / 坚果云 / Nextcloud) 开启跨域访问,
 * 或通过代理服务转发请求。
 */

const WEBDAV_CONFIG_KEY = 'blog_webdav_config'
const DEFAULT_BACKUP_DIR = '/blog-backups/'

/**
 * Base64 编解码 (UTF-8 安全)
 */
function encodeBase64(str) {
  return btoa(unescape(encodeURIComponent(str)))
}

function decodeBase64(b64) {
  try {
    return decodeURIComponent(escape(atob(b64)))
  } catch {
    return ''
  }
}

/**
 * 生成 Basic Auth 头
 */
function authHeader(username, password) {
  return 'Basic ' + encodeBase64(`${username}:${password}`)
}

/**
 * 规范化 WebDAV URL: 确保以 / 结尾的目录路径
 */
function normalizeUrl(url) {
  return String(url || '').replace(/\/+$/, '') + '/'
}

/**
 * 拼接完整的文件 URL
 */
function fileUrl(baseUrl, filename) {
  return normalizeUrl(baseUrl) + encodeURIComponent(filename).replace(/%2F/g, '/')
}

// ==================== 配置存取 (加密存储) ====================

export function saveWebDAVConfig({ url, username, password }) {
  const config = {
    url: (url || '').trim(),
    username: (username || '').trim(),
    // 密码使用 Base64 编码存储,避免明文
    password: encodeBase64(password || ''),
    savedAt: Date.now()
  }
  localStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(config))
  return config
}

export function getWebDAVConfig() {
  try {
    const raw = localStorage.getItem(WEBDAV_CONFIG_KEY)
    if (!raw) return null
    const config = JSON.parse(raw)
    return {
      url: config.url || '',
      username: config.username || '',
      password: config.password ? decodeBase64(config.password) : '',
      savedAt: config.savedAt || null
    }
  } catch {
    return null
  }
}

export function clearWebDAVConfig() {
  localStorage.removeItem(WEBDAV_CONFIG_KEY)
}

export function hasWebDAVConfig() {
  const config = getWebDAVConfig()
  return !!(config && config.url && config.username)
}

// ==================== WebDAV 请求方法 ====================

/**
 * 测试连接: 发送 PROPFIND 请求验证地址和凭据
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function testConnection(url, username, password) {
  const target = normalizeUrl(url)
  try {
    const resp = await fetch(target, {
      method: 'PROPFIND',
      headers: {
        'Authorization': authHeader(username, password),
        'Depth': '0',
        'Content-Type': 'application/xml; charset=utf-8'
      }
    })
    if (resp.status === 207) {
      return { ok: true, message: '连接成功,服务器已响应。' }
    }
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, message: '认证失败: 用户名或密码错误。' }
    }
    if (resp.status === 404) {
      return { ok: false, message: '地址不存在: 服务器返回 404。' }
    }
    // 某些服务器可能不支持 PROPFIND,尝试 OPTIONS
    if (resp.status === 405) {
      const optResp = await fetch(target, {
        method: 'OPTIONS',
        headers: { 'Authorization': authHeader(username, password) }
      })
      if (optResp.ok || optResp.status === 200) {
        return { ok: true, message: '连接成功 (OPTIONS 验证通过)。' }
      }
      return { ok: false, message: `服务器不支持 PROPFIND,OPTIONS 返回 ${optResp.status}` }
    }
    if (resp.ok) {
      return { ok: true, message: '连接成功。' }
    }
    return { ok: false, message: `连接失败: 服务器返回 ${resp.status}` }
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      return {
        ok: false,
        message: '网络请求失败,可能是 CORS 跨域限制或地址不可达。请在 WebDAV 服务器端开启 CORS,或使用代理服务。'
      }
    }
    return { ok: false, message: '连接异常: ' + (err.message || String(err)) }
  }
}

/**
 * 上传文件 (PUT)
 * @param {string} url - WebDAV 服务器地址
 * @param {string} username
 * @param {string} password
 * @param {string} filename - 文件名
 * @param {string} content - 文件内容 (字符串)
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function uploadFile(url, username, password, filename, content) {
  const target = fileUrl(url, filename)
  try {
    const resp = await fetch(target, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader(username, password),
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: content
    })
    if (resp.ok || resp.status === 201 || resp.status === 204) {
      return { ok: true, message: `备份成功: ${filename}` }
    }
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, message: '认证失败: 无上传权限。' }
    }
    if (resp.status === 409) {
      // 目录不存在,尝试先创建目录 (MKCOL)
      const mkcolResp = await fetch(normalizeUrl(url), {
        method: 'MKCOL',
        headers: { 'Authorization': authHeader(username, password) }
      })
      if (mkcolResp.ok || mkcolResp.status === 201) {
        // 重试上传
        const retryResp = await fetch(target, {
          method: 'PUT',
          headers: {
            'Authorization': authHeader(username, password),
            'Content-Type': 'application/json; charset=utf-8'
          },
          body: content
        })
        if (retryResp.ok || retryResp.status === 201 || retryResp.status === 204) {
          return { ok: true, message: `备份成功: ${filename}` }
        }
      }
      return { ok: false, message: '目标目录不存在且无法自动创建。' }
    }
    return { ok: false, message: `上传失败: 服务器返回 ${resp.status}` }
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      return {
        ok: false,
        message: '网络请求失败,可能是 CORS 跨域限制。请在 WebDAV 服务器端开启 CORS,或使用代理服务。'
      }
    }
    return { ok: false, message: '上传异常: ' + (err.message || String(err)) }
  }
}

/**
 * 列出目录下的文件 (PROPFIND)
 * @returns {Promise<{ok: boolean, message: string, files: Array}>}
 */
export async function listFiles(url, username, password) {
  const target = normalizeUrl(url)
  const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:getcontentlength/>
    <D:getlastmodified/>
    <D:resourcetype/>
  </D:prop>
</D:propfind>`

  try {
    const resp = await fetch(target, {
      method: 'PROPFIND',
      headers: {
        'Authorization': authHeader(username, password),
        'Depth': '1',
        'Content-Type': 'application/xml; charset=utf-8'
      },
      body: propfindBody
    })

    if (!resp.ok && resp.status !== 207) {
      if (resp.status === 401 || resp.status === 403) {
        return { ok: false, message: '认证失败: 无访问权限。', files: [] }
      }
      if (resp.status === 404) {
        return { ok: false, message: '备份目录不存在,请先执行一次备份以自动创建。', files: [] }
      }
      return { ok: false, message: `获取列表失败: 服务器返回 ${resp.status}`, files: [] }
    }

    const xmlText = await resp.text()
    const files = parsePropfindResponse(xmlText, target)
    return { ok: true, message: `已获取 ${files.length} 个备份文件`, files }
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      return {
        ok: false,
        message: '网络请求失败,可能是 CORS 跨域限制。请在 WebDAV 服务器端开启 CORS,或使用代理服务。',
        files: []
      }
    }
    return { ok: false, message: '获取列表异常: ' + (err.message || String(err)), files: [] }
  }
}

/**
 * 下载文件内容 (GET)
 * @returns {Promise<{ok: boolean, message: string, content: string|null}>}
 */
export async function downloadFile(url, username, password, filename) {
  const target = fileUrl(url, filename)
  try {
    const resp = await fetch(target, {
      method: 'GET',
      headers: { 'Authorization': authHeader(username, password) }
    })
    if (!resp.ok) {
      return { ok: false, message: `下载失败: 服务器返回 ${resp.status}`, content: null }
    }
    const content = await resp.text()
    return { ok: true, message: '下载成功', content }
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      return {
        ok: false,
        message: '网络请求失败,可能是 CORS 跨域限制。请在 WebDAV 服务器端开启 CORS,或使用代理服务。',
        content: null
      }
    }
    return { ok: false, message: '下载异常: ' + (err.message || String(err)), content: null }
  }
}

/**
 * 删除云端文件 (DELETE)
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function deleteFile(url, username, password, filename) {
  const target = fileUrl(url, filename)
  try {
    const resp = await fetch(target, {
      method: 'DELETE',
      headers: { 'Authorization': authHeader(username, password) }
    })
    if (resp.ok || resp.status === 204) {
      return { ok: true, message: `已删除: ${filename}` }
    }
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, message: '认证失败: 无删除权限。' }
    }
    if (resp.status === 404) {
      return { ok: false, message: '文件不存在,可能已被删除。' }
    }
    return { ok: false, message: `删除失败: 服务器返回 ${resp.status}` }
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      return {
        ok: false,
        message: '网络请求失败,可能是 CORS 跨域限制。请在 WebDAV 服务器端开启 CORS,或使用代理服务。'
      }
    }
    return { ok: false, message: '删除异常: ' + (err.message || String(err)) }
  }
}

// ==================== XML 解析 ====================

/**
 * 解析 PROPFIND XML 响应,提取文件列表
 */
function parsePropfindResponse(xmlText, baseUrl) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')
  const responses = doc.getElementsByTagNameNS('DAV:', 'response')
  // 兼容非命名空间写法
  const allResponses = responses.length > 0
    ? responses
    : doc.getElementsByTagName('d:response').length > 0
      ? doc.getElementsByTagName('d:response')
      : doc.getElementsByTagName('response')

  const files = []
  const baseDir = normalizeUrl(baseUrl)

  for (let i = 0; i < allResponses.length; i++) {
    const response = allResponses[i]

    // 提取 href
    let href = ''
    const hrefEl = response.getElementsByTagNameNS('DAV:', 'href')[0]
      || response.getElementsByTagName('d:href')[0]
      || response.getElementsByTagName('href')[0]
    if (hrefEl) href = hrefEl.textContent || hrefEl.nodeValue || ''

    // 跳过目录本身 (href 指向当前目录)
    const decodedHref = decodeURIComponent(href)
    if (decodedHref === baseDir || decodedHref.replace(/\/$/, '') === baseDir.replace(/\/$/, '')) {
      continue
    }

    // 检查是否是目录 (resourcetype 含 collection)
    const collectionEl = response.getElementsByTagNameNS('DAV:', 'collection')[0]
      || response.getElementsByTagName('d:collection')[0]
      || response.getElementsByTagName('collection')[0]
    if (collectionEl) continue // 跳过子目录

    // 提取文件名
    let filename = decodedHref
    if (filename.includes('/')) filename = filename.split('/').filter(Boolean).pop()
    if (!filename) continue

    // 只显示 .json 文件
    if (!filename.toLowerCase().endsWith('.json')) continue

    // 提取文件大小
    let size = ''
    const sizeEl = response.getElementsByTagNameNS('DAV:', 'getcontentlength')[0]
      || response.getElementsByTagName('d:getcontentlength')[0]
      || response.getElementsByTagName('getcontentlength')[0]
    if (sizeEl) size = sizeEl.textContent || ''

    // 提取最后修改时间
    let lastModified = ''
    const modEl = response.getElementsByTagNameNS('DAV:', 'getlastmodified')[0]
      || response.getElementsByTagName('d:getlastmodified')[0]
      || response.getElementsByTagName('getlastmodified')[0]
    if (modEl) lastModified = modEl.textContent || ''

    files.push({
      filename,
      size: size ? Number(size) : null,
      lastModified
    })
  }

  // 按文件名倒序 (新的备份文件名含日期,倒序排列最新的在前)
  files.sort((a, b) => b.filename.localeCompare(a.filename))
  return files
}

// ==================== 辅助工具 ====================

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * 格式化 WebDAV 时间 (RFC 2822 格式)
 */
export function formatWebDAVDate(dateStr) {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return dateStr
  }
}

/**
 * 生成备份文件名: backup-YYYY-MM-DD-HHmm.json
 */
export function generateBackupFilename() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`
}
