import { useEffect } from 'react'
import { X, Settings } from 'lucide-react'
import { ConversationList } from '../conversations/ConversationList'
import type { Conversation } from '@/types/database'
import { cn, getUserInitials, getAvatarColor } from '@/lib/utils'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  currentConversationId: string | null
  userEmail: string | undefined
  onCreateNew: () => void
  onSelectConversation: (id: string) => void
  onLongPressConversation: (conversation: Conversation) => void
}

/**
 * Slide-out drawer navigation for managing conversations
 * Contains conversation list and profile section
 */
export function Drawer({
  isOpen,
  onClose,
  currentConversationId,
  userEmail,
  onCreateNew,
  onSelectConversation,
  onLongPressConversation,
}: DrawerProps) {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-40 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 w-[85%] max-w-sm bg-gray-900 z-50',
          'transform transition-transform duration-300 ease-in-out',
          'flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-gray-800"
          style={{
            // iOS safe area support for top (notch/Dynamic Island)
            paddingTop: 'max(1rem, env(safe-area-inset-top))',
          }}
        >
          <h2 className="text-xl font-bold text-white">Ampel</h2>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-gray-800 rounded-lg transition-all duration-150 active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close drawer"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-hidden">
          <ConversationList
            currentConversationId={currentConversationId}
            onCreateNew={() => {
              onCreateNew()
              onClose()
            }}
            onSelectConversation={(id) => {
              onSelectConversation(id)
              onClose()
            }}
            onLongPressConversation={onLongPressConversation}
          />
        </div>

        {/* Profile section */}
        <div className="border-t border-gray-800 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Avatar with initials */}
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                  getAvatarColor(userEmail)
                )}
              >
                <span className="text-sm font-semibold text-white">
                  {getUserInitials(null, userEmail)}
                </span>
              </div>

              {/* User info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-400 truncate">{userEmail}</p>
              </div>
            </div>

            {/* Settings button */}
            <button
              className="p-2.5 hover:bg-gray-800 rounded-lg transition-all duration-150 active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Safe area padding for bottom */}
        <div
          style={{
            height: 'env(safe-area-inset-bottom)',
          }}
          className="bg-gray-900"
        />
      </div>
    </>
  )
}
