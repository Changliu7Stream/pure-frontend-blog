import { useCallback, useEffect, useMemo, useState } from 'react'
import { DataStore } from '../../datastore.js'
import { useDocumentMeta } from '../../useDocumentMeta.js'
import { useToast } from '../../components/Toast.jsx'
import {
  EditIcon, TrashIcon, MergeIcon, TagIcon, CheckIcon, XIcon
} from '../../icons.jsx'

// 标签云字号区间
const MIN_FONT = 13
const MAX_FONT = 26

export default function Tags({ navigate }) {
  useDocumentMeta({ title: '标签管理', siteTitle: '管理后台' })
  const toast = useToast()

  const [tags, setTags] = useState([])
  const [editingName, setEditingName] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [mergeSource, setMergeSource] = useState('')
  const [mergeTarget, setMergeTarget] = useState('')

  const reload = useCallback(() => {
    setTags(DataStore.Tags.getAll())
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // 标签云字号映射
  const fontFor = useMemo(() => {
    const counts = tags.map((t) => t.count)
    const max = Math.max(...counts, 1)
    const min = Math.min(...counts, 0)
    const range = max - min || 1
    return (count) =>
      MIN_FONT + ((count - min) / range) * (MAX_FONT - MIN_FONT)
  }, [tags])

  const totalUsages = tags.reduce((sum, t) => sum + t.count, 0)

  const startEdit = (name) => {
    setEditingName(name)
    setEditValue(name)
  }

  const cancelEdit = () => {
    setEditingName(null)
    setEditValue('')
  }

  const saveEdit = (oldName) => {
    const n = editValue.trim()
    if (!n) {
      toast.error('标签名不能为空')
      return
    }
    try {
      DataStore.Tags.rename(oldName, n)
      setEditingName(null)
      setEditValue('')
      reload()
      if (oldName === n) {
        toast.info(`标签「${n}」未变更`)
      } else {
        toast.success(`已将标签「${oldName}」重命名为「${n}」,所有相关文章已更新`)
      }
    } catch (err) {
      toast.error(err.message || '重命名失败')
    }
  }

  const onDelete = (name) => {
    const item = tags.find((t) => t.name === name)
    const affected = item ? item.count : 0
    const msg = affected > 0
      ? `确定删除标签「${name}」?\n该标签被 ${affected} 篇文章使用,删除后将从这些文章中移除。`
      : `确定删除标签「${name}」?此操作不可恢复。`
    if (!window.confirm(msg)) return
    try {
      DataStore.Tags.delete(name)
      if (editingName === name) cancelEdit()
      if (mergeSource === name) setMergeSource('')
      if (mergeTarget === name) setMergeTarget('')
      reload()
      if (affected > 0) {
        toast.success(`已删除标签「${name}」,已从 ${affected} 篇文章中移除`)
      } else {
        toast.success(`已删除标签「${name}」`)
      }
    } catch (err) {
      toast.error(err.message || '删除失败')
    }
  }

  const onMerge = () => {
    const s = mergeSource.trim()
    const t = mergeTarget.trim()
    if (!s || !t) {
      toast.error('请选择源标签和目标标签')
      return
    }
    if (s === t) {
      toast.error('源标签与目标标签不能相同')
      return
    }
    const sourceItem = tags.find((x) => x.name === s)
    const affected = sourceItem ? sourceItem.count : 0
    const msg = `确定将标签「${s}」合并到「${t}」?\n`
      + `共 ${affected} 篇文章中的「${s}」标签将被替换为「${t}」(已包含「${t}」的文章将仅移除「${s}」)。`
    if (!window.confirm(msg)) return
    try {
      DataStore.Tags.merge(s, t)
      setMergeSource('')
      setMergeTarget('')
      reload()
      toast.success(`已将标签「${s}」合并到「${t}」,所有相关文章已更新`)
    } catch (err) {
      toast.error(err.message || '合并失败')
    }
  }

  const mergeable = tags.length >= 2

  return (
    <div className="admin-tags">
      <div className="editor-header">
        <div>
          <h2>标签管理</h2>
          <p className="muted">
            共 {tags.length} 个标签,累计使用 {totalUsages} 次
          </p>
        </div>
        <button className="btn btn-link" onClick={() => navigate('/admin')}>
          ← 返回后台
        </button>
      </div>

      {/* 标签云 */}
      <section style={{ marginBottom: 24 }}>
        <h3 className="section-title" style={{ marginBottom: 10 }}>
          <TagIcon size={16} /> 标签云
        </h3>
        {tags.length === 0 ? (
          <p className="muted">还没有标签。文章添加标签后会在此显示。</p>
        ) : (
          <div
            className="tag-cloud"
            style={{
              padding: 16,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              alignItems: 'center',
              gap: 4
            }}
          >
            {tags.map((t) => (
              <span
                key={t.name}
                className="tag-chip"
                title={`${t.name} · ${t.count} 篇文章`}
                style={{
                  fontSize: fontFor(t.count),
                  lineHeight: 1.4,
                  cursor: 'default'
                }}
              >
                #{t.name} <span className="count">({t.count})</span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 合并标签 */}
      <section style={{ marginBottom: 24 }}>
        <h3 className="section-title" style={{ marginBottom: 10 }}>
          <MergeIcon size={16} /> 合并标签
        </h3>
        {!mergeable ? (
          <p className="muted">至少需要 2 个标签才能进行合并操作。</p>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
              padding: 16,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)'
            }}
          >
            <label className="form-label" style={{ margin: 0, flex: '1 1 160px', minWidth: 160 }}>
              <span className="muted" style={{ fontSize: 12 }}>源标签(将被合并)</span>
              <select
                className="input"
                value={mergeSource}
                onChange={(e) => setMergeSource(e.target.value)}
              >
                <option value="">选择源标签…</option>
                {tags.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.count})
                  </option>
                ))}
              </select>
            </label>
            <span className="muted" style={{ padding: '0 4px' }}>→</span>
            <label className="form-label" style={{ margin: 0, flex: '1 1 160px', minWidth: 160 }}>
              <span className="muted" style={{ fontSize: 12 }}>目标标签(保留)</span>
              <select
                className="input"
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
              >
                <option value="">选择目标标签…</option>
                {tags.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.count})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onMerge}
              disabled={!mergeSource || !mergeTarget || mergeSource === mergeTarget}
              style={{ alignSelf: 'flex-end' }}
            >
              <MergeIcon size={15} /> 合并
            </button>
          </div>
        )}
      </section>

      {/* 标签列表 */}
      <section>
        <h3 className="section-title" style={{ marginBottom: 10 }}>
          <TagIcon size={16} /> 全部标签
        </h3>
        {tags.length === 0 ? (
          <div className="empty-state">
            <p>还没有标签。</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>标签名称</th>
                  <th style={{ width: 100 }}>使用次数</th>
                  <th className="col-actions">操作</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((t) => (
                  <tr key={t.name}>
                    <td className="cell-title">
                      {editingName === t.name ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="text"
                            className="input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            maxLength={30}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(t.name)
                              if (e.key === 'Escape') cancelEdit()
                            }}
                            style={{ maxWidth: 280 }}
                          />
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => saveEdit(t.name)}
                            title="保存"
                          >
                            <CheckIcon size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={cancelEdit}
                            title="取消"
                          >
                            <XIcon size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="tag-sm">#{t.name}</span>
                      )}
                    </td>
                    <td>{t.count}</td>
                    <td className="col-actions">
                      {editingName === t.name ? (
                        <span className="muted">编辑中…</span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => startEdit(t.name)}
                            title="重命名"
                          >
                            <EditIcon size={14} /> 重命名
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => onDelete(t.name)}
                            title="删除"
                          >
                            <TrashIcon size={14} /> 删除
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
