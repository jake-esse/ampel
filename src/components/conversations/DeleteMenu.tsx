import { Trash2 } from 'lucide-react'

interface DeleteMenuProps {
  conversationTitle: string | null
  onDelete: () => void
  onCancel: () => void
}

/**
 * Bottom sheet menu for conversation actions
 * Currently only shows delete option
 */
export function DeleteMenu({
  conversationTitle,
  onDelete,
  onCancel,
}: DeleteMenuProps) {
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
        onClick={onCancel}
      />

      {/* Bottom sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom duration-300">
        <div className="bg-gray-800 rounded-t-2xl border-t border-gray-700">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-700">
            <h3 className="font-medium text-white text-center">
              {conversationTitle || 'New Chat'}
            </h3>
          </div>

          {/* Actions */}
          <div className="px-4 py-2">
            <button
              onClick={onDelete}
              className="w-full flex items-center gap-3 px-4 py-4 text-red-400 hover:bg-gray-700/50 rounded-lg transition-all duration-150 active:bg-gray-700"
            >
              <Trash2 className="w-5 h-5" />
              <span className="font-medium">Delete conversation</span>
            </button>
          </div>

          {/* Cancel */}
          <div className="px-4 py-2 pb-4">
            <button
              onClick={onCancel}
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition-all duration-150 active:scale-95"
            >
              Cancel
            </button>
          </div>

          {/* Safe area padding for bottom */}
          <div
            style={{
              height: 'env(safe-area-inset-bottom)',
            }}
          />
        </div>
      </div>
    </>
  )
}
