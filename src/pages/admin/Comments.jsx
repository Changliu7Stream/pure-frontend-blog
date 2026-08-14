import { useEffect, useMemo, useState } from 'react'
import { DataStore } from '../../datastore.js'
import { useDocumentMeta } from '../../useDocumentMeta.js'
import { formatDate } from '../../utils.js'
import {
  CheckIcon, XIcon, ReplyIcon, TrashIcon, ClockIcon, FileTextIcon, SearchIcon
} from '../../icons.jsx'
import { useToast } from '../../components/Toast.jsx'

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待审' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已拒绝' }
]

const STATUS_META = {
  pending: { text: '待审核', bg: 'var(--warn-soft)', color: 'var(--warn)' },
  approved: { text: '已通过', bg: 'var(--ok-soft)', color: 'var(--ok)' },
  rejected: { text: '已拒绝', bg: 'var(--danger-soft)', color: 'var(--danger)' }
}

const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '16px 18px',
  boxShadow: 'var(--shadow)'
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 500,
        background: meta.bg,
        color: meta.color,
        whiteSpace: 'nowrap'
      }}
    >
      {meta.text}
    </span>
  )
}

export default function Comments({ navigate }) {
  useDocumentMeta({ title: '评论管理', siteTitle: '管理后台' })
  const toast = useToast()

  const [comments, setComments] = useState([])
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [filter, setFilter] = useState('all')
  const [postFilter, setPostFilter] = useState('all') // 'all' | postId
  const [replyingId, setReplyingId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [fieldError, setFieldError] = useState('')
  // 批量选择
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  const reload = () => {
    setComments(DataStore.Comments.getAll())
    setCounts(DataStore.Comments.getCounts())
  }

  useEffect(() => {
    reload()
  }, [])

  // 已发布帖子列表 (供下拉筛选)
  const publishedPosts = useMemo(() => {
    return DataStore.Posts.getAll({ includeUnpublished: false })
  }, [comments]) // 评论变化时刷新,以便拿到最新文章列表

  // 三重过滤: 状态 / 文章
  const filtered = useMemo(() => {
    let list = comments
    if (filter !== 'all') list = list.filter((c) => c.status === filter)
    if (postFilter !== 'all') list = list.filter((c) => Number(c.postId) === Number(postFilter))
    return list
  }, [comments, filter, postFilter])

  // 切换筛选时清空选择 (避免选了已不可见的项)
  useEffect(() => {
    setSelectedIds(new Set())
  }, [filter, postFilter])

  const onApprove = (id) => {
    try {
      DataStore.Comments.approve(id)
      reload()
    } catch (err) {
      toast.error('操作失败: ' + (err.message || err))
    }
  }

  const onReject = (id) => {
    try {
      DataStore.Comments.reject(id)
      reload()
    } catch (err) {
      toast.error('操作失败: ' + (err.message || err))
    }
  }

  const onDelete = (comment) => {
    if (!window.confirm('确定删除该评论?此操作不可恢复。')) return
    try {
      DataStore.Comments.delete(comment.id)
      if (replyingId === comment.id) {
        setReplyingId(null)
        setReplyText('')
      }
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(comment.id)
        return next
      })
      reload()
    } catch (err) {
      toast.error('删除失败: ' + (err.message || err))
    }
  }

  // ============ 批量选择 ============
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visibleIds = useMemo(() => filtered.map((c) => c.id), [filtered])
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id))

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id))
      } else {
        visibleIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const onBatchDelete = () => {
    if (selectedIds.size === 0) return
    const cnt = selectedIds.size
    if (!window.confirm(`确定批量删除选中的 ${cnt} 条评论?此操作不可恢复。`)) return
    try {
      const result = DataStore.Comments.batchDelete(Array.from(selectedIds))
      // 退出可能正在进行的回复编辑
      if (replyingId && selectedIds.has(replyingId)) {
        setReplyingId(null)
        setReplyText('')
      }
      clearSelection()
      reload()
      if (result.deleted > 0) {
        toast.success(`已删除 ${result.deleted} 条评论${result.missing ? `,${result.missing} 条未找到` : ''}。`)
      } else {
        toast.error('未删除任何评论。')
      }
    } catch (err) {
      toast.error('批量删除失败: ' + (err.message || err))
    }
  }

  const startReply = (comment) => {
    setReplyingId(comment.id)
    setReplyText(comment.reply || '')
    setFieldError('')
  }

  const cancelReply = () => {
    setReplyingId(null)
    setReplyText('')
    setFieldError('')
  }

  const submitReply = (id) => {
    if (!replyText.trim()) { setFieldError('请输入回复内容'); return }
    try {
      DataStore.Comments.reply(id, replyText)
      cancelReply()
      reload()
    } catch (err) {
      toast.error(err.message || '回复失败')
    }
  }

  const goEditPost = (postId) => navigate(`/admin/edit/${postId}`)

  return (
    <div className="admin-comments">
      <div className="dashboard-header">
        <div>
          <h2>评论管理</h2>
          <p className="muted">
            共 {counts.total} 条评论 · 待审 {counts.pending} 条
            {filtered.length !== comments.length && (
              <span> · 当前筛选显示 {filtered.length} 条</span>
            )}
          </p>
        </div>
      </div>

      {/* 状态筛选 */}
      <div className="segmented" style={{ flexWrap: 'wrap', width: 'max-content' }}>
        {FILTERS.map((f) => {
          const count = f.key === 'all' ? counts.total : counts[f.key]
          return (
            <button
              key={f.key}
              type="button"
              className={`seg-btn ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} ({count})
            </button>
          )
        })}
      </div>

      {/* 按文章筛选 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          margin: '12px 0 8px'
        }}
      >
        <SearchIcon size={14} />
        <span className="muted small">按文章筛选:</span>
        <select
          className="input"
          style={{ width: 'auto', minWidth: 200, padding: '4px 10px' }}
          value={postFilter}
          onChange={(e) => setPostFilter(e.target.value)}
        >
          <option value="all">全部文章 ({comments.length})</option>
          {publishedPosts.map((p) => {
            const cnt = comments.filter((c) => Number(c.postId) === Number(p.id)).length
            return (
              <option key={p.id} value={p.id}>
                {p.title} ({cnt})
              </option>
            )
          })}
        </select>
        {postFilter !== 'all' && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setPostFilter('all')}
          >
            <XIcon size={12} /> 清除筛选
          </button>
        )}
      </div>

      {/* 批量操作工具栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          margin: '4px 0 14px',
          background: selectedIds.size > 0 ? 'var(--primary-soft)' : 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          flexWrap: 'wrap',
          transition: 'background 0.2s'
        }}
      >
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            cursor: filtered.length > 0 ? 'pointer' : 'not-allowed',
            color: filtered.length > 0 ? 'var(--text)' : 'var(--muted)'
          }}
        >
          <input
            type="checkbox"
            disabled={filtered.length === 0}
            checked={allVisibleSelected}
            ref={(el) => {
              if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected
            }}
            onChange={toggleSelectAllVisible}
          />
          <span className="small">
            {allVisibleSelected
              ? `已全选 ${visibleIds.length} 条`
              : someVisibleSelected
                ? '部分已选'
                : '全选当前筛选'}
          </span>
        </label>

        <span className="muted small" style={{ marginLeft: 'auto' }}>
          {selectedIds.size > 0
            ? `已选中 ${selectedIds.size} 条`
            : '提示: 勾选评论后可批量删除'}
        </span>

        <button
          type="button"
          className="btn btn-sm btn-danger"
          disabled={selectedIds.size === 0}
          onClick={onBatchDelete}
        >
          <TrashIcon size={14} /> 批量删除{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
        </button>
        {selectedIds.size > 0 && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={clearSelection}
          >
            <XIcon size={12} /> 取消选择
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>暂无评论。</p>
        </div>
      ) : (
        <div className="post-list" style={{ gap: 12 }}>
          {filtered.map((comment) => {
            const post = DataStore.Posts.getById(comment.postId)
            const isSelected = selectedIds.has(comment.id)
            return (
              <div
                key={comment.id}
                style={{
                  ...cardStyle,
                  borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                  background: isSelected ? 'var(--primary-soft)' : 'var(--surface)'
                }}
              >
                <div
                  className="post-card-top"
                  style={{ marginBottom: 10, justifyContent: 'space-between' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(comment.id)}
                      aria-label={`选择评论 ${comment.id}`}
                    />
                    <strong>{comment.author || '匿名访客'}</strong>
                    {comment.email && (
                      <span className="muted small">{comment.email}</span>
                    )}
                  </span>
                  <StatusBadge status={comment.status} />
                </div>

                <div
                  style={{
                    margin: '0 0 10px',
                    color: 'var(--text)',
                    fontSize: 14,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {comment.content}
                </div>

                <div className="post-card-meta" style={{ marginBottom: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <FileTextIcon size={14} />
                    {post ? (
                      <a
                        href={`#/admin/edit/${comment.postId}`}
                        onClick={(e) => {
                          e.preventDefault()
                          goEditPost(comment.postId)
                        }}
                        style={{ color: 'var(--primary)', textDecoration: 'none' }}
                      >
                        {post.title}
                      </a>
                    ) : (
                      <span className="muted">文章已删除</span>
                    )}
                  </span>
                  <span
                    className="muted small"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <ClockIcon size={13} /> {formatDate(comment.createdAt)}
                  </span>
                </div>

                {comment.reply && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '10px 12px',
                      background: 'var(--primary-soft)',
                      borderLeft: '3px solid var(--primary)',
                      borderRadius: '6px',
                      fontSize: 13,
                      color: 'var(--text)'
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        marginBottom: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <ReplyIcon size={13} /> 博主回复
                      {comment.replyAt && (
                        <span className="muted small" style={{ fontWeight: 400 }}>
                          · {formatDate(comment.replyAt)}
                        </span>
                      )}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {comment.reply}
                    </div>
                  </div>
                )}

                {replyingId === comment.id && (
                  <div
                    style={{
                      marginTop: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    <textarea
                      className="input"
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="输入回复内容…"
                    />
                    {fieldError && <div className="alert alert-error">{fieldError}</div>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => submitReply(comment.id)}
                      >
                        <CheckIcon size={14} /> 提交回复
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={cancelReply}
                      >
                        <XIcon size={14} /> 取消
                      </button>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 10,
                    flexWrap: 'wrap'
                  }}
                >
                  {comment.status !== 'approved' && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => onApprove(comment.id)}
                    >
                      <CheckIcon size={14} /> 通过
                    </button>
                  )}
                  {comment.status !== 'rejected' && (
                    <button className="btn btn-sm" onClick={() => onReject(comment.id)}>
                      <XIcon size={14} /> 拒绝
                    </button>
                  )}
                  <button className="btn btn-sm" onClick={() => startReply(comment)}>
                    <ReplyIcon size={14} /> {comment.reply ? '修改回复' : '回复'}
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => onDelete(comment)}
                  >
                    <TrashIcon size={14} /> 删除
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
