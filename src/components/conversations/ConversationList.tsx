import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { ConversationItem } from './ConversationItem'
import { listUserConversations } from '@/lib/database/conversations'
import type { Conversation } from '@/types/database'

interface ConversationListProps {
  currentConversationId: string | null
  userId: string
  onCreateNew: () => void
  onSelectConversation: (id: string) => void
  onLongPressConversation: (conversation: Conversation) => void
}

/**
 * List of user's conversations with create new button
 * Loads conversations from database and displays them
 */
export function ConversationList({
  currentConversationId,
  userId,
  onCreateNew,
  onSelectConversation,
  onLongPressConversation,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load conversations when component mounts or userId changes
  useEffect(() => {
    async function loadConversations() {
      try {
        setIsLoading(true)
        setError(null)
        const data = await listUserConversations(userId)
        setConversations(data)
      } catch (err) {
        console.error('Error loading conversations:', err)
        setError('Failed to load conversations')
      } finally {
        setIsLoading(false)
      }
    }

    loadConversations()
  }, [userId])

  return (
    <div className="flex flex-col h-full">
      {/* New chat button */}
      <div className="px-4 py-4 border-b border-gray-700">
        <button
          onClick={onCreateNew}
          className="w-full flex items-center gap-3 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition active:scale-98"
        >
          <Plus className="w-5 h-5" />
          <span>New chat</span>
        </button>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-gray-400">Loading conversations...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8 px-4">
            <p className="text-sm text-red-400 text-center">{error}</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex items-center justify-center py-8 px-4">
            <p className="text-sm text-gray-400 text-center">
              No conversations yet. Create your first chat!
            </p>
          </div>
        ) : (
          <>
            {/* Section label */}
            <div className="px-4 pt-4 pb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Recent
              </h3>
            </div>

            {/* List */}
            <div className="pb-4">
              {conversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isActive={conversation.id === currentConversationId}
                  onClick={() => onSelectConversation(conversation.id)}
                  onLongPress={() => onLongPressConversation(conversation)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
