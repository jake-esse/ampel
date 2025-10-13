import { impact } from '@/hooks/useHaptics'

interface DeleteConfirmationProps {
  conversationTitle: string | null
  onConfirm: () => void
  onCancel: () => void
  isDeleting?: boolean
}

/**
 * Confirmation dialog for deleting a conversation
 * Shows warning that action cannot be undone
 */
export function DeleteConfirmation({
  conversationTitle,
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeleteConfirmationProps) {
  const handleConfirm = () => {
    // Trigger heavy haptic feedback for destructive action (iOS only)
    impact('heavy')
    onConfirm()
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/70 z-50 animate-in fade-in duration-200"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 animate-in zoom-in duration-200"
        style={{
          // Ensure modal doesn't overlap with notch or home indicator
          maxHeight: 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 2rem)',
        }}
      >
        <div className="bg-gray-800 rounded-lg p-6 max-w-sm mx-auto border border-gray-700">
          {/* Title */}
          <h3 className="text-lg font-semibold text-white mb-2">
            Delete conversation?
          </h3>

          {/* Description */}
          <p className="text-sm text-gray-300 mb-1">
            This cannot be undone. All messages in{' '}
            <span className="font-medium">
              "{conversationTitle || 'this conversation'}"
            </span>{' '}
            will be permanently deleted.
          </p>

          {/* Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 px-4 py-2.5 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isDeleting}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
