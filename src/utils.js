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

// 从 markdown 内容提取摘要 (取前 N 个字符,去除标记)
export function excerptFromContent(content, length = 120) {
  const text = String(content || '')
    .replace(/^#+\s*/gm, '')
    .replace(/[*_`>~]/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > length ? text.slice(0, length) + '…' : text
}
