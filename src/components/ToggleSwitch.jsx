/**
 * 滑动开关组件
 * 可拖拽的 toggle switch，比点击更直观
 */
import { useState, useRef, useCallback } from 'react'

export default function ToggleSwitch({ checked, onChange, disabled = false, size = 'md' }) {
  const [isDragging, setIsDragging] = useState(false)
  const trackRef = useRef(null)
  const dragStartX = useRef(0)
  const trackWidth = useRef(0)
  const knobSize = useRef(0)

  const handleTouchStart = useCallback((e) => {
    if (disabled) return
    const touch = e.touches[0]
    dragStartX.current = touch.clientX
    if (trackRef.current) {
      trackWidth.current = trackRef.current.offsetWidth
      knobSize.current = trackRef.current.querySelector('.toggle-knob').offsetWidth
    }
    setIsDragging(true)
  }, [disabled])

  const handleMouseDown = useCallback((e) => {
    if (disabled) return
    dragStartX.current = e.clientX
    if (trackRef.current) {
      trackWidth.current = trackRef.current.offsetWidth
      knobSize.current = trackRef.current.querySelector('.toggle-knob').offsetWidth
    }
    setIsDragging(true)
    e.preventDefault()
  }, [disabled])

  const handleTouchMove = useCallback((e) => {
    if (!isDragging || disabled) return
    const touch = e.touches[0]
    const delta = touch.clientX - dragStartX.current
    const maxOffset = (trackWidth.current - knobSize.current) || 20
    const percent = Math.max(0, Math.min(1, 0.5 + delta / maxOffset))
    const shouldSwitch = percent > 0.5
    if (shouldSwitch !== checked) {
      onChange(!checked)
    }
  }, [isDragging, disabled, checked, onChange])

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || disabled) return
    const delta = e.clientX - dragStartX.current
    const maxOffset = (trackWidth.current - knobSize.current) || 20
    const percent = Math.max(0, Math.min(1, 0.5 + delta / maxOffset))
    const shouldSwitch = percent > 0.5
    if (shouldSwitch !== checked) {
      onChange(!checked)
    }
  }, [isDragging, disabled, checked, onChange])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // 全局监听 mouseup/touchend
  useState(() => {
    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('touchend', handleTouchEnd)
      return () => {
        document.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('touchend', handleTouchEnd)
      }
    }
  })

  const sizeClasses = {
    sm: { track: 'w-8 h-4', knob: 'w-3 h-3', translate: 'translate-x-4' },
    md: { track: 'w-11 h-6', knob: 'w-5 h-5', translate: 'translate-x-5' },
    lg: { track: 'w-14 h-7', knob: 'w-6 h-6', translate: 'translate-x-7' }
  }[size]

  return (
    <div
      ref={trackRef}
      className={`toggle-track ${sizeClasses.track} ${disabled ? 'opacity-50 cursor-not-allowed' : isDragging ? 'cursor-grabbing' : 'cursor-pointer'} relative rounded-full transition-colors duration-200 ${checked ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onChange(!checked) }}
    >
      <div
        className={`toggle-knob ${sizeClasses.knob} absolute top-1/2 -translate-y-1/2 left-1 bg-white rounded-full shadow-md transition-all duration-200 ${checked ? sizeClasses.translate : ''} ${isDragging ? 'scale-110' : ''}`}
      />
    </div>
  )
}

// CSS 样式通过内联 style 添加，避免全局样式污染
const style = document.createElement('style')
style.textContent = `
  .toggle-track { user-select: none; touch-action: none; }
  .toggle-knob { transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), width 0.2s, height 0.2s; }
`
if (typeof document !== 'undefined') {
  document.head.appendChild(style)
}
