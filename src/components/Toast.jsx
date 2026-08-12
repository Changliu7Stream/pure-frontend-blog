import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CheckIcon, XIcon, AlertTriangleIcon, InfoIcon } from '../icons.jsx'

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast 必须在 ToastProvider 内使用')
  return ctx
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  // 清理所有定时器
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((t) => {
        clearTimeout(t.autoTimer)
        clearTimeout(t.leaveTimer)
        clearTimeout(t.removeTimer)
      })
      timers.clear()
    }
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    timersRef.current.delete(id)
  }, [])

  const dismiss = useCallback((id) => {
    // 先触发离开动画, 动画结束后再移除 DOM
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    )
    const entry = timersRef.current.get(id)
    const removeTimer = setTimeout(() => removeToast(id), 320)
    if (entry) {
      entry.leaveTimer = removeTimer
    } else {
      timersRef.current.set(id, { removeTimer })
    }
  }, [removeToast])

  const show = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.floor(Math.random() * 10000)
    setToasts((prev) => [...prev, { id, message, type, leaving: false }])

    if (duration > 0) {
      const autoTimer = setTimeout(() => dismiss(id), duration)
      timersRef.current.set(id, { autoTimer })
    }
    return id
  }, [dismiss])

  const toast = {
    show,
    success: (msg, duration) => show(msg, 'success', duration),
    error: (msg, duration) => show(msg, 'error', duration ?? 5000),
    info: (msg, duration) => show(msg, 'info', duration)
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type} ${t.leaving ? 'toast-leave' : 'toast-enter'}`}
            onClick={() => dismiss(t.id)}
            role="status"
          >
            <span className="toast-icon">
              {t.type === 'success' && <CheckIcon size={18} />}
              {t.type === 'error' && <XIcon size={18} />}
              {t.type === 'info' && <InfoIcon size={18} />}
              {t.type === 'warning' && <AlertTriangleIcon size={18} />}
            </span>
            <span className="toast-message">{t.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={(e) => { e.stopPropagation(); dismiss(t.id) }}
              aria-label="关闭"
            >
              <XIcon size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
