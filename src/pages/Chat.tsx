import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Menu, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useConversations } from '@/hooks/useConversations'
import { impact } from '@/hooks/useHaptics'
import { useBackButton } from '@/hooks/useBackButton'
import { useKeyboard } from '@/hooks/useKeyboard'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { StreamingTitle } from '@/components/chat/StreamingTitle'
import { Drawer } from '@/components/layout/Drawer'
import { DeleteMenu } from '@/components/conversations/DeleteMenu'
import { DeleteConfirmation } from '@/components/conversations/DeleteConfirmation'
import {
  createConversation,
  deleteConversation,
  getConversation,
} from '@/lib/database/conversations'
import type { Conversation } from '@/types/database'

export default function Chat() {
  const { user } = useAuth()
  const { conversationId } = useParams<{ conversationId: string }>()
  const navigate = useNavigate()
  const { addConversation, updateConversation, removeConversation } =
    useConversations()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteMenuConversation, setDeleteMenuConversation] =
    useState<Conversation | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] =
    useState<Conversation | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [currentConversationTitle, setCurrentConversationTitle] = useState<
    string | null
  >(null)
  const [isTitleStreaming, setIsTitleStreaming] = useState(false)

  // Keyboard control for tap-to-dismiss
  const { hideKeyboard } = useKeyboard()

  // Load current conversation title
  useEffect(() => {
    async function loadConversationTitle() {
      if (!conversationId) {
        setCurrentConversationTitle(null)
        return
      }

      try {
        const conversation = await getConversation(conversationId)
        setCurrentConversationTitle(conversation?.title || null)
      } catch (err) {
        console.error('Error loading conversation title:', err)
        setCurrentConversationTitle(null)
      }
    }

    loadConversationTitle()
  }, [conversationId])

  // REMOVED: Auto-loading most recent conversation
  // Users should always start with a fresh chat screen when opening the app
  // This provides a cleaner experience and allows them to start new conversations
  // without having to manually create a new chat each time

  const handleCreateNewConversation = async () => {
    if (!user) return

    try {
      const newConversation = await createConversation(user.id)
      // Add to context immediately for real-time updates
      addConversation(newConversation)
      navigate(`/chat/${newConversation.id}`)
    } catch (err) {
      console.error('Error creating conversation:', err)
      // TODO: Show error toast
    }
  }

  const handleSelectConversation = (id: string) => {
    navigate(`/chat/${id}`)
  }

  const handleLongPressConversation = (conversation: Conversation) => {
    setDeleteMenuConversation(conversation)
  }

  const handleDeleteClick = () => {
    if (deleteMenuConversation) {
      setDeleteConfirmation(deleteMenuConversation)
      setDeleteMenuConversation(null)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation || !user) return

    try {
      setIsDeleting(true)
      await deleteConversation(deleteConfirmation.id)

      // Remove from context immediately
      removeConversation(deleteConfirmation.id)

      // If we deleted the current conversation, navigate to fresh chat
      if (deleteConfirmation.id === conversationId) {
        // Always go to fresh chat screen after deletion
        // This maintains consistency with the app always starting fresh
        navigate('/chat')
      }

      setDeleteConfirmation(null)
    } catch (err) {
      console.error('Error deleting conversation:', err)
      // TODO: Show error toast
    } finally {
      setIsDeleting(false)
    }
  }

  const handleTitleStreaming = useCallback(
    (partialTitle: string) => {
      // Update local state as title streams in
      setCurrentConversationTitle(partialTitle)
      setIsTitleStreaming(true)

      // Also update context so drawer shows streaming title
      if (conversationId) {
        updateConversation(conversationId, { title: partialTitle })
      }
    },
    [conversationId, updateConversation]
  )

  const handleTitleComplete = useCallback(
    (finalTitle: string) => {
      // Update with final title and stop streaming
      setCurrentConversationTitle(finalTitle)
      setIsTitleStreaming(false)

      // Update context with final title
      if (conversationId) {
        updateConversation(conversationId, { title: finalTitle })
      }
    },
    [conversationId, updateConversation]
  )

  // Android back button handling
  useBackButton({
    drawerOpen,
    onCloseDrawer: () => {
      impact('light')
      setDrawerOpen(false)
    },
    inConversation: !!conversationId,
    onNavigateBack: () => navigate('/chat'),
    atRootLevel: !conversationId, // At root when no conversation is selected
  })

  if (!user) {
    return null
  }

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* Sliding content wrapper - pushes right when drawer opens */}
      <div
        className={cn(
          "flex flex-col flex-1 overflow-hidden transition-transform duration-300 ease-in-out",
          drawerOpen && "translate-x-[75%]"
        )}
      >
        {/* Header */}
        <header
          onClick={hideKeyboard}
          className="bg-white rounded-b-3xl px-4 pt-4 pb-1 flex-shrink-0 border-b-[0.5px] border-[#E5E3DD]"
          style={{
            // iOS safe area support for top (notch/Dynamic Island)
            paddingTop: 'max(1rem, env(safe-area-inset-top))',
          }}
        >
          <div className="relative flex items-center justify-between max-w-4xl mx-auto">
            {/* Left: Hamburger menu */}
            <button
              onClick={() => {
                // Trigger light haptic when opening drawer (iOS only)
                impact('light')
                setDrawerOpen(true)
              }}
              className="p-2.5 rounded-lg transition-all duration-150 active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center z-10"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5 text-gray-900" />
            </button>

            {/* Center: Title with streaming animation - absolutely positioned for true centering */}
            <h1 className="absolute left-0 right-0 text-xl font-semibold font-serif text-gray-900 truncate px-16 text-center">
              <StreamingTitle
                title={currentConversationTitle || ''}
                isStreaming={isTitleStreaming}
              />
            </h1>

            {/* Right: New chat button */}
            <button
              onClick={handleCreateNewConversation}
              className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center transition-all duration-150 active:scale-95 z-10"
              aria-label="New chat"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </header>

        {/* Chat interface */}
        <main className="flex-1 overflow-hidden">
          <ChatInterface
            conversationId={conversationId || null}
            onTitleStreaming={handleTitleStreaming}
            onTitleComplete={handleTitleComplete}
          />
        </main>
      </div>

      {/* Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => {
          // Trigger light haptic when closing drawer (iOS only)
          impact('light')
          setDrawerOpen(false)
        }}
        currentConversationId={conversationId || null}
        userEmail={user.email}
        onCreateNew={handleCreateNewConversation}
        onSelectConversation={handleSelectConversation}
        onLongPressConversation={handleLongPressConversation}
      />

      {/* Delete menu */}
      {deleteMenuConversation && (
        <DeleteMenu
          conversationTitle={deleteMenuConversation.title}
          onDelete={handleDeleteClick}
          onCancel={() => setDeleteMenuConversation(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirmation && (
        <DeleteConfirmation
          conversationTitle={deleteConfirmation.title}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirmation(null)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  )
}
