import { useEffect } from 'react'
import { X, Settings } from 'lucide-react'
import { ConversationList } from '../conversations/ConversationList'
import type { Conversation } from '@/types/database'
import { cn } from '@/lib/utils'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  currentConversationId: string | null
  userId: string
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
  userId,
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">Ampel</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition"
            aria-label="Close drawer"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-hidden">
          <ConversationList
            currentConversationId={currentConversationId}
            userId={userId}
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
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-400 truncate">{userEmail}</p>
            </div>
            <button
              className="p-2 hover:bg-gray-800 rounded-lg transition ml-3"
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
