/**
 * DataStore - 统一数据操作模块
 * 所有数据通过 localStorage 持久化,后续可迁移到 Supabase
 * 不使用任何模拟/假数据,全部为真实可持久化存储
 */

// ==================== 存储键名 ====================
const KEYS = {
  POSTS: 'blog_posts',
  PAGES: 'blog_pages',
  COMMENTS: 'blog_comments',
  CATEGORIES: 'blog_categories',
  SETTINGS: 'blog_settings',
  AUTH: 'blog_auth',
  TOKEN: 'blog_admin_token',
  DRAFTS: 'blog_drafts'
}

const DEFAULT_CATEGORIES = ['未分类', '技术', '生活', '随笔', '教程']

const DEFAULT_SETTINGS = {
  blogName: '我的博客',
  subtitle: '收录技术与生活随笔',
  logo: '',
  logoData: '',
  footer: '纯前端博客 · localStorage 本地存储 · React + Vite',
  heroEnabled: true,
  commentEnabled: true,
  commentNeedReview: true,
  themeColors: {
    primary: '#3B82F6',
    accent: '#6366F1'
  }
}

// ==================== 底层读写工具 ====================
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    const parsed = JSON.parse(raw)
    return parsed == null ? fallback : parsed
  } catch {
    return fallback
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    console.error('DataStore 写入失败 (可能 localStorage 已满):', e)
    throw new Error('数据写入失败,存储空间可能已满。请清理不必要的数据后重试。')
  }
}

function generateId() {
  return Date.now() + Math.floor(Math.random() * 10000)
}

function slugify(text) {
  const base = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return base || `post-${Date.now()}`
}

function ensureUniqueSlug(slug, excludeId, collection) {
  let candidate = slug
  let n = 1
  while (collection.some((item) => item.slug === candidate && item.id !== excludeId)) {
    candidate = `${slug}-${n++}`
  }
  return candidate
}

