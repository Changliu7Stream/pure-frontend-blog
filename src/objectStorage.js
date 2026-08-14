/**
 * 对象云存储适配器 (S3 兼容, 覆盖阿里云 OSS / 腾讯云 COS / MinIO / Cloudflare R2)
 *
 * 核心实现: 纯 fetch + S3 签名 V4 (简化版), 不依赖 AWS SDK, 减小体积。
 * 依赖环境: 浏览器原生 fetch / Base64 / crypto
 *
 * 存储配置键: blog_s3_config
 */

const S3_CONFIG_KEY = 'blog_s3_config'

// ============== 配置存取 ==============

export function saveS3Config({ provider, region, endpoint, bucket, accessKeyId, secretAccessKey, pathPrefix, publicUrl }) {
 const config = {
  provider: provider || '',
  region: (region || '').trim(),
  endpoint: (endpoint || '').trim().replace(/\/$/, ''),
  bucket: (bucket || '').trim(),
  accessKeyId: (accessKeyId || '').trim(),
  secretAccessKey: (secretAccessKey || '').trim(),
  pathPrefix: (pathPrefix || 'blog-backups').trim().replace(/^\/+|\/+$/g, ''),
  publicUrl: (publicUrl || '').trim().replace(/\/+$/g, ''),
  savedAt: Date.now()
 }
 localStorage.setItem(S3_CONFIG_KEY, JSON.stringify(config))
 return config
}

export function getS3Config() {
 try {
  const raw = localStorage.getItem(S3_CONFIG_KEY)
  if (!raw) return null
  const c = JSON.parse(raw)
  return {
   provider: c.provider || '',
   region: c.region || '',
   endpoint: c.endpoint || '',
   bucket: c.bucket || '',
   accessKeyId: c.accessKeyId || '',
   secretAccessKey: c.secretAccessKey || '',
   pathPrefix: c.pathPrefix || 'blog-backups',
   publicUrl: c.publicUrl || '',
   savedAt: c.savedAt || null
  }
 } catch {
  return null
 }
}

export function clearS3Config() {
 localStorage.removeItem(S3_CONFIG_KEY)
}

export function hasS3Config() {
 const c = getS3Config()
 return !!(c && c.endpoint && c.bucket && c.accessKeyId && c.secretAccessKey)
}

// ============== 核心 S3 签名 V4 (简化) ==============

function hex(buf) {
 return Array.from(new Uint8Array(buf))
  .map((b) => b.toString(16).padStart(2, '0'))
  .join('')
}

function hmac(key, msg) {
 const encoder = new TextEncoder()
 const keyData = typeof key === 'string' ? encoder.encode(key) : key
 const msgData = encoder.encode(msg)
 return crypto.subtle.importKey(
  'raw',
  keyData,
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign']
 ).then((cryptoKey) =>
  crypto.subtle.sign('HMAC', cryptoKey, msgData)
 )
}

function sha256(msg) {
 const data = new TextEncoder().encode(msg)
 return crypto.subtle.digest('SHA-256', data).then((buf) => hex(buf))
}

function getSignatureKey(key, dateStamp, region, service) {
 const kDate = hmac('AWS4' + key, dateStamp)
 const kRegion = kDate.then((k) => hmac(k, region))
 const kService = kRegion.then((k) => hmac(k, service))
 const kSigning = kService.then((k) => hmac(k, 'aws4_request'))
 return kSigning
}

