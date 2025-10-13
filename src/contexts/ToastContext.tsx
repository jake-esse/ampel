import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export type ToastType = 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
  dismissible?: boolean
}

interface ToastContextValue {
  toasts: Toast[]
  showToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

interface ToastProviderProps {
  children: ReactNode
}

const MAX_TOASTS = 3 // Maximum number of visible toasts

/**
 * Toast provider for managing toast notifications app-wide
 * Handles toast queue, auto-dismiss, and limits visible toasts
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2)

    const newToast: Toast = {
      id,
      type: toast.type,
      message: toast.message,
      duration: toast.duration ?? (toast.type === 'error' ? 4000 : 3000),
      dismissible: toast.dismissible ?? true,
    }

    setToasts((prev) => {
      // Add new toast
      const updated = [...prev, newToast]

      // Keep only last MAX_TOASTS
      if (updated.length > MAX_TOASTS) {
        return updated.slice(-MAX_TOASTS)
      }

      return updated
    })

    // Auto-dismiss after duration
    if (newToast.duration) {
      setTimeout(() => {
        dismissToast(id)
      }, newToast.duration)
    }
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  )
}

/**
 * Hook to access toast functionality
 * Use this in components to show toasts
 */
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
