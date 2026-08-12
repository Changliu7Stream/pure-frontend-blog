import { useEffect, useState } from 'react'
import { DataStore } from '../../datastore.js'
import { useDocumentMeta } from '../../useDocumentMeta.js'
import { formatDate } from '../../utils.js'
import {
  CheckIcon, XIcon, ReplyIcon, TrashIcon, ClockIcon, FileTextIcon
} from '../../icons.jsx'

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

  const [comments, setComments] = useState([])
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [filter, setFilter] = useState('all')
  const [replyingId, setReplyingId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [error, setError] = useState('')

  const reload = () => {
    setComments(DataStore.Comments.getAll())
    setCounts(DataStore.Comments.getCounts())
  }

  useEffect(() => {
    reload()
  }, [])

  const filtered = filter === 'all'
    ? comments
    : comments.filter((c) => c.status === filter)

  const onApprove = (id) => {
    try {
      DataStore.Comments.approve(id)
      reload()
    } catch (err) {
      window.alert('操作失败: ' + (err.message || err))
    }
  }

  const onReject = (id) => {
    try {
      DataStore.Comments.reject(id)
      reload()
    } catch (err) {
      window.alert('操作失败: ' + (err.message || err))
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
      reload()
    } catch (err) {
      window.alert('删除失败: ' + (err.message || err))
    }
  }

  const startReply = (comment) => {
    setReplyingId(comment.id)
    setReplyText(comment.reply || '')
    setError('')
  }

  const cancelReply = () => {
    setReplyingId(null)
    setReplyText('')
    setError('')
  }

  const submitReply = (id) => {
    if (!replyText.trim()) { setError('请输入回复内容'); return }
    try {
      DataStore.Comments.reply(id, replyText)
      cancelReply()
      reload()
    } catch (err) {
      setError(err.message || '回复失败')
    }
  }

  const goEditPost = (postId) => navigate(`/admin/edit/${postId}`)

  return (
    <div className="admin-comments">
      <div className="dashboard-header">
        <div>
          <h2>评论管理</h2>
          <p className="muted">共 {counts.total} 条评论 · 待审 {counts.pending} 条</p>
        </div>
      </div>

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

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>暂无评论。</p>
        </div>
      ) : (
        <div className="post-list" style={{ gap: 12 }}>
          {filtered.map((comment) => {
            const post = DataStore.Posts.getById(comment.postId)
            return (
              <div key={comment.id} style={cardStyle}>
                <div
                  className="post-card-top"
                  style={{ marginBottom: 10, justifyContent: 'space-between' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
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
                    {error && <div className="alert alert-error">{error}</div>}
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
