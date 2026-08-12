import Dexie from 'dexie'

// 使用 IndexedDB 作为本地数据库 (Dexie 封装)
// 数据完全存储在浏览器中,无需后端服务
export class BlogDatabase extends Dexie {
  constructor() {
    super('PureFrontendBlogDB')

    // 版本 1 → 2 迁移: 为已有 posts 补全新字段默认值,并新增索引
    this.version(1).stores({
      posts: '++id, slug, createdAt, updatedAt'
    })

    this.version(2).stores({
      posts: '++id, slug, createdAt, updatedAt, category, published'
    }).upgrade((tx) => {
      // 为旧版本文章补全字段
      return tx.table('posts').toCollection().modify((post) => {
        if (post.category == null) post.category = '未分类'
        if (post.published == null) post.published = true
        if (post.views == null) post.views = 0
        if (post.contentFormat == null) post.contentFormat = 'markdown'
      })
    })

    this.posts = this.table('posts')
  }
}

export const db = new BlogDatabase()

// ---------- 分类管理 (localStorage, 轻量) ----------
const CATEGORIES_KEY = 'blog_categories'
const DEFAULT_CATEGORIES = ['未分类', '技术', '生活', '随笔', '教程', '读书', '游记']

export function getAllCategories() {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY)
    if (!raw) {
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES))
      return [...DEFAULT_CATEGORIES]
    }
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr) || arr.length === 0) return [...DEFAULT_CATEGORIES]
    return arr
  } catch {
    return [...DEFAULT_CATEGORIES]
  }
}

export function saveCategory(name) {
  if (!name || !name.trim()) return
  const list = getAllCategories()
  const n = name.trim()
  if (!list.includes(n)) {
    list.push(n)
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(list))
  }
}

export function deleteCategory(name) {
  const list = getAllCategories().filter((c) => c !== name)
  if (list.length === 0) list.push('未分类')
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(list))
}

// ---------- Slug 生成 ----------
export function slugify(text) {
  const base = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return base || `post-${Date.now()}`
}

async function ensureUniqueSlug(slug, excludeId = null) {
  let candidate = slug
  let n = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await db.posts
      .where('slug')
      .equals(candidate)
      .and((p) => p.id !== excludeId)
      .first()
    if (!existing) return candidate
    candidate = `${slug}-${n++}`
  }
}

// ---------- 公共查询函数 ----------
export async function getAllPosts({ includeUnpublished = false } = {}) {
  const all = await db.posts.toArray()
  const filtered = includeUnpublished ? all : all.filter((p) => p.published !== false)
  return filtered.sort((a, b) => b.createdAt - a.createdAt)
}

export async function getPostById(id) {
  return db.posts.get(Number(id))
}

export async function getPostBySlug(slug) {
  return db.posts.where('slug').equals(slug).first()
}

/**
 * 获取所有已发布文章的标签聚合 { tag: count }
 */
