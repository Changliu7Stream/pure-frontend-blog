import Dexie from 'dexie'

// 使用 IndexedDB 作为本地数据库 (Dexie 封装)
// 数据完全存储在浏览器中,无需后端服务
export class BlogDatabase extends Dexie {
  constructor() {
    super('PureFrontendBlogDB')
    // 定义 posts 表: 主键 id, 索引 createdAt / slug / updatedAt
    this.version(1).stores({
      posts: '++id, slug, createdAt, updatedAt'
    })
    this.posts = this.table('posts')
  }
}

export const db = new BlogDatabase()

/**
 * 生成 URL 友好的 slug
 */
export function slugify(text) {
  const base = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  // 中文标题 slug 可能重复,追加时间戳确保唯一
  return base || `post-${Date.now()}`
}

/**
 * 确保 slug 唯一
 */
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

/**
 * 获取所有文章 (按创建时间倒序)
 */
export async function getAllPosts() {
  const posts = await db.posts.toArray()
  return posts.sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * 根据 id 获取文章
 */
export async function getPostById(id) {
  return db.posts.get(Number(id))
}

/**
 * 根据 slug 获取文章
 */
export async function getPostBySlug(slug) {
  return db.posts.where('slug').equals(slug).first()
}

/**
 * 创建新文章 (仅管理员调用)
 */
export async function createPost({ title, content, excerpt, tags }) {
  const now = Date.now()
  const slug = await ensureUniqueSlug(slugify(title))
  const post = {
    title: title.trim(),
    slug,
    content: content || '',
    excerpt: (excerpt || '').trim(),
    tags: Array.isArray(tags) ? tags : [],
    createdAt: now,
    updatedAt: now
  }
  const id = await db.posts.add(post)
  return { ...post, id }
}

/**
 * 更新文章 (仅管理员调用)
 */
export async function updatePost(id, { title, content, excerpt, tags }) {
  const existing = await db.posts.get(id)
  if (!existing) throw new Error('文章不存在')
  const patch = {
    title: title?.trim() ?? existing.title,
    content: content ?? existing.content,
    excerpt: (excerpt ?? existing.excerpt).trim(),
    tags: Array.isArray(tags) ? tags : existing.tags,
    updatedAt: Date.now()
  }
  await db.posts.update(id, patch)
  return { ...existing, ...patch }
}

/**
 * 删除文章 (仅管理员调用)
 */
export async function deletePost(id) {
  await db.posts.delete(Number(id))
}

/**
 * 获取文章总数 (用于仪表盘统计)
 */
export async function getPostCount() {
  return db.posts.count()
}
