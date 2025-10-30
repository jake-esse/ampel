import { useEffect } from 'react'
import { Settings, Plus, Sprout, Grid3x3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ConversationList } from '../conversations/ConversationList'
import type { Conversation } from '@/types/database'
import { cn, getUserInitials } from '@/lib/utils'
import { impact } from '@/hooks/useHaptics'

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
  const navigate = useNavigate()
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
          'fixed inset-y-0 left-0 w-[75%] max-w-sm bg-white z-50',
          'border-r-[0.5px] border-[#E5E3DD]',
          'transform transition-transform duration-300 ease-in-out',
          'flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 pt-5 pb-5"
          style={{
            // iOS safe area support for top (notch/Dynamic Island)
            // Match chat header positioning for horizontal alignment
            paddingTop: 'max(1rem, env(safe-area-inset-top))',
          }}
        >
          {/* Logo and title */}
          <div className="flex items-end">
            <Sprout
              className="w-8 h-8 text-gray-900"
              style={{ transform: 'translateY(-4px)' }}
            />
            <h2 className="text-3xl font-medium font-sans text-gray-900 tracking-tight mt-1.5 -ml-1">Ampel</h2>
          </div>

          {/* New chat button */}
          <button
            onClick={() => {
              onCreateNew()
              onClose()
            }}
            className="w-7 h-7 rounded-full bg-[#30302E] flex items-center justify-center transition-all duration-150 active:scale-95 mt-1.5"
            aria-label="New chat"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
          </button>
        </div>

        {/* Apps navigation button */}
        <div className="px-6 pb-2">
          <button
            onClick={() => {
              impact('light')
              navigate('/apps')
              onClose()
            }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-200 rounded-lg transition-all duration-150 active:scale-95 min-h-[44px]"
            aria-label="Apps"
          >
            <Grid3x3 className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Apps</span>
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-hidden">
          <ConversationList
            currentConversationId={currentConversationId}
            onSelectConversation={(id) => {
              onSelectConversation(id)
              onClose()
            }}
            onLongPressConversation={onLongPressConversation}
          />
        </div>

        {/* Profile section */}
        <div className="border-t-[0.5px] border-[#E5E3DD] px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Avatar with initials */}
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-[#30302E]">
                <span className="text-xs font-semibold text-white">
                  {getUserInitials(null, userEmail)}
                </span>
              </div>

              {/* User info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600 truncate">{userEmail}</p>
              </div>
            </div>

            {/* Settings button */}
            <button
              onClick={() => {
                impact('light')
                navigate('/settings')
                onClose()
              }}
              className="p-2.5 hover:bg-gray-200 rounded-lg transition-all duration-150 active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Safe area padding for bottom */}
        <div
          style={{
            height: 'env(safe-area-inset-bottom)',
          }}
          className="bg-white"
        />
      </div>
    </>
  )
}
