import { useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Toast as ToastType } from '@/contexts/ToastContext'

interface ToastProps {
  toast: ToastType
  onDismiss: (id: string) => void
}

/**
 * Individual toast notification component
 * Slides in from top with smooth animation
 * Auto-dismisses after configured duration
 */
export function Toast({ toast, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)

  // Slide in animation on mount
  useEffect(() => {
    // Trigger animation on next frame (for smooth slide-in)
    const timer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = () => {
    // Slide out animation
    setIsVisible(false)
    // Remove from DOM after animation
    setTimeout(() => onDismiss(toast.id), 200)
  }

  // Icon based on toast type
  const Icon = toast.type === 'error'
    ? AlertCircle
    : toast.type === 'warning'
    ? AlertTriangle
    : Info

  // Colors based on toast type
  const bgColor = toast.type === 'error'
    ? 'bg-red-600'
    : toast.type === 'warning'
    ? 'bg-yellow-600'
    : 'bg-blue-600'

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg min-w-[320px] max-w-[90vw]',
        'transition-all duration-300 ease-out',
        bgColor,
        'text-white',
        // Slide in/out animation
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 -translate-y-2'
      )}
    >
      {/* Icon */}
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />

      {/* Message */}
      <p className="flex-1 text-sm font-medium leading-relaxed">
        {toast.message}
      </p>

      {/* Dismiss button */}
      {toast.dismissible && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
