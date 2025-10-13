import { Toast } from './Toast'
import { useToast } from '@/contexts/ToastContext'

/**
 * Container for managing and displaying all active toasts
 * Fixed position at top of screen with safe area support
 * Stacks toasts vertically with spacing
 */
export function ToastContainer() {
  const { toasts, dismissToast } = useToast()

  if (toasts.length === 0) {
    return null
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex flex-col items-center gap-3 px-4 py-4 pointer-events-none"
      style={{
        // iOS safe area support for top (notch/Dynamic Island)
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onDismiss={dismissToast} />
        </div>
      ))}
    </div>
  )
}