// ==================== 文章 (Posts) ====================
const Posts = {
  getAll({ includeUnpublished = false } = {}) {
    const all = readJSON(KEYS.POSTS, [])
    const filtered = includeUnpublished ? all : all.filter((p) => p.status !== 'draft' && p.status !== 'scheduled')
    return filtered.sort((a, b) => b.createdAt - a.createdAt)
  },

  getById(id) {
    const all = readJSON(KEYS.POSTS, [])
    return all.find((p) => p.id === Number(id)) || null
  },

  getBySlug(slug) {
    const all = readJSON(KEYS.POSTS, [])
    let decoded
    try { decoded = decodeURIComponent(slug) } catch { decoded = slug }
    return all.find((p) => p.slug === decoded) || null
  },

  getRecent(limit = 5) {
    return this.getAll({ includeUnpublished: false }).slice(0, limit)
  },

  create(data) {
    const all = readJSON(KEYS.POSTS, [])
    const now = Date.now()
    const slug = ensureUniqueSlug(slugify(data.title), null, all)
    const post = {
      id: generateId(),
      title: (data.title || '').trim(),
      slug,
      content: data.content || '',
      contentFormat: data.contentFormat || 'html',
      excerpt: (data.excerpt || '').trim(),
      tags: Array.isArray(data.tags) ? data.tags : [],
      category: data.category || '未分类',
      status: data.status || 'published',
      scheduledAt: data.scheduledAt || null,
      views: 0,
      createdAt: now,
      updatedAt: now
    }
    all.push(post)
    writeJSON(KEYS.POSTS, all)
    Categories.ensureExists(post.category)
    return post
  },

  update(id, patch) {
    const all = readJSON(KEYS.POSTS, [])
    const idx = all.findIndex((p) => p.id === Number(id))
    if (idx === -1) throw new Error('文章不存在')
    const existing = all[idx]
    if (patch.title && patch.title !== existing.title) {
      patch.slug = ensureUniqueSlug(slugify(patch.title), existing.id, all)
    }
    if (patch.category && patch.category !== existing.category) {
      Categories.ensureExists(patch.category)
    }
    all[idx] = { ...existing, ...patch, updatedAt: Date.now() }
    writeJSON(KEYS.POSTS, all)
    return all[idx]
  },

  delete(id) {
    const all = readJSON(KEYS.POSTS, [])
    const filtered = all.filter((p) => p.id !== Number(id))
    writeJSON(KEYS.POSTS, filtered)
    // 同时删除关联评论
    const comments = readJSON(KEYS.COMMENTS, [])
    const remainingComments = comments.filter((c) => c.postId !== Number(id))
    if (remainingComments.length !== comments.length) {
      writeJSON(KEYS.COMMENTS, remainingComments)
    }
  },

  incrementViews(id) {
    const all = readJSON(KEYS.POSTS, [])
    const idx = all.findIndex((p) => p.id === Number(id))
    if (idx !== -1) {
      all[idx].views = (all[idx].views || 0) + 1
      writeJSON(KEYS.POSTS, all)
    }
  },

  search(posts, keyword) {
    const k = String(keyword || '').trim().toLowerCase()
    if (!k) return posts
    return posts.filter((p) => {
      const text = [
        p.title || '',
        p.excerpt || '',
        p.category || '',
        (p.tags || []).join(' '),
        String(p.content || '').replace(/<[^>]+>/g, ' ').replace(/[#*_`>~-]/g, ' ')
      ].join('\n').toLowerCase()
      return text.includes(k)
    })
  },

  filterByCategory(posts, category) {
    if (!category) return posts
    return posts.filter((p) => (p.category || '未分类') === category)
  },

  filterByTag(posts, tag) {
    if (!tag) return posts
    return posts.filter((p) => (p.tags || []).includes(tag))
  },

  paginate(posts, page, pageSize) {
    const start = (page - 1) * pageSize
    return {
      items: posts.slice(start, start + pageSize),
      total: posts.length,
      totalPages: Math.ceil(posts.length / pageSize),
      currentPage: page
    }
  },

  groupByYearMonth(posts) {
    const out = {}
    for (const p of posts) {
      const d = new Date(p.createdAt || Date.now())
      const y = String(d.getFullYear())
      const m = String(d.getMonth() + 1)
      if (!out[y]) out[y] = {}
      if (!out[y][m]) out[y][m] = []
      out[y][m].push(p)
    }
    const years = Object.keys(out).sort((a, b) => Number(b) - Number(a))
    for (const y of years) {
      const months = Object.keys(out[y]).sort((a, b) => Number(b) - Number(a))
      const rebuilt = {}
      for (const m of months) {
        rebuilt[m] = out[y][m].sort((a, b) => b.createdAt - a.createdAt)
      }
      out[y] = rebuilt
    }
    return { groups: out, years }
  },

  /** 定时发布检查: 到点的定时文章自动变为已发布 */
  checkScheduled() {
    const all = readJSON(KEYS.POSTS, [])
    const now = Date.now()
    let changed = false
    for (const p of all) {
      if (p.status === 'scheduled' && p.scheduledAt && p.scheduledAt <= now) {
        p.status = 'published'
        p.updatedAt = now
        changed = true
      }
    }
    if (changed) writeJSON(KEYS.POSTS, all)
    return changed
  },

  /** 统计数据 */
  getStats() {
    const all = readJSON(KEYS.POSTS, [])
    const published = all.filter((p) => p.status === 'published').length
    const drafts = all.filter((p) => p.status === 'draft').length
    const scheduled = all.filter((p) => p.status === 'scheduled').length
    const catSet = new Set(all.map((p) => p.category || '未分类'))
    const tagSet = new Set()
    all.forEach((p) => (p.tags || []).forEach((t) => tagSet.add(t)))
    const totalViews = all.reduce((sum, p) => sum + (p.views || 0), 0)
    return {
      total: all.length,
      published,
      drafts,
      scheduled,
      categories: catSet.size,
      tags: tagSet.size,
      totalViews
    }
  }
}

// ==================== 独立页面 (Pages) ====================
const Pages = {
  getAll() {
    return readJSON(KEYS.PAGES, []).sort((a, b) => b.updatedAt - a.updatedAt)
  },

  getById(id) {
    return readJSON(KEYS.PAGES, []).find((p) => p.id === Number(id)) || null
  },

  getBySlug(slug) {
    let decoded
    try { decoded = decodeURIComponent(slug) } catch { decoded = slug }
    return readJSON(KEYS.PAGES, []).find((p) => p.slug === decoded) || null
  },

  getPublished() {
    return this.getAll().filter((p) => p.published)
  },

  // 获取已发布的顶级页面 (无 parentId)
  getPublishedTopLevel() {
    return this.getPublished().filter((p) => !p.parentId)
  },

  // 获取某个页面的已发布子页面
  getChildren(parentId) {
    return this.getPublished().filter((p) => p.parentId === Number(parentId))
  },

  // 获取某个页面的所有子页面 (含未发布)
  getAllChildren(parentId) {
    return this.getAll().filter((p) => p.parentId === Number(parentId))
  },

  create(data) {
    const all = readJSON(KEYS.PAGES, [])
    const now = Date.now()
    const slug = ensureUniqueSlug(slugify(data.title || 'page'), null, all)
    const page = {
      id: generateId(),
      title: (data.title || '').trim(),
      slug,
      content: data.content || '',
      contentFormat: data.contentFormat || 'html',
      published: data.published !== false,
      parentId: data.parentId ? Number(data.parentId) : null,
      createdAt: now,
      updatedAt: now
    }
    all.push(page)
    writeJSON(KEYS.PAGES, all)
    return page
  },

  update(id, patch) {
    const all = readJSON(KEYS.PAGES, [])
    const idx = all.findIndex((p) => p.id === Number(id))
    if (idx === -1) throw new Error('页面不存在')
    if (patch.title && patch.title !== all[idx].title) {
      patch.slug = ensureUniqueSlug(slugify(patch.title), all[idx].id, all)
    }
    if (patch.parentId !== undefined) {
      patch.parentId = patch.parentId ? Number(patch.parentId) : null
      // 不能将自己设为父页面
      if (patch.parentId === all[idx].id) {
        throw new Error('不能将页面设为自身的子页面')
      }
    }
    all[idx] = { ...all[idx], ...patch, updatedAt: Date.now() }
    writeJSON(KEYS.PAGES, all)
    return all[idx]
  },

  delete(id) {
    const all = readJSON(KEYS.PAGES, [])
    const deletedId = Number(id)
    // 删除页面时,其子页面提升为顶级页面
    const updated = all
      .filter((p) => p.id !== deletedId)
      .map((p) => p.parentId === deletedId ? { ...p, parentId: null } : p)
    writeJSON(KEYS.PAGES, updated)
  },

  togglePublished(id) {
    const page = this.getById(id)
    if (!page) return
    return this.update(id, { published: !page.published })
  }
}

// ==================== 评论 (Comments) ====================
const Comments = {
  getAll() {
    return readJSON(KEYS.COMMENTS, []).sort((a, b) => b.createdAt - a.createdAt)
  },

  getByPostId(postId) {
    return readJSON(KEYS.COMMENTS, [])
      .filter((c) => c.postId === Number(postId) && c.status === 'approved')
      .sort((a, b) => a.createdAt - b.createdAt)
  },

  getPending() {
    return this.getAll().filter((c) => c.status === 'pending')
  },

  create(data) {
    const all = readJSON(KEYS.COMMENTS, [])
    const settings = Settings.get()
    const autoApprove = !settings.commentNeedReview
    const comment = {
      id: generateId(),
      postId: Number(data.postId),
      author: (data.author || '匿名访客').trim().slice(0, 50),
      email: (data.email || '').trim().slice(0, 100),
      content: (data.content || '').trim().slice(0, 2000),
      status: autoApprove ? 'approved' : 'pending',
      reply: null,
      replyAt: null,
      createdAt: Date.now()
    }
    all.push(comment)
    writeJSON(KEYS.COMMENTS, all)
    return comment
  },

  update(id, patch) {
    const all = readJSON(KEYS.COMMENTS, [])
    const idx = all.findIndex((c) => c.id === Number(id))
    if (idx === -1) throw new Error('评论不存在')
    all[idx] = { ...all[idx], ...patch }
    writeJSON(KEYS.COMMENTS, all)
    return all[idx]
  },

  approve(id) {
    return this.update(id, { status: 'approved' })
  },

  reject(id) {
    return this.update(id, { status: 'rejected' })
  },

  reply(id, replyContent) {
    const content = String(replyContent || '').trim()
    return this.update(id, { reply: content, replyAt: Date.now() })
  },

  delete(id) {
    const all = readJSON(KEYS.COMMENTS, [])
    writeJSON(KEYS.COMMENTS, all.filter((c) => c.id !== Number(id)))
  },

  getCounts() {
    const all = readJSON(KEYS.COMMENTS, [])
    return {
      total: all.length,
      pending: all.filter((c) => c.status === 'pending').length,
      approved: all.filter((c) => c.status === 'approved').length,
      rejected: all.filter((c) => c.status === 'rejected').length
    }
  }
}

// ==================== 分类 (Categories) ====================
const Categories = {
  getAll() {
    const cats = readJSON(KEYS.CATEGORIES, null)
    if (cats == null) {
      writeJSON(KEYS.CATEGORIES, DEFAULT_CATEGORIES)
      return [...DEFAULT_CATEGORIES]
    }
    if (!Array.isArray(cats) || cats.length === 0) return [...DEFAULT_CATEGORIES]
    return cats
  },

  getWithCounts() {
    const cats = this.getAll()
    const posts = readJSON(KEYS.POSTS, [])
    return cats.map((name) => ({
      name,
      count: posts.filter((p) => (p.category || '未分类') === name && p.status === 'published').length
    }))
  },

  ensureExists(name) {
    if (!name || !name.trim()) return
    const cats = this.getAll()
    const n = name.trim()
    if (!cats.includes(n)) {
      cats.push(n)
      writeJSON(KEYS.CATEGORIES, cats)
    }
  },

  add(name) {
    const n = (name || '').trim()
    if (!n) throw new Error('分类名不能为空')
    const cats = this.getAll()
    if (cats.includes(n)) throw new Error('该分类已存在')
    cats.push(n)
    writeJSON(KEYS.CATEGORIES, cats)
    return n
  },

  rename(oldName, newName) {
    const n = (newName || '').trim()
    if (!n) throw new Error('分类名不能为空')
    const cats = this.getAll()
    if (oldName === n) return n
    if (cats.includes(n)) throw new Error('该分类名已存在')
    const idx = cats.indexOf(oldName)
    if (idx === -1) throw new Error('原分类不存在')
    cats[idx] = n
    writeJSON(KEYS.CATEGORIES, cats)
    // 同步更新所有文章中的分类名
    const posts = readJSON(KEYS.POSTS, [])
    let changed = false
    for (const p of posts) {
      if (p.category === oldName) {
        p.category = n
        p.updatedAt = Date.now()
        changed = true
      }
    }
    if (changed) writeJSON(KEYS.POSTS, posts)
    return n
  },

  delete(name) {
    const cats = this.getAll().filter((c) => c !== name)
    if (cats.length === 0) cats.push('未分类')
    writeJSON(KEYS.CATEGORIES, cats)
    // 将该分类下的文章移至"未分类"
    const posts = readJSON(KEYS.POSTS, [])
    let changed = false
    for (const p of posts) {
      if (p.category === name) {
        p.category = '未分类'
        p.updatedAt = Date.now()
        changed = true
      }
    }
    if (changed) writeJSON(KEYS.POSTS, posts)
  }
}

// ==================== 标签 (Tags) ====================
const Tags = {
  /** 从文章中聚合所有标签 */
  getAll() {
    const posts = readJSON(KEYS.POSTS, [])
    const map = new Map()
    for (const p of posts) {
      for (const t of (p.tags || [])) {
        map.set(t, (map.get(t) || 0) + 1)
      }
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  },

  /** 新增标签到指定文章 */
  addToPost(postId, tag) {
    const t = (tag || '').trim()
    if (!t) return
    const post = Posts.getById(postId)
    if (!post) return
    const tags = post.tags || []
    if (!tags.includes(t)) {
      tags.push(t)
      Posts.update(postId, { tags })
    }
  },

  /** 重命名标签 (影响所有包含该标签的文章) */
  rename(oldName, newName) {
    const n = (newName || '').trim()
    if (!n) throw new Error('标签名不能为空')
    if (oldName === n) return
    const posts = readJSON(KEYS.POSTS, [])
    let changed = false
    for (const p of posts) {
      if (p.tags && p.tags.includes(oldName)) {
        if (!p.tags.includes(n)) {
          p.tags = p.tags.map((t) => (t === oldName ? n : t))
        } else {
          p.tags = p.tags.filter((t) => t !== oldName)
        }
        p.updatedAt = Date.now()
        changed = true
      }
    }
    if (changed) writeJSON(KEYS.POSTS, posts)
  },

  /** 合并标签: 将 source 合并到 target */
  merge(source, target) {
    const s = (source || '').trim()
    const t = (target || '').trim()
    if (!s || !t) throw new Error('标签名不能为空')
    if (s === t) throw new Error('不能合并到自身')
    const posts = readJSON(KEYS.POSTS, [])
    let changed = false
    for (const p of posts) {
      if (p.tags && p.tags.includes(s)) {
        if (!p.tags.includes(t)) {
          p.tags = p.tags.map((tag) => (tag === s ? t : tag))
        } else {
          p.tags = p.tags.filter((tag) => tag !== s)
        }
        p.updatedAt = Date.now()
        changed = true
      }
    }
    if (changed) writeJSON(KEYS.POSTS, posts)
  },

  /** 删除标签 (从所有文章中移除) */
  delete(name) {
    const posts = readJSON(KEYS.POSTS, [])
    let changed = false
    for (const p of posts) {
      if (p.tags && p.tags.includes(name)) {
        p.tags = p.tags.filter((t) => t !== name)
        p.updatedAt = Date.now()
        changed = true
      }
    }
    if (changed) writeJSON(KEYS.POSTS, posts)
  }
}

// ==================== 系统设置 (Settings) ====================
const Settings = {
  get() {
    const stored = readJSON(KEYS.SETTINGS, {}) || {}
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      themeColors: {
        ...DEFAULT_SETTINGS.themeColors,
        ...(stored.themeColors || {})
      }
    }
  },

  update(patch) {
    const current = this.get()
    const next = { ...current, ...patch }
    writeJSON(KEYS.SETTINGS, next)
    return next
  },

  reset() {
    writeJSON(KEYS.SETTINGS, { ...DEFAULT_SETTINGS })
    return { ...DEFAULT_SETTINGS }
  }
}

// ==================== 草稿自动保存 (Drafts) ====================
const Drafts = {
  get(key) {
    const all = readJSON(KEYS.DRAFTS, {})
    if (!all || typeof all !== 'object') return null
    return Object.prototype.hasOwnProperty.call(all, key) ? all[key] : null
  },

  save(key, data) {
    const all = readJSON(KEYS.DRAFTS, {})
    const safe = (all && typeof all === 'object') ? { ...all } : {}
    safe[key] = { ...data, savedAt: Date.now() }
    writeJSON(KEYS.DRAFTS, safe)
  },

  delete(key) {
    const all = readJSON(KEYS.DRAFTS, {})
    const safe = (all && typeof all === 'object') ? { ...all } : {}
    delete safe[key]
    writeJSON(KEYS.DRAFTS, safe)
  }
}

// ==================== 数据备份与恢复 (Backup) ====================
const Backup = {
  exportAll() {
    return {
      version: 2,
      exportedAt: Date.now(),
      posts: readJSON(KEYS.POSTS, []),
      pages: readJSON(KEYS.PAGES, []),
      comments: readJSON(KEYS.COMMENTS, []),
      categories: readJSON(KEYS.CATEGORIES, [...DEFAULT_CATEGORIES]),
      settings: Settings.get()
    }
  },

  importAll(data, { overwrite = true } = {}) {
    if (!data || typeof data !== 'object') throw new Error('无效的数据格式')
    if (!data.version) throw new Error('数据缺少版本信息,可能是无效的备份文件')

    if (overwrite) {
      if (Array.isArray(data.posts)) writeJSON(KEYS.POSTS, data.posts)
      if (Array.isArray(data.pages)) writeJSON(KEYS.PAGES, data.pages)
      if (Array.isArray(data.comments)) writeJSON(KEYS.COMMENTS, data.comments)
      if (Array.isArray(data.categories)) writeJSON(KEYS.CATEGORIES, data.categories)
      if (data.settings) writeJSON(KEYS.SETTINGS, data.settings)
    } else {
      // 追加模式: 合并数据
      if (Array.isArray(data.posts)) {
        const existing = readJSON(KEYS.POSTS, [])
        const newPosts = data.posts.filter((p) => !existing.some((e) => e.id === p.id))
        writeJSON(KEYS.POSTS, [...existing, ...newPosts])
      }
      if (Array.isArray(data.pages)) {
        const existing = readJSON(KEYS.PAGES, [])
        const newPages = data.pages.filter((p) => !existing.some((e) => e.id === p.id))
        writeJSON(KEYS.PAGES, [...existing, ...newPages])
      }
      if (Array.isArray(data.comments)) {
        const existing = readJSON(KEYS.COMMENTS, [])
        const newComments = data.comments.filter((c) => !existing.some((e) => e.id === c.id))
        writeJSON(KEYS.COMMENTS, [...existing, ...newComments])
      }
      if (Array.isArray(data.categories)) {
        const existing = Categories.getAll()
        const merged = [...new Set([...existing, ...data.categories])]
        writeJSON(KEYS.CATEGORIES, merged)
      }
    }
  }
}

// ==================== 统一导出 ====================
export const DataStore = {
  Posts,
  Pages,
  Comments,
  Categories,
  Tags,
  Settings,
  Drafts,
  Backup,
  KEYS
}

// 兼容旧导出 (db.js 的函数名,供逐步迁移)
export {
  Posts as postsApi,
  Pages as pagesApi,
  Comments as commentsApi,
  Categories as categoriesApi,
  Tags as tagsApi,
  Settings as settingsApi,
  Backup as backupApi
}

// ==================== 默认数据初始化 ====================

const DEFAULT_POST_CONTENT = `<h2>为什么写博客？</h2>
<p>写博客是一种很好的知识沉淀方式。无论是技术笔记、生活感悟还是读书心得，记录下来不仅能帮助自己梳理思路，也能在未来某个时刻回看当时的自己。</p>
<h2>这篇文章要测试什么？</h2>
<ul>
  <li><strong>富文本渲染</strong>：检查标题、段落、列表、引用等格式是否正确显示。</li>
  <li><strong>分类与标签</strong>：验证分类和标签能否正确关联到文章。</li>
  <li><strong>评论功能</strong>：测试读者是否可以正常提交评论。</li>
  <li><strong>阅读量统计</strong>：查看文章被访问后阅读量是否会增加。</li>
</ul>
<blockquote><p>"写作是思考的延伸，分享是学习的开始。" —— 某位爱写博客的人</p></blockquote>
<p>这是初始默认博客展示文章，管理后台可以删除默认的这篇文章。</p>`

const DEFAULT_POST_EXCERPT = '写博客是一种很好的知识沉淀方式。这篇文章用于测试富文本渲染、分类与标签、评论功能及阅读量统计。'

function seedDefaultData() {
  const existing = readJSON(KEYS.POSTS, null)
  if (existing && Array.isArray(existing) && existing.length > 0) return

  const now = Date.now()
  const defaultPost = {
    id: now,
    title: 'Hello World！这是我的第一篇博客文章',
    slug: 'hello-world',
    content: DEFAULT_POST_CONTENT,
    contentFormat: 'html',
    excerpt: DEFAULT_POST_EXCERPT,
    tags: ['测试', '公告'],
    category: '随笔',
    status: 'published',
    scheduledAt: null,
    views: 0,
    createdAt: now,
    updatedAt: now,
    isDefault: true
  }
  writeJSON(KEYS.POSTS, [defaultPost])

  // 确保默认分类存在
  const cats = readJSON(KEYS.CATEGORIES, null)
  if (!cats || !Array.isArray(cats) || cats.length === 0) {
    writeJSON(KEYS.CATEGORIES, [...DEFAULT_CATEGORIES, '随笔'])
  } else if (!cats.includes('随笔')) {
    writeJSON(KEYS.CATEGORIES, [...cats, '随笔'])
  }
}

const DEFAULT_PAGE_CONTENT = `<h2>关于本博客</h2>
<p>这是一个使用纯前端技术构建的博客系统，数据存储在浏览器本地 (localStorage)，无需后端服务器即可运行。</p>
<h3>技术栈</h3>
<ul>
  <li>React + Vite 构建单页面应用</li>
  <li>WangEditor 富文本编辑器</li>
  <li>DOMPurify 防 XSS 攻击</li>
  <li>WebDAV 云端备份支持</li>
</ul>
<h3>功能特性</h3>
<ul>
  <li>文章发布、草稿、定时发布</li>
  <li>分类与标签管理</li>
  <li>评论审核与回复</li>
  <li>暗黑模式</li>
  <li>响应式布局，适配移动端</li>
  <li>SEO 优化 (动态 title / meta)</li>
</ul>
<h3>数据说明</h3>
<p>所有博客数据（文章、页面、评论、分类、设置）均存储在浏览器的 localStorage 中。建议定期使用「备份恢复」功能导出数据到本地或 WebDAV 云端，避免清除浏览器缓存时丢失数据。</p>
<blockquote><p>这个页面是系统自动创建的示例页面，你可以在管理后台的「页面管理」中编辑或删除它。</p></blockquote>`

function seedDefaultPages() {
  const existing = readJSON(KEYS.PAGES, null)
  if (existing && Array.isArray(existing) && existing.length > 0) return

  const now = Date.now()
  const defaultPage = {
    id: now + 1,
    title: '关于博客',
    slug: 'about',
    content: DEFAULT_PAGE_CONTENT,
    contentFormat: 'html',
    published: true,
    createdAt: now,
    updatedAt: now,
    isDefault: true
  }
  writeJSON(KEYS.PAGES, [defaultPage])
}

// 启动时初始化默认数据 + 检查定时发布
if (typeof window !== 'undefined') {
  seedDefaultData()
  seedDefaultPages()
  DataStore.Posts.checkScheduled()
  setInterval(() => DataStore.Posts.checkScheduled(), 60000)
}