export async function getAllTags() {
  const posts = await getAllPosts()
  const map = new Map()
  for (const p of posts) {
    for (const t of p.tags || []) {
      map.set(t, (map.get(t) || 0) + 1)
    }
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * 获取所有已发布文章的分类聚合 { category: count }
 */
export async function getCategoryCounts() {
  const posts = await getAllPosts()
  const map = new Map()
  for (const p of posts) {
    const c = p.category || '未分类'
    map.set(c, (map.get(c) || 0) + 1)
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * 对文章列表做客户端实时搜索 (标题 / 内容 / 标签 / 摘要 / 分类)
 */
export function searchPosts(posts, keyword) {
  const k = String(keyword || '').trim().toLowerCase()
  if (!k) return posts
  return posts.filter((p) => {
    // 惰性剥离 HTML/Markdown 为纯文本,只在搜索时做
    const contentText = (() => {
      if (!p.content) return ''
      const s = String(p.content)
      if (/<[a-z][\s\S]*>/i.test(s)) {
        // HTML → 纯文本
        return s.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<[^>]+>/gi, ' ')
      }
      return s
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/^#+\s*/gm, ' ')
        .replace(/!\[.*?\]\(.*?\)/g, ' ')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .replace(/[*_`>~-]/g, ' ')
    })()
    const haystack = [
      p.title || '',
      contentText,
      (p.tags || []).join(' '),
      p.excerpt || '',
      p.category || ''
    ].join('\n').toLowerCase()
    return haystack.includes(k)
  })
}

/**
 * 按分类过滤
 */
export function filterPostsByCategory(posts, category) {
  if (!category) return posts
  return posts.filter((p) => (p.category || '未分类') === category)
}

/**
 * 按标签过滤
 */
export function filterPostsByTag(posts, tag) {
  if (!tag) return posts
  return posts.filter((p) => (p.tags || []).includes(tag))
}

/**
 * 分组归档: { '2026': { '8': [...], '7': [...] } }
 */
export function groupPostsByYearMonth(posts) {
  const out = {}
  for (const p of posts) {
    const d = new Date(p.createdAt || Date.now())
    const y = String(d.getFullYear())
    const m = String(d.getMonth() + 1)
    if (!out[y]) out[y] = {}
    if (!out[y][m]) out[y][m] = []
    out[y][m].push(p)
  }
  // 按年份倒序、月份倒序
  const sortedYears = Object.keys(out).sort((a, b) => Number(b) - Number(a))
  for (const y of sortedYears) {
    const sortedMonths = Object.keys(out[y]).sort((a, b) => Number(b) - Number(a))
    const rebuilt = {}
    for (const m of sortedMonths) {
      rebuilt[m] = out[y][m].sort((a, b) => b.createdAt - a.createdAt)
    }
    out[y] = rebuilt
  }
  return { groups: out, years: sortedYears }
}

// ---------- 增删改 ----------
export async function createPost({
  title,
  content,
  contentFormat = 'markdown',
  excerpt,
  tags,
  category = '未分类',
  published = true
}) {
  const now = Date.now()
  const slug = await ensureUniqueSlug(slugify(title))
  saveCategory(category)
  const post = {
    title: title.trim(),
    slug,
    content: content || '',
    contentFormat,
    excerpt: (excerpt || '').trim(),
    tags: Array.isArray(tags) ? tags : [],
    category: category || '未分类',
    published: Boolean(published),
    views: 0,
    createdAt: now,
    updatedAt: now
  }
  const id = await db.posts.add(post)
  return { ...post, id }
}

export async function updatePost(id, {
  title,
  content,
  contentFormat,
  excerpt,
  tags,
  category,
  published
}) {
  const existing = await db.posts.get(id)
  if (!existing) throw new Error('文章不存在')
  if (category && category !== existing.category) saveCategory(category)
  const patch = {
    title: title != null ? String(title).trim() : existing.title,
    content: content != null ? content : existing.content,
    contentFormat: contentFormat || existing.contentFormat || 'markdown',
    excerpt: excerpt != null ? String(excerpt).trim() : existing.excerpt,
    tags: Array.isArray(tags) ? tags : existing.tags,
    category: category || existing.category || '未分类',
    published: typeof published === 'boolean' ? published : existing.published,
    updatedAt: Date.now()
  }
  await db.posts.update(id, patch)
  return { ...existing, ...patch }
}

/**
 * 增加一次阅读量
 */
export async function incrementViews(id) {
  try {
    const p = await db.posts.get(Number(id))
    if (!p) return
    await db.posts.update(id, { views: Number(p.views || 0) + 1 })
  } catch {
    // 忽略错误,阅读量非关键路径
  }
}

export async function deletePost(id) {
  await db.posts.delete(Number(id))
}

export async function getPostCount({ includeUnpublished = false } = {}) {
  if (includeUnpublished) return db.posts.count()
  const all = await db.posts.toArray()
  return all.filter((p) => p.published !== false).length
}
