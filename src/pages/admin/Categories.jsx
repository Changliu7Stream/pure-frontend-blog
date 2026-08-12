import { useCallback, useEffect, useState } from 'react'
import { DataStore } from '../../datastore.js'
import { useDocumentMeta } from '../../useDocumentMeta.js'
import {
  PlusIcon, EditIcon, TrashIcon, FolderIcon, CheckIcon, XIcon
} from '../../icons.jsx'

const successStyle = {
  background: 'rgba(34, 197, 94, 0.12)',
  color: '#16a34a',
  border: '1px solid rgba(34, 197, 94, 0.3)'
}

export default function Categories({ navigate }) {
  useDocumentMeta({ title: '分类管理', siteTitle: '管理后台' })

  const [categories, setCategories] = useState([])
  const [newName, setNewName] = useState('')
  const [editingName, setEditingName] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const reload = useCallback(() => {
    setCategories(DataStore.Categories.getWithCounts())
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const onAdd = (e) => {
    e.preventDefault()
    const n = newName.trim()
    if (!n) return
    setError('')
    setNotice('')
    try {
      DataStore.Categories.add(n)
      setNewName('')
      reload()
      setNotice(`已添加分类「${n}」`)
    } catch (err) {
      setError(err.message || '添加失败')
    }
  }

  const startEdit = (name) => {
    setEditingName(name)
    setEditValue(name)
    setError('')
    setNotice('')
  }

  const cancelEdit = () => {
    setEditingName(null)
    setEditValue('')
  }

  const saveEdit = (oldName) => {
    const n = editValue.trim()
    if (!n) {
      setError('分类名不能为空')
      return
    }
    setError('')
    try {
      DataStore.Categories.rename(oldName, n)
      setEditingName(null)
      setEditValue('')
      reload()
      setNotice(
        oldName === n
          ? `分类「${n}」未变更`
          : `已将「${oldName}」重命名为「${n}」,关联文章已同步更新`
      )
    } catch (err) {
      setError(err.message || '重命名失败')
    }
  }

  const onDelete = (name) => {
    // 统计所有受影响文章(含草稿),以提供准确的迁移提示
    const allPosts = DataStore.Posts.getAll({ includeUnpublished: true })
    const affected = allPosts.filter(
      (p) => (p.category || '未分类') === name
    ).length
    const msg = affected > 0
      ? `确定删除分类「${name}」?\n该分类下共有 ${affected} 篇文章,删除后将自动移动到「未分类」。`
      : `确定删除分类「${name}」?此操作不可恢复。`
    if (!window.confirm(msg)) return
    setError('')
    setNotice('')
    try {
      DataStore.Categories.delete(name)
      if (editingName === name) cancelEdit()
      reload()
      setNotice(
        affected > 0
          ? `已删除分类「${name}」,${affected} 篇文章已移至「未分类」`
          : `已删除分类「${name}」`
      )
    } catch (err) {
      setError(err.message || '删除失败')
    }
  }

  const totalArticles = categories.reduce((sum, c) => sum + c.count, 0)

  return (
    <div className="admin-categories">
      <div className="editor-header">
        <div>
          <h2>分类管理</h2>
          <p className="muted">
            共 {categories.length} 个分类,关联 {totalArticles} 篇已发布文章
          </p>
        </div>
        <button className="btn btn-link" onClick={() => navigate('/admin')}>
          ← 返回后台
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert" style={successStyle}>{notice}</div>}

      <form className="category-add-form" onSubmit={onAdd} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          className="input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="输入新分类名称…"
          maxLength={30}
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary" disabled={!newName.trim()}>
          <PlusIcon size={15} /> 添加分类
        </button>
      </form>

      {categories.length === 0 ? (
        <div className="empty-state">
          <p>还没有分类,在上方添加第一个分类吧。</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>分类名称</th>
                <th style={{ width: 100 }}>文章数</th>
                <th className="col-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.name}>
                  <td className="cell-title">
                    {editingName === c.name ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="text"
                          className="input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          maxLength={30}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(c.name)
                            if (e.key === 'Escape') cancelEdit()
                          }}
                          style={{ maxWidth: 280 }}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => saveEdit(c.name)}
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
                      <span className="cat-badge">
                        <FolderIcon size={13} /> {c.name}
                      </span>
                    )}
                  </td>
                  <td>{c.count}</td>
                  <td className="col-actions">
                    {editingName === c.name ? (
                      <span className="muted">编辑中…</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => startEdit(c.name)}
                          title="重命名"
                        >
                          <EditIcon size={14} /> 重命名
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => onDelete(c.name)}
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
    </div>
  )
}
