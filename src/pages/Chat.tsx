import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Menu, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { Drawer } from '@/components/layout/Drawer'
import { DeleteMenu } from '@/components/conversations/DeleteMenu'
import { DeleteConfirmation } from '@/components/conversations/DeleteConfirmation'
import {
  createConversation,
  listUserConversations,
  deleteConversation,
  getConversation,
} from '@/lib/database/conversations'
import type { Conversation } from '@/types/database'

export default function Chat() {
  const { user } = useAuth()
  const { conversationId } = useParams<{ conversationId: string }>()
  const navigate = useNavigate()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteMenuConversation, setDeleteMenuConversation] =
    useState<Conversation | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] =
    useState<Conversation | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [currentConversationTitle, setCurrentConversationTitle] = useState<
    string | null
  >(null)

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

  // Load most recent conversation if no conversationId in URL
  useEffect(() => {
    async function loadMostRecentConversation() {
      if (!user || conversationId) return

      try {
        const conversations = await listUserConversations(user.id)
        if (conversations.length > 0) {
          // Navigate to most recent conversation
          navigate(`/chat/${conversations[0].id}`, { replace: true })
        }
        // If no conversations, stay on /chat with empty state
      } catch (err) {
        console.error('Error loading conversations:', err)
      }
    }

    loadMostRecentConversation()
  }, [user, conversationId, navigate])

  const handleCreateNewConversation = async () => {
    if (!user) return

    try {
      const newConversation = await createConversation(user.id)
      navigate(`/chat/${newConversation.id}`)
    } catch (err) {
      console.error('Error creating conversation:', err)
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

      // If we deleted the current conversation, navigate away
      if (deleteConfirmation.id === conversationId) {
        // Load most recent conversation or go to empty state
        const conversations = await listUserConversations(user.id)
        if (conversations.length > 0) {
          navigate(`/chat/${conversations[0].id}`)
        } else {
          navigate('/chat')
        }
      }

      setDeleteConfirmation(null)
    } catch (err) {
      console.error('Error deleting conversation:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleTitleGenerated = () => {
    // Refresh conversation title
    if (conversationId) {
      getConversation(conversationId)
        .then((conversation) => {
          setCurrentConversationTitle(conversation?.title || null)
        })
        .catch((err) => {
          console.error('Error refreshing conversation title:', err)
        })
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800 p-4 flex-shrink-0">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {/* Left: Hamburger menu */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 hover:bg-gray-800 rounded-lg transition"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6 text-white" />
          </button>

          {/* Center: Title */}
          <h1 className="text-lg font-semibold text-white truncate mx-4 flex-1 text-center">
            {currentConversationTitle || 'Ampel Chat'}
          </h1>

          {/* Right: New chat button */}
          <button
            onClick={handleCreateNewConversation}
            className="p-2 hover:bg-gray-800 rounded-lg transition"
            aria-label="New chat"
          >
            <Plus className="w-6 h-6 text-white" />
          </button>
        </div>
      </header>

      {/* Chat interface */}
      <main className="flex-1 overflow-hidden">
        <ChatInterface
          conversationId={conversationId || null}
          onTitleGenerated={handleTitleGenerated}
        />
      </main>

      {/* Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentConversationId={conversationId || null}
        userId={user.id}
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
