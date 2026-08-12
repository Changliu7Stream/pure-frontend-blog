// 工具函数
export function formatDate(timestamp) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDateShort(timestamp) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatYearMonth(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}年${pad(d.getMonth() + 1)}月`
}

// 从内容中提取纯文本 (同时支持 Markdown 与 HTML 输入)
export function stripToPlainText(content) {
  if (!content) return ''
  const s = String(content)
  // 若包含 <p> <div> 等标签,走 HTML 剥离分支
  if (/<[a-z][\s\S]*>/i.test(s)) {
    try {
      // DOMParser 安全环境下使用
      const tmp = document.createElement('div')
      tmp.innerHTML = s
      return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim()
    } catch {
      return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }
  }
  // Markdown 剥离
  return s
    .replace(/^#+\s*/gm, '')
    .replace(/[*_`>~-]/g, ' ')
    .replace(/!\[.*?\]\(.*?\)/g, ' ')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// 从内容提取摘要
export function excerptFromContent(content, length = 120) {
  const text = stripToPlainText(content)
  return text.length > length ? text.slice(0, length) + '…' : text
}
