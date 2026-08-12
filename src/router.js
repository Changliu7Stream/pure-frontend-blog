// 极简 hash 路由 (避免引入 react-router 依赖)
import { useEffect, useState, useCallback } from 'react'

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const [path, queryString = ''] = raw.split('?')
  const query = new URLSearchParams(queryString)
  return { path, query }
}

export function useHashRoute() {
  const [route, setRoute] = useState(parseHash)

  useEffect(() => {
    const onChange = () => setRoute(parseHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((to) => {
    const target = to.startsWith('#') ? to : `#${to}`
    if (window.location.hash === target) {
      setRoute(parseHash())
    } else {
      window.location.hash = target
    }
    window.scrollTo(0, 0)
  }, [])

  return { route, navigate }
}

/**
 * 匹配路径参数, 例如 matchPath('/post/:slug', '/post/hello') => { slug: 'hello' }
 */
export function matchPath(pattern, path) {
  const pParts = pattern.split('/').filter(Boolean)
  const sParts = path.split('/').filter(Boolean)
  if (pParts.length !== sParts.length) return null
  const params = {}
  for (let i = 0; i < pParts.length; i++) {
    if (pParts[i].startsWith(':')) {
      params[pParts[i].slice(1)] = decodeURIComponent(sParts[i])
    } else if (pParts[i] !== sParts[i]) {
      return null
    }
  }
  return params
}
