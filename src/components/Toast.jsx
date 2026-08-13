import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CheckIcon, XIcon, AlertTriangleIcon, InfoIcon } from '../icons.jsx'

const ToastContext = createContext(null)

const MAX_VISIBLE = 3

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast 必须在 ToastProvider 内使用')
  return ctx
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

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
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    )
    const entry = timersRef.current.get(id)
    const removeTimer = setTimeout(() => removeToast(id), 320)
    if (entry) {
      if (entry.leaveTimer) clearTimeout(entry.leaveTimer)
      entry.leaveTimer = removeTimer
    } else {
      timersRef.current.set(id, { removeTimer })
    }
  }, [removeToast])

  const show = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.floor(Math.random() * 10000)

    setToasts((prev) => {
      const next = [...prev, { id, message, type, leaving: false }]
      if (next.length > MAX_VISIBLE) {
        const overflow = next.slice(0, next.length - MAX_VISIBLE)
        overflow.forEach((t) => {
          const entry = timersRef.current.get(t.id)
          if (entry?.autoTimer) clearTimeout(entry.autoTimer)
          removeToast(t.id)
        })
        return next.slice(next.length - MAX_VISIBLE)
      }
      return next
    })

    if (duration > 0) {
      const autoTimer = setTimeout(() => dismiss(id), duration)
      timersRef.current.set(id, { autoTimer })
    }
    return id
  }, [dismiss, removeToast])

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
        {toasts.map((t, index) => (
          <div
            key={t.id}
            className="toast-wrapper"
            style={{
              zIndex: 5000 + index,
              top: `${index * 12}px`,
              opacity: t.leaving ? 0 : 1 - (toasts.length - 1 - index) * 0.15
            }}
          >
            <div
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
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
