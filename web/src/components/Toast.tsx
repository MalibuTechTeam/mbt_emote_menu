import { useState, useEffect, useCallback, useRef } from 'react'

export interface ToastMessage {
  id: string
  text: string
  type?: 'info' | 'success' | 'warning' | 'error'
  duration?: number
}

interface ToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

export function Toast({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="mbt-toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dismiss = useCallback(() => {
    setExiting(true)
    setTimeout(() => onDismiss(toast.id), 200)
  }, [toast.id, onDismiss])

  useEffect(() => {
    const dur = toast.duration ?? 2500
    timerRef.current = setTimeout(dismiss, dur)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [toast, dismiss])

  const typeClass = toast.type ? `mbt-toast--${toast.type}` : 'mbt-toast--info'

  return (
    <div className={`mbt-toast ${typeClass} ${exiting ? 'mbt-toast--exit' : ''}`} onClick={dismiss}>
      <span className="mbt-toast__dot" aria-hidden="true" />
      <span className="mbt-toast__text">{toast.text}</span>
    </div>
  )
}

// Hook for managing toast state
export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((text: string, type: ToastMessage['type'] = 'info', duration?: number) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    setToasts(prev => [...prev.slice(-4), { id, text, type, duration }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, dismissToast }
}

/**
 * Module-level toast bus. Lets any component fire a toast without
 * routing the toast state through a common ancestor. AmbientLayer
 * registers the live sink (its `useToasts().addToast`); `emitToast`
 * forwards to it (no-op if no AmbientLayer is mounted).
 */
type ToastSink = (text: string, type?: ToastMessage['type'], duration?: number) => void
let _toastSink: ToastSink | null = null

/** Register the active toast sink. Returns an unregister cleanup. */
export function setToastListener(sink: ToastSink): () => void {
  _toastSink = sink
  return () => { if (_toastSink === sink) _toastSink = null }
}

/** Fire a toast through the registered sink. */
export function emitToast(text: string, type?: ToastMessage['type'], duration?: number) {
  _toastSink?.(text, type, duration)
}