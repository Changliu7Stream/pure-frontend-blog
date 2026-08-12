import { useState, useRef, useEffect, useMemo } from 'react'
import { logout } from '../auth.js'
import { useTheme, THEMES } from '../theme.jsx'
import { DataStore } from '../datastore.js'
import {
  HomeIcon, ArchiveIcon, SunIcon, MoonIcon, LogoutIcon, LoginIcon,
  MenuIcon, XIcon, LayersIcon, SearchIcon
} from '../icons.jsx'

/**
 * 优先级搜索: 标题匹配 > 标签匹配 > 正文匹配
 * 返回最多 limit 条结果,每条带 score 用于排序
 */
function searchPosts(posts, keyword, limit = 5) {
  const k = String(keyword || '').trim().toLowerCase()
  if (!k) return []
  const results = []
  for (const p of posts) {
    const title = (p.title || '').toLowerCase()
    const tags = (p.tags || []).join(' ').toLowerCase()
    const content = String(p.content || '').replace(/<[^>]+>/g, ' ').toLowerCase()
    const excerpt = (p.excerpt || '').toLowerCase()

    let score = 0
    if (title.includes(k)) score += 100
    if (tags.includes(k)) score += 50
    if (excerpt.includes(k)) score += 20
    if (content.includes(k)) score += 10

    if (score > 0) {
      results.push({ ...p, _score: score })
    }
  }
  results.sort((a, b) => b._score - a._score)
  return results.slice(0, limit)
}

export default function Navbar({ siteTitle, authed, navigate, currentPath }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === THEMES.DARK
  const [menuOpen, setMenuOpen] = useState(false)

  // ---- 搜索状态 ----
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef(null)
  const searchInputRef = useRef(null)

  // 读取已发布的独立页面 (导航栏显示)
  const pages = DataStore.Pages.getPublished()

  // 所有已发布文章 (搜索数据源)
  const allPosts = useMemo(() => DataStore.Posts.getAll(), [])

  // 搜索结果
  const searchResults = useMemo(() => {
    return searchPosts(allPosts, searchQuery, 5)
  }, [allPosts, searchQuery])

  // 点击搜索图标: 切换展开/收起
  const toggleSearch = () => {
    setSearchOpen((prev) => {
      const next = !prev
      if (next) {
        // 展开时聚焦输入框
        setTimeout(() => searchInputRef.current?.focus(), 50)
      } else {
        // 收起时清空
        setSearchQuery('')
      }
      return next
    })
  }

  // 点击外部区域收起搜索
  useEffect(() => {
    if (!searchOpen) return
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [searchOpen])

  // 按 Esc 收起搜索
  useEffect(() => {
    if (!searchOpen) return
    const onKeydown = (e) => {
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setSearchQuery('')
        searchInputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', onKeydown)
    return () => document.removeEventListener('keydown', onKeydown)
  }, [searchOpen])

  // 路由变化时收起搜索
  useEffect(() => {
    setSearchOpen(false)
    setSearchQuery('')
  }, [currentPath])

  const onLogout = () => {
    logout()
    navigate('/')
  }

  const onSearchResultClick = (post) => {
    navigate(`/post/${encodeURIComponent(post.slug)}`)
    setSearchOpen(false)
    setSearchQuery('')
  }

  const onSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchResults.length > 0) {
      // 回车跳转到第一个结果
      onSearchResultClick(searchResults[0])
    }
  }

  const navLink = (to, label, icon, matchPrefix = false) => {
    const active = matchPrefix
      ? currentPath.startsWith(to)
      : currentPath === to || (to === '/' && currentPath === '')
    return (
      <a
        href={`#${to}`}
        className={active ? 'nav-link active' : 'nav-link'}
        onClick={(e) => { e.preventDefault(); navigate(to); setMenuOpen(false) }}
      >
        {icon}
        <span>{label}</span>
      </a>
    )
  }

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <a href="#/" className="brand" onClick={(e) => { e.preventDefault(); navigate('/') }}>
          <span className="brand-logo">
            <HomeIcon size={22} />
          </span>
          <span className="brand-text">{siteTitle}</span>
        </a>

        <div className="nav-right-group">
          {/* 搜索图标 + 下拉面板 */}
          <div className="nav-search-wrapper" ref={searchRef}>
            <button
              type="button"
              className={`nav-search-toggle ${searchOpen ? 'active' : ''}`}
              onClick={toggleSearch}
              aria-label="搜索"
              title="搜索文章"
            >
              <SearchIcon size={20} />
            </button>

            {/* 下拉搜索面板 */}
            {searchOpen && (
              <div className="nav-search-dropdown">
                <div className="nav-search-input-wrap">
                  <SearchIcon size={16} className="nav-search-input-icon" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    className="nav-search-input"
                    placeholder="搜索文章标题、标签、内容…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={onSearchKeyDown}
                  />
                </div>

                {searchQuery.trim() && (
                  <div className="nav-search-results">
                    {searchResults.length > 0 ? (
                      searchResults.map((post) => (
                        <button
                          key={post.id}
                          type="button"
                          className="nav-search-result-item"
                          onClick={() => onSearchResultClick(post)}
                        >
                          <span className="nav-search-result-title">{post.title}</span>
                          {post.category && (
                            <span className="nav-search-result-cat">{post.category}</span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="nav-search-no-result">未找到相关文章</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            className="nav-menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="菜单"
          >
            {menuOpen ? <XIcon size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>

        <nav className={`nav-links ${menuOpen ? 'open' : ''}`}>
          {navLink('/', '首页', <HomeIcon size={16} />)}
          {navLink('/archive', '归档', <ArchiveIcon size={16} />)}
          {pages.map((page) => (
            <a
              key={page.id}
              href={`#/page/${encodeURIComponent(page.slug)}`}
              className={currentPath === `/page/${page.slug}` ? 'nav-link active' : 'nav-link'}
              onClick={(e) => { e.preventDefault(); navigate(`/page/${encodeURIComponent(page.slug)}`); setMenuOpen(false) }}
            >
              <LayersIcon size={16} />
              <span>{page.title}</span>
            </a>
          ))}
          {authed ? (
            <>
              {navLink('/admin', '管理后台', null, true)}
              <button className="nav-link nav-btn" onClick={onLogout}>
                <LogoutIcon size={16} />
                <span>登出</span>
              </button>
            </>
          ) : (
            navLink('/admin/login', '管理员登录', <LoginIcon size={16} />)
          )}
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            title={isDark ? '切换到亮色' : '切换到暗色'}
            aria-label="切换主题"
          >
            {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </button>
        </nav>
      </div>

      {menuOpen && <div className="nav-overlay" onClick={() => setMenuOpen(false)} />}
    </header>
  )
}
