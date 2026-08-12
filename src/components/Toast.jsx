import { createContext, useCallback, useContext, useState } from 'react'
import { CheckIcon, XIcon, AlertTriangleIcon } from '../icons.jsx'

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast 必须在 ToastProvider 内使用')
  return ctx
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((prev) => [...prev, { id, message, type }])
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
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
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} onClick={() => dismiss(t.id)}>
            <span className="toast-icon">
              {t.type === 'success' && <CheckIcon size={18} />}
              {t.type === 'error' && <XIcon size={18} />}
              {t.type === 'info' && <AlertTriangleIcon size={18} />}
            </span>
            <span className="toast-message">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
