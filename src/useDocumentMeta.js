// SEO: 动态设置 <title> 和 <meta name="description">
import { useEffect } from 'react'

function ensureMetaDescriptionTag() {
  if (typeof document === 'undefined') return null
  let el = document.querySelector('meta[name="description"]')
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', 'description')
    document.head.appendChild(el)
  }
  return el
}

export function useDocumentMeta({ title, description, siteTitle = '博客' }) {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${siteTitle}` : siteTitle
    if (document.title !== fullTitle) {
      document.title = fullTitle
    }
    if (description) {
      const meta = ensureMetaDescriptionTag()
      if (meta && meta.getAttribute('content') !== description) {
        meta.setAttribute('content', description)
      }
    }
  }, [title, description, siteTitle])
}
