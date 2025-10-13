import {
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { listUserConversations } from '@/lib/database/conversations'
import { useAuth } from '@/hooks/useAuth'
import type { Conversation } from '@/types/database'

interface ConversationContextType {
  conversations: Conversation[]
  isLoading: boolean
  error: string | null
  addConversation: (conversation: Conversation) => void
  updateConversation: (id: string, updates: Partial<Conversation>) => void
  removeConversation: (id: string) => void
  refreshList: () => Promise<void>
}

const ConversationContext = createContext<ConversationContextType | null>(null)

interface ConversationProviderProps {
  children: ReactNode
}

/**
 * Provider for shared conversation list state
 * Manages conversation list across the app with real-time updates
 * Uses useAuth to automatically get userId
 */
export function ConversationProvider({
  children,
}: ConversationProviderProps) {
  const { user } = useAuth()
  const userId = user?.id || null
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load conversations when userId changes
  const refreshList = useCallback(async () => {
    if (!userId) {
      setConversations([])
      setIsLoading(false)
      return
    }

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
  }, [userId])

  // Load conversations on mount and when userId changes
  useEffect(() => {
    refreshList()
  }, [refreshList])

  /**
   * Add a new conversation to the list (optimistic update)
   * New conversation appears at the top of the list
   */
  const addConversation = useCallback((conversation: Conversation) => {
    setConversations((prev) => [conversation, ...prev])
  }, [])

  /**
   * Update an existing conversation
   * Used for updating titles, timestamps, etc.
   */
  const updateConversation = useCallback(
    (id: string, updates: Partial<Conversation>) => {
      setConversations((prev) =>
        prev.map((conv) => (conv.id === id ? { ...conv, ...updates } : conv))
      )
    },
    []
  )

  /**
   * Remove a conversation from the list
   * Used after successful deletion
   */
  const removeConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((conv) => conv.id !== id))
  }, [])

  const value: ConversationContextType = {
    conversations,
    isLoading,
    error,
    addConversation,
    updateConversation,
    removeConversation,
    refreshList,
  }

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  )
}

export { ConversationContext }