async function signS3({
 endpoint,
 region,
 bucket,
 accessKeyId,
 secretAccessKey,
 method,
 path,
 query = '',
 headers = {},
 body = ''
}) {
 const now = new Date()
 const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '')
 const dateStamp = amzDate.slice(0, 8)
 const service = 's3'

 const host = endpoint.replace(/^https?:\/\//, '').replace(/^(.+?)(:\d+)?$/, '$1')

 const signedHeadersList = []
 const headersToSign = {}

 // 必要头
 const add = (k, v) => {
  const key = k.toLowerCase()
  if (!headersToSign[key]) {
   signedHeadersList.push(key)
   headersToSign[key] = v
  }
 }
 add('host', host)
 add('x-amz-date', amzDate)
 if (secretAccessKey) {
  add('x-amz-content-sha256', 'UNSIGNED-PAYLOAD')
 }

 Object.entries(headers).forEach(([k, v]) => add(k, v))

 const canonicalHeaders = signedHeadersList.map((k) => `${k}:${headersToSign[k]}\n`).join('')
 const signedHeaders = signedHeadersList.join(';')

 const payloadHash = 'UNSIGNED-PAYLOAD'

 const canonicalRequest = [
  method,
  path,
  query,
  canonicalHeaders,
  signedHeaders,
  payloadHash
 ].join('\n')

 const canonicalRequestHash = await sha256(canonicalRequest)

 const algorithm = 'AWS4-HMAC-SHA256'
 const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
 const stringToSign = [
  algorithm,
  amzDate,
  credentialScope,
  canonicalRequestHash
 ].join('\n')

 const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service)
 const signature = hex(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', signingKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), new TextEncoder().encode(stringToSign)))

 const authorization =
  `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

 return {
  authorization,
  amzDate,
  signedHeaders,
  host,
  headersToSign
 }
}

// ============== 对象存储操作 ==============

export async function putObject({ endpoint, region, bucket, accessKeyId, secretAccessKey, pathPrefix, key, content, contentType = 'application/json; charset=utf-8' }) {
 const path = `/${pathPrefix}/${key}`
 const query = ''
 const headers = {
  'Content-Type': contentType,
  'x-amz-acl': 'private'
 }

 const sig = await signS3({
  endpoint,
  region,
  bucket,
  accessKeyId,
  secretAccessKey,
  method: 'PUT',
  path,
  query,
  headers,
  body: content
 })

 const url = `${endpoint}${encodeURI(path)}`
 const resp = await fetch(url, {
  method: 'PUT',
  headers: {
   ...sig.headersToSign,
   ...headers,
   Authorization: sig.authorization
  },
  body: content
 })

 if (resp.ok || resp.status === 200 || resp.status === 201) {
  return { ok: true }
 }
 if (resp.status === 403 || resp.status === 401) {
  return { ok: false, message: '认证失败,请检查 AK/SK。' }
 }
 return { ok: false, message: `上传失败: HTTP ${resp.status}` }
}

export async function getObject({ endpoint, region, bucket, accessKeyId, secretAccessKey, pathPrefix, key }) {
 const path = `/${pathPrefix}/${key}`
 const query = ''
 const headers = {}

 const sig = await signS3({
  endpoint,
  region,
  bucket,
  accessKeyId,
  secretAccessKey,
  method: 'GET',
  path,
  query,
  headers
 })

 const url = `${endpoint}${encodeURI(path)}`
 const resp = await fetch(url, {
  method: 'GET',
  headers: {
   ...sig.headersToSign,
   Authorization: sig.authorization
  }
 })

 if (!resp.ok) {
  if (resp.status === 404) {
   return { ok: false, message: '文件不存在', content: null }
  }
  if (resp.status === 403 || resp.status === 401) {
   return { ok: false, message: '认证失败,请检查 AK/SK。', content: null }
  }
  return { ok: false, message: `下载失败: HTTP ${resp.status}`, content: null }
 }

 const content = await resp.text()
 return { ok: true, content }
}

export async function listObjects({ endpoint, region, bucket, accessKeyId, secretAccessKey, pathPrefix }) {
 const normalizedPrefix = (pathPrefix || '').replace(/^\/+|\/+$/g, '')
 const safePrefix = normalizedPrefix ? normalizedPrefix + '/' : ''
 const query = new URLSearchParams({
  'list-type': '2',
  encodingType: 'url',
  maxKeys: '1000',
  ...(safePrefix ? { prefix: safePrefix } : {})
 }).toString()

 const path = '/'
 const headers = {}
 const sig = await signS3({
  endpoint,
  region,
  bucket,
  accessKeyId,
  secretAccessKey,
  method: 'GET',
  path,
  query: `?${query}`,
  headers
 })

 const host = endpoint.replace(/^https?:\/\//, '').replace(/^(.+?)(:\d+)?$/, '$1')
 const url = `${endpoint}${path}?${query}`
 const resp = await fetch(url, {
  method: 'GET',
  headers: {
   host,
   ...sig.headersToSign,
   Authorization: sig.authorization
  }
 })

 if (!resp.ok) {
  if (resp.status === 403 || resp.status === 401) {
   return { ok: false, message: '认证失败,请检查 AK/SK。', files: [] }
  }
  return { ok: false, message: `获取列表失败: HTTP ${resp.status}`, files: [] }
 }

 const text = await resp.text()
 const files = parseListObjectsV2(text, safePrefix)
 return { ok: true, message: `已获取 ${files.length} 个备份文件`, files }
}

// ============== XML 解析 ==============

function parseListObjectsV2(xmlText, prefix) {
 const parser = new DOMParser()
 const doc = parser.parseFromString(xmlText, 'application/xml')
 const items = doc.getElementsByTagName('Contents')
 const files = []
 for (let i = 0; i < items.length; i++) {
  const node = items[i]
  const keyText = getTagValue(node, 'Key')
  const sizeText = getTagValue(node, 'Size')
  const lastModified = getTagValue(node, 'LastModified')
  const filename = keyText ? decodeURIComponent(keyText).split('/').pop() : ''
  if (!filename || !filename.toLowerCase().endsWith('.json')) continue
  files.push({
   filename,
   size: sizeText ? Number(sizeText) : null,
   lastModified: lastModified || ''
  })
 }
 files.sort((a, b) => b.filename.localeCompare(a.filename))
 return files
}

function getTagValue(parent, tag) {
 try {
  return parent.getElementsByTagName(tag)[0]?.textContent || ''
 } catch {
  return ''
 }
}

export async function deleteObject({ endpoint, region, bucket, accessKeyId, secretAccessKey, pathPrefix, key }) {
 const path = `/${pathPrefix}/${key}`
 const query = ''
 const headers = {}
 const sig = await signS3({
  endpoint,
  region,
  bucket,
  accessKeyId,
  secretAccessKey,
  method: 'DELETE',
  path,
  query,
  headers
 })

 const url = `${endpoint}${encodeURI(path)}`
 const resp = await fetch(url, {
  method: 'DELETE',
  headers: {
   ...sig.headersToSign,
   Authorization: sig.authorization
  }
 })

 if (resp.ok || resp.status === 204) {
  return { ok: true, message: `已删除: ${key}` }
 }
 if (resp.status === 404) {
  return { ok: false, message: '文件不存在,可能已被删除。' }
 }
 if (resp.status === 403 || resp.status === 401) {
  return { ok: false, message: '认证失败,请检查 AK/SK。' }
 }
 return { ok: false, message: `删除失败: HTTP ${resp.status}` }
}

// ============== 辅助函数 ==============

export function generateCloudFilename() {
 const d = new Date()
 const pad = (n) => String(n).padStart(2, '0')
 return `backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`
}

export function formatS3Date(dateStr) {
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
